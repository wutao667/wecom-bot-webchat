import client from './client';

export async function getBots() {
  return client.get('/bots');
}

export async function createBot(name, botId, secret) {
  return client.post('/bots', { name, bot_id: botId, secret });
}

export async function updateBot(id, updates) {
  return client.put(`/bots/${id}`, updates);
}

export async function deleteBot(id) {
  return client.delete(`/bots/${id}`);
}

export async function reconnectBot(id) {
  return client.post(`/bots/${id}/reconnect`);
}
