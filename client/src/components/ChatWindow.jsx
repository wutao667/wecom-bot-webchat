import { useState, useCallback } from 'react';
import { message } from 'antd';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

export default function ChatWindow({ botId, contact, onSend }) {
  const [sending, setSending] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSend = useCallback(async (content) => {
    if (!botId || !contact) return;
    setSending(true);
    try {
      await onSend(content, 'markdown');
    } catch (err) {
      message.error('发送失败');
    } finally {
      setSending(false);
    }
  }, [botId, contact, onSend]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <MessageList
          key={`${contact?.userid}-${refreshKey}`}
          botId={botId}
          contact={contact}
        />
      </div>
      <MessageInput onSend={handleSend} loading={sending} />
    </div>
  );
}
