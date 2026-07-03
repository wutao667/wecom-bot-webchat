import { List, Badge, Typography, Button, Input } from 'antd';
import { UserOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useState } from 'react';

export default function ContactList({ contacts = [], selectedUserId, onSelect, onRefresh }) {
  const [search, setSearch] = useState('');

  const filtered = search
    ? contacts.filter((c) => c.name?.toLowerCase().includes(search.toLowerCase()))
    : contacts;

  return (
    <div style={{ borderRight: '1px solid #f0f0f0' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
        <Input
          size="small"
          placeholder="搜索联系人"
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh} />
      </div>
      <List
        dataSource={filtered}
        locale={{ emptyText: '暂无联系人' }}
        renderItem={(item) => (
          <List.Item
            key={item.userid}
            onClick={() => onSelect(item)}
            style={{
              cursor: 'pointer',
              padding: '10px 12px',
              background: selectedUserId === item.userid ? '#e6f4ff' : 'transparent',
              borderBottom: '1px solid #f5f5f5',
            }}
            onMouseEnter={(e) => {
              if (selectedUserId !== item.userid) e.currentTarget.style.background = '#fafafa';
            }}
            onMouseLeave={(e) => {
              if (selectedUserId !== item.userid) e.currentTarget.style.background = 'transparent';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 10 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#1890ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0,
                fontSize: 14,
              }}>
                {item.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography.Text strong style={{ fontSize: 13 }}>{item.name}</Typography.Text>
                  {item.unread_count > 0 && (
                    <Badge count={item.unread_count} size="small" />
                  )}
                </div>
                <Typography.Text
                  type="secondary"
                  style={{ fontSize: 12 }}
                  ellipsis
                >
                  {item.last_message || '暂无消息'}
                </Typography.Text>
              </div>
            </div>
          </List.Item>
        )}
      />
    </div>
  );
}
