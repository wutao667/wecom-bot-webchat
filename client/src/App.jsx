import { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Badge, Dropdown, message, Typography, Select, Drawer } from 'antd';
import {
  MessageOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  PlusOutlined,
  RobotOutlined,
  MenuOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import Login from './pages/Login';
import Register from './pages/Register';
import BotManage from './pages/BotManage';
import ChatWindow from './components/ChatWindow';
import ContactList from './components/ContactList';
import { getBots } from './api/bots';
import { useSocket } from './hooks/useSocket';
import './styles/chat.css';

const { Header, Sider, Content } = Layout;

// Auth context
export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    message.success('登录成功');
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    message.success('已退出登录');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainLayout user={user} onLogout={logout} />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthContext.Provider>
  );
}

function MainLayout({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { botId } = useParams();
  const [bots, setBots] = useState([]);
  const [selectedBot, setSelectedBot] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [botStatuses, setBotStatuses] = useState({});

  // --- Mobile responsive state ---
  const [mobileSiderOpen, setMobileSiderOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const isManagePage = location.pathname === '/bots/manage';

  // Socket connection
  const socket = useSocket();

  // Load bots
  const loadBots = async () => {
    try {
      const res = await getBots();
      setBots(res.data.data || []);
    } catch (err) {
      console.error('Failed to load bots:', err);
    }
  };

  useEffect(() => {
    loadBots();
  }, []);

  // Set selected bot from URL or first bot
  useEffect(() => {
    if (botId) {
      const found = bots.find((b) => String(b.id) === String(botId));
      if (found) setSelectedBot(found);
    } else if (bots.length > 0 && !isManagePage) {
      setSelectedBot(bots[0]);
    }
  }, [bots, botId, isManagePage]);

  // Join bot room on socket when selected bot changes
  useEffect(() => {
    if (!socket || !selectedBot) return;

    socket.emit('join_bot', selectedBot.id);

    return () => {
      socket.emit('leave_bot', selectedBot.id);
    };
  }, [socket, selectedBot]);

  // Listen for bot_status and new_message events
  useEffect(() => {
    if (!socket) return;

    const handleBotStatus = (data) => {
      setBotStatuses((prev) => ({ ...prev, [data.botId]: data.status }));
    };

    const handleNewMessage = (msg) => {
      if (msg.bot_id === selectedBot?.id) {
        // Trigger contacts refresh
        loadContacts(selectedBot.id);
      }
    };

    socket.on('bot_status', handleBotStatus);
    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('bot_status', handleBotStatus);
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, selectedBot]);

  const loadContacts = async (botId) => {
    try {
      const res = await getContacts(botId);
      setContacts(res.data.data || []);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    }
  };

  useEffect(() => {
    if (selectedBot && !isManagePage) {
      loadContacts(selectedBot.id);
    }
  }, [selectedBot, isManagePage]);

  const handleBotChange = (id) => {
    setSelectedContact(null);
    if (isMobile) {
      setMobileSiderOpen(false);
    }
    navigate(`/chat/${id}`);
  };

  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    if (isMobile) {
      setMobileSiderOpen(false);
    }
  };

  const handleBackToContacts = () => {
    setSelectedContact(null);
  };

  const handleSendMessage = async (content, msgType = 'markdown') => {
    if (!selectedBot || !selectedContact) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/bots/${selectedBot.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to_user: selectedContact.userid, msg_type: msgType, content }),
      });
      const data = await res.json();
      if (data.success) {
        // Reload contacts to show new message
        loadContacts(selectedBot.id);
      }
    } catch (err) {
      message.error('发送失败: ' + err.message);
    }
  };

  const isChatPage = !isManagePage && selectedBot;

  // ---------- Shared Sider / Drawer content (Bot selector + user info) ----------
  const siderContent = (
    <>
      {/* Bot selector */}
      <div style={{ padding: '16px', borderBottom: '1px solid #e8e8e8' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Typography.Title level={5} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <RobotOutlined /> 智能机器人
          </Typography.Title>
        </div>
        <Select
          style={{ width: '100%' }}
          placeholder="选择机器人"
          value={selectedBot ? String(selectedBot.id) : undefined}
          onChange={handleBotChange}
          options={bots.map((b) => ({
            value: String(b.id),
            label: (
              <span>
                <Badge status={botStatuses[b.id] === 'connected' ? 'success' : 'default'} />
                <span style={{ marginLeft: 8 }}>{b.name}</span>
              </span>
            ),
          }))}
        />
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <Button size="small" icon={<SettingOutlined />} onClick={() => {
            if (isMobile) setMobileSiderOpen(false);
            navigate('/bots/manage');
          }}>
            管理
          </Button>
          <Button size="small" icon={<PlusOutlined />} onClick={() => {
            if (isMobile) setMobileSiderOpen(false);
            navigate('/bots/manage');
          }}>
            添加
          </Button>
        </div>
      </div>

      {/* Current session info */}
      {isChatPage && selectedContact && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e8e8' }}>
          <Typography.Text strong style={{ fontSize: 13, color: '#666' }}>
            当前会话
          </Typography.Text>
          <div style={{ marginTop: 8 }}>
            <Typography.Text>
              <UserOutlined style={{ marginRight: 8 }} />
              {selectedContact.name}
            </Typography.Text>
          </div>
        </div>
      )}
    </>
  );

  // ---------- Desktop Sider (includes ContactList) ----------
  const desktopSider = (
    <Sider width={260} theme="light" style={{ borderRight: '1px solid #e8e8e8', overflow: 'auto' }}>
      {siderContent}
      {isChatPage && (
        <ContactList
          contacts={contacts}
          selectedUserId={selectedContact?.userid}
          onSelect={handleSelectContact}
          onRefresh={() => loadContacts(selectedBot.id)}
        />
      )}
    </Sider>
  );

  // ---------- Mobile Drawer (Bot selector + session info only, no ContactList) ----------
  const mobileDrawer = (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RobotOutlined /> 智能机器人
        </div>
      }
      placement="left"
      open={mobileSiderOpen}
      onClose={() => setMobileSiderOpen(false)}
      width={280}
      styles={{ body: { padding: 0 } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {siderContent}
        {/* Spacer */}
        <div style={{ flex: 1 }} />
        {/* User info at bottom */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e8e8e8' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserOutlined />
              <Typography.Text>{user?.username}</Typography.Text>
            </div>
            <Button type="text" size="small" icon={<LogoutOutlined />} onClick={() => { setMobileSiderOpen(false); onLogout(); }}>
              退出
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );

  return (
    <Layout style={{ height: '100vh' }}>
      {isMobile ? mobileDrawer : desktopSider}

      <Layout>
        <Header style={{
          background: '#fff',
          padding: isMobile ? '0 12px' : '0 24px',
          borderBottom: '1px solid #e8e8e8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
        }}>
          {/* Left side: title / back / hamburger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 0, flex: 1, minWidth: 0 }}>
            {isMobile && (
              isChatPage && selectedContact ? (
                // Chat view: show back button + contact name
                <>
                  <Button
                    type="text"
                    icon={<ArrowLeftOutlined />}
                    onClick={handleBackToContacts}
                    style={{ marginLeft: -4, fontSize: 18 }}
                  />
                  <Typography.Title level={5} style={{ margin: 0, fontSize: 17, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedContact.name}
                  </Typography.Title>
                </>
              ) : (
                // Contact list / Bot manage: show hamburger
                <>
                  <Button
                    type="text"
                    icon={<MenuOutlined />}
                    onClick={() => setMobileSiderOpen(true)}
                    style={{ marginLeft: -4, fontSize: 18 }}
                  />
                  <Typography.Title level={5} style={{ margin: 0, fontSize: 17 }}>
                    {isManagePage ? '机器人管理' : '联系人'}
                  </Typography.Title>
                </>
              )
            )}
            {!isMobile && (
              <Typography.Title level={4} style={{ margin: 0, fontSize: 24 }}>
                {isManagePage ? '机器人管理' : (selectedContact ? selectedContact.name : '请选择联系人')}
              </Typography.Title>
            )}
          </div>

          {/* Right side: user dropdown */}
          <Dropdown
            menu={{
              items: [
                { key: 'user', label: user?.username, disabled: true },
                { type: 'divider' },
                { key: 'manage', label: '管理机器人', icon: <SettingOutlined />, onClick: () => navigate('/bots/manage') },
                { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: onLogout },
              ],
            }}
          >
            <Button type="text" icon={<UserOutlined />} style={{ flexShrink: 0 }}>
              {isMobile ? '' : user?.username}
            </Button>
          </Dropdown>
        </Header>

        <Content style={{ overflow: 'auto' }}>
          {isManagePage ? (
            <BotManage user={user} onBotsChange={loadBots} />
          ) : isChatPage && selectedContact ? (
            <ChatWindow
              botId={selectedBot.id}
              contact={selectedContact}
              onSend={handleSendMessage}
            />
          ) : isChatPage && !selectedContact ? (
            isMobile ? (
              /* On mobile: ContactList fills the screen */
              <ContactList
                contacts={contacts}
                selectedUserId={selectedContact?.userid}
                onSelect={handleSelectContact}
                onRefresh={() => loadContacts(selectedBot.id)}
              />
            ) : (
              /* On desktop: empty state */
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
                <div style={{ textAlign: 'center' }}>
                  <MessageOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                  <Typography.Text type="secondary">请从左侧选择一个联系人开始聊天</Typography.Text>
                </div>
              </div>
            )
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
              <div style={{ textAlign: 'center' }}>
                <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <Typography.Text type="secondary">请先添加或选择一个机器人</Typography.Text>
              </div>
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  );
}

// Helper to fetch contacts (avoid circular imports)
async function getContacts(botId) {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api/bots/${botId}/contacts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}
