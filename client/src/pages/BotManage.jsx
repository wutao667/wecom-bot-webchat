import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Modal, Form, Input, Space, Tag, Popconfirm, message, Typography, Empty } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, RobotOutlined, LinkOutlined, KeyOutlined } from '@ant-design/icons';
import { getBots, createBot, updateBot, deleteBot } from '../api/bots';

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
      render: (text) => (
        <Space>
          <RobotOutlined />
          <Typography.Text strong>{text}</Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Bot ID',
      dataIndex: 'bot_id',
      key: 'bot_id',
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
      render: (status) => (
        <Tag color={statusColor(status)}>{statusLabel(status)}</Tag>
      ),
    },
    {
      title: '错误信息',
      dataIndex: 'last_error',
      key: 'last_error',
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
      width: 160,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
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

            {/* Action buttons: full-width at bottom of card */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Button
                block
                icon={<EditOutlined />}
                onClick={() => handleEdit(bot)}
              >
                编辑
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
    </div>
  );
}
