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

export async function getBotTokens(botId) {
  return client.get(`/bots/${botId}/tokens`);
}

export async function createBotToken(botId, contact_userid, name) {
  return client.post(`/bots/${botId}/tokens`, { contact_userid, name });
}

export async function deleteBotToken(botId, tokenId) {
  return client.delete(`/bots/${botId}/tokens/${tokenId}`);
}

export async function getBotContacts(botId) {
  return client.get(`/bots/${botId}/contacts`);
}
