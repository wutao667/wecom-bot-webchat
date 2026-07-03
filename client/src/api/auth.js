import client from './client';

export async function register(username, password) {
  return client.post('/auth/register', { username, password });
}

export async function login(username, password) {
  return client.post('/auth/login', { username, password });
}
