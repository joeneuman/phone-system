const API = process.env.REACT_APP_API_URL || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

export const api = {
  getVoiceToken: (identity) =>
    request(`/token/voice?identity=${encodeURIComponent(identity || 'giddy-phone-user')}`),

  // Contacts
  getContacts: (search) =>
    request(`/contacts${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getContact: (id) => request(`/contacts/${id}`),
  createContact: (data) => request('/contacts', { method: 'POST', body: JSON.stringify(data) }),
  updateContact: (id, data) =>
    request(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteContact: (id) => request(`/contacts/${id}`, { method: 'DELETE' }),

  // Messages
  getConversations: () => request('/messages/conversations'),
  getMessages: (conversationId, limit, before) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit);
    if (before) params.set('before', before);
    return request(`/messages/conversations/${conversationId}/messages?${params}`);
  },
  sendMessage: (to, body, mediaUrls) =>
    request('/messages/send', { method: 'POST', body: JSON.stringify({ to, body, mediaUrls }) }),
  markConversationRead: (id) => request(`/messages/conversations/${id}/read`, { method: 'POST' }),

  // Calls
  getCallHistory: (limit, offset) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit);
    if (offset) params.set('offset', offset);
    return request(`/calls?${params}`);
  },

  // Voicemail
  getVoicemails: (limit) => request(`/voicemail${limit ? `?limit=${limit}` : ''}`),
  getUnlistenedCount: () => request('/voicemail/unread-count'),
  markVoicemailListened: (id) => request(`/voicemail/${id}/listened`, { method: 'POST' }),
  deleteVoicemail: (id) => request(`/voicemail/${id}`, { method: 'DELETE' }),
};
