import client from './client';

export async function getMessages(botId, { contact, page = 1, pageSize = 20 } = {}) {
  const params = { page, page_size: pageSize };
  if (contact) params.contact = contact;
  return client.get(`/bots/${botId}/messages`, { params });
}

export async function sendMessage(botId, toUser, content, msgType = 'markdown') {
  return client.post(`/bots/${botId}/send`, {
    to_user: toUser,
    msg_type: msgType,
    content,
  });
}

export async function getContacts(botId) {
  return client.get(`/bots/${botId}/contacts`);
}
