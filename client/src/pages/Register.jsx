import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined, RobotOutlined } from '@ant-design/icons';
import { register as registerApi } from '../api/auth';

export default function Register() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    if (values.password !== values.confirm) {
      message.error('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      await registerApi(values.username, values.password);
      message.success('注册成功，请登录');
      navigate('/login', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error || '注册失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 400, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <RobotOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          <Typography.Title level={3} style={{ marginTop: 12 }}>创建账号</Typography.Title>
          <Typography.Text type="secondary">注册 WeCom Bot WebChat</Typography.Text>
        </div>
        <Form onFinish={onFinish} size="large">
          <Form.Item name="username" rules={[
            { required: true, message: '请输入用户名' },
            { min: 3, message: '用户名至少3个字符' },
          ]}>
            <Input prefix={<UserOutlined />} placeholder="用户名（至少3个字符）" />
          </Form.Item>
          <Form.Item name="password" rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码至少6个字符' },
          ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码（至少6个字符）" />
          </Form.Item>
          <Form.Item name="confirm" rules={[
            { required: true, message: '请确认密码' },
          ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              注册
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center' }}>
          <Typography.Text>已有账号？</Typography.Text>
          <Link to="/login">返回登录</Link>
        </div>
      </Card>
    </div>
  );
}
