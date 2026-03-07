const API = process.env.REACT_APP_API_URL || '/api';
const GIDDYDIGS_AUTH_API =
  process.env.REACT_APP_GIDDYDIGS_AUTH_URL || 'https://staging.giddydigs.com/_api/auth';

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function authRequest(path, options = {}) {
  const { token, headers, ...rest } = options;
  const authHeaders = { ...headers };
  if (rest.body && !authHeaders['Content-Type']) {
    authHeaders['Content-Type'] = 'application/json';
  }
  if (token) {
    authHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${GIDDYDIGS_AUTH_API}${path}`, {
    credentials: 'include',
    headers: authHeaders,
    ...rest,
  });
  if (!res.ok) throw new Error(`Auth error: ${res.status}`);
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

  // GIDDY DIGS auth bridge (staging first, production via env switch)
  authLogin: (username, password) =>
    authRequest('/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  authMe: (token) => authRequest('/me', { method: 'GET', token }),
};
