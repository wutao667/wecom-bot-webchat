import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, App } from 'antd';
import { UserOutlined, LockOutlined, RobotOutlined } from '@ant-design/icons';
import { useAuth } from '../App';
import { login as loginApi } from '../api/auth';

export default function Login() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuth();
  const navigate = useNavigate();

  // After login succeeds, navigate to home once auth state is confirmed
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const res = await loginApi(values.username, values.password);
      const { token, user } = res.data.data;
      login(token, user);
      // Navigation handled by useEffect above when user state updates
    } catch (err) {
      const msg = err.response?.data?.error || '登录失败';
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
          <Typography.Title level={3} style={{ marginTop: 12 }}>企业微信智能机器人</Typography.Title>
          <Typography.Text type="secondary">WebChat 登录</Typography.Text>
        </div>
        <Form onFinish={onFinish} size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center' }}>
          <Typography.Text>还没有账号？</Typography.Text>
          <Link to="/register">立即注册</Link>
        </div>
      </Card>
    </div>
  );
}
