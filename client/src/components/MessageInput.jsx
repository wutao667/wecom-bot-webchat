import { Input, Button, Tooltip } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useState } from 'react';

const { TextArea } = Input;

export default function MessageInput({ onSend, loading }) {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const text = value.trim();
    if (!text || loading) return;
    onSend(text);
    setValue('');
  };

  const handleKeyDown = (e) => {
    // Ctrl+Enter or Command+Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      padding: '8px 16px 16px',
      borderTop: '1px solid #e8e8e8',
      background: '#fff',
    }}>
      <div style={{ marginBottom: 8 }}>
        <TextArea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息，支持 Markdown 格式（Ctrl+Enter 发送）"
          autoSize={{ minRows: 2, maxRows: 6 }}
          style={{ borderRadius: 8 }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Tooltip title="支持 Markdown 语法：**加粗**、*斜体*、- 列表等">
            <span style={{ fontSize: 12, color: '#999' }}>支持 Markdown 格式</span>
          </Tooltip>
        </div>
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          loading={loading}
          disabled={!value.trim()}
        >
          发送
        </Button>
      </div>
    </div>
  );
}
