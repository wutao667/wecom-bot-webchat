import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Modal, Form, Input, Space, Tag, Popconfirm, message, Typography, Empty } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, RobotOutlined, LinkOutlined, KeyOutlined, SafetyOutlined, CopyOutlined, CheckOutlined, CloseCircleOutlined, CodeOutlined } from '@ant-design/icons';
import { getBots, createBot, updateBot, deleteBot, reconnectBot, getBotTokens, createBotToken, deleteBotToken, getBotContacts } from '../api/bots';

// Helpers
const statusColor = (status) => {
  if (status === 'connected') return 'green';
  if (status === 'error') return 'red';
  return 'default';
};
const statusLabel = (status) => {
  if (status === 'connected') return '在线';
  if (status === 'error') return '异常';
  return '离线';
};

export default function BotManage({ user, onBotsChange }) {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBot, setEditingBot] = useState(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // ---- Token Management State ----
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [tokenBotId, setTokenBotId] = useState(null);
  const [tokenBotName, setTokenBotName] = useState('');
  const [tokens, setTokens] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [generatedToken, setGeneratedToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);
  const [copiedTokenId, setCopiedTokenId] = useState(null);

  // ---- Responsive: detect mobile (≤768px) ----
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    // Initial sync (in case window was resized before mount)
    setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const loadBots = async () => {
    setLoading(true);
    try {
      const res = await getBots();
      setBots(res.data.data || []);
      onBotsChange?.();
    } catch (err) {
      message.error('加载Bot列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBots();
  }, []);

  const handleAdd = () => {
    setEditingBot(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (bot) => {
    setEditingBot(bot);
    form.setFieldsValue({
      name: bot.name,
      bot_id: bot.bot_id,
      secret: '',
    });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await deleteBot(id);
      message.success('删除成功');
      loadBots();
    } catch (err) {
      message.error('删除失败');
    }
  };

  // ---- Token Management ----
  const openTokenModal = async (bot) => {
    setTokenBotId(bot.id);
    setTokenBotName(bot.name);
    setSelectedContact('');
    setTokenName('');
    setGeneratedToken('');
    setCopiedTokenId(null);
    setTokenModalVisible(true);
    setTokenLoading(true);

    try {
      const [tokensRes, contactsRes] = await Promise.all([
        getBotTokens(bot.id),
        getBotContacts(bot.id),
      ]);
      setTokens(tokensRes.data.data || []);
      setContacts(contactsRes.data.data || []);
    } catch (err) {
      message.error('加载Token数据失败');
    } finally {
      setTokenLoading(false);
    }
  };

  const handleGenerateToken = async () => {
    if (!selectedContact) {
      message.warning('请选择联系人');
      return;
    }
    try {
      const res = await createBotToken(tokenBotId, selectedContact, tokenName);
      const newToken = res.data.data;
      setGeneratedToken(newToken.token);
      setTokens([newToken, ...tokens]);
      message.success('Token 生成成功');
    } catch (err) {
      message.error(err.response?.data?.error || '生成Token失败');
    }
  };

  const handleDeleteToken = async (tokenId) => {
    try {
      await deleteBotToken(tokenBotId, tokenId);
      setTokens(tokens.filter(t => t.id !== tokenId));
      message.success('Token 已删除');
    } catch (err) {
      message.error('删除Token失败');
    }
  };

  const handleCopyToken = (tokenValue, tokenId) => {
    navigator.clipboard.writeText(tokenValue).then(() => {
      setCopiedTokenId(tokenId);
      setTimeout(() => setCopiedTokenId(null), 2000);
      message.success('已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const handleCopyCurl = async (tokenValue, tokenId) => {
    const curl = `curl -X POST ${window.location.origin}/api/message/${tokenValue} -H "Content-Type: application/json" -d '{"content":"你好，这是一条测试消息"}'`;
    try {
      await navigator.clipboard.writeText(curl);
      setCopiedTokenId(tokenId);
      setTimeout(() => setCopiedTokenId(null), 2000);
      message.success('命令已复制到剪贴板');
    } catch {
      message.error('复制失败');
    }
  };

  const handleReconnect = async (id) => {
    const hide = message.loading('正在重连...', 0);
    try {
      await reconnectBot(id);
      hide();
      message.success('重连成功');
      loadBots();
    } catch (err) {
      hide();
      const errMsg = err.response?.data?.error || '重连失败';
      message.error(errMsg);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingBot) {
        await updateBot(editingBot.id, values);
        message.success('更新成功');
      } else {
        await createBot(values.name, values.bot_id, values.secret);
        message.success('添加成功');
      }
      setModalOpen(false);
      loadBots();
    } catch (err) {
      if (err.response) {
        message.error(err.response.data?.error || '操作失败');
      }
    }
  };

  // ---- Desktop Table columns ----
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      ellipsis: true,
      render: (text) => (
        <Space>
          <RobotOutlined />
          <Typography.Text strong ellipsis>{text}</Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Bot ID',
      dataIndex: 'bot_id',
      key: 'bot_id',
      width: 140,
      ellipsis: true,
      render: (text) => (
        <Typography.Text code copyable style={{ fontSize: 12 }}>
          {text}
        </Typography.Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => (
        <Tag color={statusColor(status)}>{statusLabel(status)}</Tag>
      ),
    },
    {
      title: '错误信息',
      dataIndex: 'last_error',
      key: 'last_error',
      width: 200,
      ellipsis: true,
      render: (text) => text ? <Typography.Text type="danger" style={{ fontSize: 12 }}>{text}</Typography.Text> : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_, record) => (
        <Space wrap={false} size={0}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" icon={<SafetyOutlined />} onClick={() => openTokenModal(record)}>
            Token
          </Button>
          <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleReconnect(record.id)}>
            重连
          </Button>
          <Popconfirm title="确定删除此Bot？" description="删除后无法恢复" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ---- Mobile Card list (one Card per bot) ----
  const renderMobileCards = () => {
    if (!loading && bots.length === 0) {
      return (
        <Card>
          <Empty description="暂无机器人" />
        </Card>
      );
    }
    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {bots.map((bot) => (
          <Card
            key={bot.id}
            size="small"
            loading={loading}
            className="bot-manage-card"
            styles={{ body: { padding: 12 } }}
          >
            {/* Header: name + status */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <RobotOutlined style={{ color: '#1890ff', flexShrink: 0 }} />
                <Typography.Text strong style={{ fontSize: 15 }} ellipsis>
                  {bot.name}
                </Typography.Text>
              </div>
              <Tag color={statusColor(bot.status)} style={{ marginRight: 0, flexShrink: 0 }}>
                {statusLabel(bot.status)}
              </Tag>
            </div>

            {/* Bot ID (truncated) */}
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <LinkOutlined style={{ color: '#999', flexShrink: 0 }} />
              <Typography.Text
                type="secondary"
                style={{ fontSize: 12, fontFamily: 'SFMono-Regular, Consolas, monospace' }}
                ellipsis
                title={bot.bot_id}
              >
                {bot.bot_id}
              </Typography.Text>
            </div>

            {/* Error (if any) */}
            {bot.last_error && (
              <Typography.Text
                type="danger"
                style={{ fontSize: 12, display: 'block', marginTop: 6 }}
                ellipsis
              >
                {bot.last_error}
              </Typography.Text>
            )}

            {/* Created at */}
            {bot.created_at && (
              <Typography.Text
                type="secondary"
                style={{ fontSize: 11, display: 'block', marginTop: 4 }}
              >
                创建于 {bot.created_at}
              </Typography.Text>
            )}

            {/* Action buttons: two rows on mobile */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Button
                block
                icon={<EditOutlined />}
                onClick={() => handleEdit(bot)}
              >
                编辑
              </Button>
              <Button
                block
                icon={<SafetyOutlined />}
                onClick={() => openTokenModal(bot)}
              >
                Token
              </Button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Button
                block
                icon={<ReloadOutlined />}
                onClick={() => handleReconnect(bot.id)}
              >
                重连
              </Button>
              <Popconfirm
                title="确定删除此Bot？"
                description="删除后无法恢复"
                onConfirm={() => handleDelete(bot.id)}
                okText="删除"
                cancelText="取消"
              >
                <Button block danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </div>
          </Card>
        ))}
      </Space>
    );
  };

  // ---- Modal footer (full-width OK button on mobile) ----
  const modalFooter = isMobile
    ? [
        <Button
          key="submit"
          type="primary"
          block
          size="large"
          onClick={handleSubmit}
        >
          {editingBot ? '保存' : '添加'}
        </Button>,
      ]
    : undefined; // undefined = use Modal's default OK/Cancel footer

  return (
    <div style={{ padding: isMobile ? 12 : 24 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {isMobile ? (
          // Mobile: title is shown by App.jsx header, here we only show the add button (full-width)
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            block
            size="large"
          >
            添加机器人
          </Button>
        ) : (
          <>
            <Space>
              <Typography.Title level={5} style={{ margin: 0 }}>机器人管理</Typography.Title>
            </Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              添加机器人
            </Button>
          </>
        )}
      </div>

      {/* Content: Table on desktop, Card list on mobile */}
      {isMobile ? (
        renderMobileCards()
      ) : (
        <Card>
          <Table
            dataSource={bots}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={false}
          />
        </Card>
      )}

      <Modal
        title={editingBot ? '编辑机器人' : '添加机器人'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editingBot ? '保存' : '添加'}
        cancelText="取消"
        width={isMobile ? '95%' : 520}
        footer={modalFooter}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          // On mobile, all inputs stretch to modal width automatically because label layout is vertical.
          // For added safety, force each Form.Item to take full width:
        >
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入Bot名称' }]}
            style={{ marginBottom: 16 }}
          >
            <Input prefix={<RobotOutlined />} placeholder="例如：客服机器人" />
          </Form.Item>
          <Form.Item
            name="bot_id"
            label="Bot ID"
            rules={[{ required: true, message: '请输入Bot ID' }]}
            style={{ marginBottom: 16 }}
          >
            <Input
              prefix={<LinkOutlined />}
              placeholder="企业微信后台获取的 Bot ID"
              disabled={!!editingBot}
            />
          </Form.Item>
          <Form.Item
            name="secret"
            label="Secret"
            rules={editingBot ? [] : [{ required: true, message: '请输入Secret' }]}
            extra={editingBot ? '留空则保持原有Secret不变' : '企业微信后台获取的 Secret'}
            style={{ marginBottom: 0 }}
          >
            <Input.Password
              prefix={<KeyOutlined />}
              placeholder={editingBot ? '留空保持不变' : '请输入 Secret'}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ---- Token Management Modal ---- */}
      <Modal
        title={`Token 管理 - ${tokenBotName}`}
        open={tokenModalVisible}
        onCancel={() => setTokenModalVisible(false)}
        footer={null}
        width={isMobile ? '95%' : 600}
        destroyOnClose
      >
        {/* Generate new token section */}
        <div style={{ marginBottom: 16 }}>
          <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>生成新 Token</Typography.Title>
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Form.Item label="联系人" style={{ marginBottom: 0 }}>
              <select
                value={selectedContact}
                onChange={(e) => setSelectedContact(e.target.value)}
                style={{
                  width: '100%',
                  height: 32,
                  borderRadius: 6,
                  border: '1px solid #d9d9d9',
                  padding: '0 11px',
                  fontSize: 14,
                  outline: 'none',
                  background: '#fff',
                }}
              >
                <option value="">-- 请选择联系人 --</option>
                {contacts.map((c) => (
                  <option key={c.userid} value={c.userid}>{c.name} ({c.userid})</option>
                ))}
              </select>
            </Form.Item>
            <Input
              placeholder="备注（可选，例如：通知用、告警用）"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
            />
            <Button
              type="primary"
              icon={<SafetyOutlined />}
              onClick={handleGenerateToken}
              block={isMobile}
            >
              生成 Token
            </Button>
          </Space>
        </div>

        {/* Generated token display */}
        {generatedToken && (
          <Card
            size="small"
            style={{
              marginBottom: 16,
              border: '1px solid #52c41a',
              backgroundColor: '#f6ffed',
            }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Typography.Text strong style={{ color: '#52c41a' }}>
                <CheckOutlined /> Token 已生成
              </Typography.Text>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#fff',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #d9d9d9',
                wordBreak: 'break-all',
                fontFamily: 'SFMono-Regular, Consolas, monospace',
                fontSize: 12,
              }}>
                <Typography.Text copyable style={{ fontSize: 12 }}>{generatedToken}</Typography.Text>
              </div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                请复制并保存 Token，关闭弹窗后将不再完整显示。可在下方列表中重新复制。
              </Typography.Text>
              {/* API 命令示例 */}
              <div style={{ marginTop: 4 }}>
                <Typography.Text strong style={{ fontSize: 13, marginBottom: 8, display: 'block' }}>
                  调用方式
                </Typography.Text>
                <div
                  style={{
                    background: '#1e1e1e',
                    color: '#d4d4d4',
                    padding: '12px 16px',
                    borderRadius: 6,
                    fontFamily: 'SFMono-Regular, Consolas, monospace',
                    fontSize: 12,
                    lineHeight: 1.8,
                    overflowX: 'auto',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {`curl -X POST ${window.location.origin}/api/message/${generatedToken} \\
  -H "Content-Type: application/json" \\
  -d '{"content":"你好，这是一条测试消息"}'`}
                </div>
              </div>
            </Space>
          </Card>
        )}

        {/* Token list */}
        <div>
          <Typography.Title level={5} style={{ marginBottom: 12 }}>已有 Token</Typography.Title>
          {loading && <Typography.Text type="secondary">加载中...</Typography.Text>}
          {!tokenLoading && tokens.length === 0 && (
            <Typography.Text type="secondary">暂无 Token</Typography.Text>
          )}
          {tokens.map((t) => (
            <Card
              key={t.id}
              size="small"
              style={{ marginBottom: 8 }}
              hoverable
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ marginBottom: 4 }}>
                    <Typography.Text strong style={{ fontSize: 13 }}>{t.name || '无备注'}</Typography.Text>
                    <Tag style={{ marginLeft: 8, fontSize: 11 }}>{t.contact_userid}</Tag>
                  </div>
                  <div style={{
                    fontFamily: 'SFMono-Regular, Consolas, monospace',
                    fontSize: 12,
                    color: '#595959',
                    background: '#fafafa',
                    padding: '4px 8px',
                    borderRadius: 4,
                    wordBreak: 'break-all',
                    marginBottom: 4,
                  }}>
                    ...{t.token.slice(-8)}
                  </div>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    创建于 {t.created_at}
                  </Typography.Text>
                </div>
                <Space direction="vertical" size={4}>
                  <Button
                    type="link"
                    size="small"
                    icon={copiedTokenId === t.id ? <CheckOutlined /> : <CopyOutlined />}
                    onClick={() => handleCopyToken(t.token, t.id)}
                    style={{ padding: '0 4px' }}
                  >
                    {copiedTokenId === t.id ? '已复制' : '复制'}
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    icon={copiedTokenId === t.id ? <CheckOutlined /> : <CodeOutlined />}
                    onClick={() => handleCopyCurl(t.token, t.id)}
                    style={{ padding: '0 4px' }}
                  >
                    {copiedTokenId === t.id ? '已复制' : '命令'}
                  </Button>
                  <Popconfirm
                    title="确定删除此Token？"
                    description="删除后不可恢复，使用此Token的请求将失败"
                    onConfirm={() => handleDeleteToken(t.id)}
                    okText="删除"
                    cancelText="取消"
                  >
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<CloseCircleOutlined />}
                      style={{ padding: '0 4px' }}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              </div>
            </Card>
          ))}
        </div>
      </Modal>
    </div>
  );
}
