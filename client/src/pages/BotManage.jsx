import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Modal, Form, Input, Space, Tag, Popconfirm, message, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ArrowLeftOutlined, RobotOutlined, LinkOutlined, KeyOutlined } from '@ant-design/icons';
import { getBots, createBot, updateBot, deleteBot } from '../api/bots';

export default function BotManage({ user, onBotsChange }) {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBot, setEditingBot] = useState(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

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
      render: (status) => {
        const colorMap = { connected: 'green', disconnected: 'default', error: 'red' };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
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

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回</Button>
          <Typography.Title level={5} style={{ margin: 0 }}>机器人管理</Typography.Title>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加机器人
        </Button>
      </div>

      <Card>
        <Table
          dataSource={bots}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title={editingBot ? '编辑机器人' : '添加机器人'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editingBot ? '保存' : '添加'}
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入Bot名称' }]}>
            <Input prefix={<RobotOutlined />} placeholder="例如：客服机器人" />
          </Form.Item>
          <Form.Item name="bot_id" label="Bot ID" rules={[{ required: true, message: '请输入Bot ID' }]}>
            <Input prefix={<LinkOutlined />} placeholder="企业微信后台获取的 Bot ID" disabled={!!editingBot} />
          </Form.Item>
          <Form.Item
            name="secret"
            label="Secret"
            rules={editingBot ? [] : [{ required: true, message: '请输入Secret' }]}
            extra={editingBot ? '留空则保持原有Secret不变' : '企业微信后台获取的 Secret'}
          >
            <Input.Password prefix={<KeyOutlined />} placeholder={editingBot ? '留空保持不变' : '请输入 Secret'} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
