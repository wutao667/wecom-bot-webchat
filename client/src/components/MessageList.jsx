import { useState, useEffect, useRef } from 'react';
import { Spin, Empty, message } from 'antd';
import { getMessages } from '../api/messages';
import { useSocket } from '../hooks/useSocket';

export default function MessageList({ botId, contact, onMessagesUpdate }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const bottomRef = useRef(null);
  const socket = useSocket();

  // Load initial messages
  const loadMessages = async (pageNum = 1, append = false) => {
    if (!botId || !contact) return;
    setLoading(true);
    try {
      const res = await getMessages(botId, { contact: contact.userid, page: pageNum, pageSize: 20 });
      const data = res.data.data;
      const items = data.items || [];

      if (append) {
        setMessages((prev) => [...items.reverse(), ...prev]);
      } else {
        setMessages(items.reverse());
        // Scroll to bottom on first load
        setTimeout(() => bottomRef.current?.scrollIntoView(), 100);
      }
      setHasMore(data.total > pageNum * 20);
      setPage(pageNum);
    } catch (err) {
      message.error('加载消息失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMessages([]);
    setPage(1);
    setHasMore(true);
    if (botId && contact) {
      loadMessages(1, false);
    }
  }, [botId, contact?.userid]);

  // Listen for new messages via socket
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      if (msg.bot_id === botId && (msg.from_user === contact?.userid || msg.to_user === contact?.userid)) {
        setMessages((prev) => [...prev, msg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        onMessagesUpdate?.();
      }
    };

    socket.on('new_message', handleNewMessage);
    return () => socket.off('new_message', handleNewMessage);
  }, [socket, botId, contact?.userid]);

  const loadMore = () => {
    if (!loading && hasMore) {
      loadMessages(page + 1, true);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'Z');
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (!contact) {
    return <Empty description="请选择联系人" style={{ marginTop: 100 }} />;
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', background: '#f5f5f5' }}>
      {hasMore && messages.length > 0 && (
        <div style={{ textAlign: 'center', margin: '8px 0' }}>
          <a onClick={loadMore} style={{ fontSize: 12 }}>
            {loading ? '加载中...' : '加载更多'}
          </a>
        </div>
      )}

      {messages.length === 0 && loading && (
        <div style={{ textAlign: 'center', marginTop: 60 }}><Spin /></div>
      )}

      {messages.length === 0 && !loading && (
        <div style={{ textAlign: 'center', marginTop: 60, color: '#999' }}>
          <p>暂无消息记录</p>
          <p style={{ fontSize: 12 }}>发送第一条消息开始对话</p>
        </div>
      )}

      {messages.map((msg) => {
        const isIncoming = msg.direction === 'incoming';
        return (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: isIncoming ? 'flex-start' : 'flex-end',
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>
              {formatTime(msg.created_at)}
            </div>
            <div
              className="message-bubble"
              style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: isIncoming ? '#fff' : '#95ec69',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                wordBreak: 'break-word',
                fontSize: 14,
                lineHeight: 1.6,
                position: 'relative',
              }}
            >
              {msg.msg_type === 'text' ? (
                <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
              ) : msg.msg_type === 'markdown' ? (
                <MarkdownContent content={msg.content} />
              ) : msg.msg_type === 'image' ? (
                <span>[图片消息]</span>
              ) : (
                <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

// Simple Markdown renderer component
function MarkdownContent({ content }) {
  // Basic markdown rendering without heavy dependencies
  const html = content
    .replace(/^### (.+)$/gm, '<strong>$1</strong>')
    .replace(/^## (.+)$/gm, '<strong>$1</strong>')
    .replace(/^# (.+)$/gm, '<strong>$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '• $1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>');

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
