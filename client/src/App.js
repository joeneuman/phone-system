import React, { useState, useEffect, useCallback } from 'react';
import { useTwilioDevice } from './hooks/useTwilioDevice';
import { useSocket } from './hooks/useSocket';
import { api } from './services/api';
import { Sidebar } from './components/Sidebar';
import { Dialpad } from './components/Dialpad';
import { ActiveCallView } from './components/ActiveCallView';
import { IncomingCallModal } from './components/IncomingCallModal';
import { ConversationList } from './components/ConversationList';
import { MessageThread } from './components/MessageThread';
import { ContactsList } from './components/ContactsList';
import { ContactForm } from './components/ContactForm';
import { CallHistory } from './components/CallHistory';
import { VoicemailList } from './components/VoicemailList';
import './App.css';

const PHONE_AUTH_TOKEN_KEY = 'phone_giddydigs_auth_token';
const PHONE_AUTH_USER_KEY = 'phone_giddydigs_auth_user';

function pickToken(payload) {
  if (!payload || typeof payload !== 'object') return '';
  return payload.token || payload.accessToken || payload.jwt || '';
}

function App() {
  const [authStatus, setAuthStatus] = useState('checking');
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(PHONE_AUTH_TOKEN_KEY) || '');
  const [authUser, setAuthUser] = useState(() => {
    try {
      const raw = localStorage.getItem(PHONE_AUTH_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const isReady = authStatus === 'ready';
  const phone = useTwilioDevice({ enabled: isReady });
  const socket = useSocket({ enabled: isReady });

  const [view, setView] = useState('dialpad');
  const [conversations, setConversations] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [editingContact, setEditingContact] = useState(null);
  const [callHistory, setCallHistory] = useState([]);
  const [voicemails, setVoicemails] = useState([]);
  const [unreadVm, setUnreadVm] = useState(0);
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    async function validateExistingSession() {
      if (!authToken) {
        setAuthStatus('unauthorized');
        return;
      }

      try {
        const me = await api.authMe(authToken);
        if (!me?.isAdmin) {
          setLoginError('Access denied: admin privileges required.');
          localStorage.removeItem(PHONE_AUTH_TOKEN_KEY);
          localStorage.removeItem(PHONE_AUTH_USER_KEY);
          setAuthToken('');
          setAuthUser(null);
          setAuthStatus('unauthorized');
          return;
        }

        setAuthUser(me);
        localStorage.setItem(PHONE_AUTH_USER_KEY, JSON.stringify(me));
        setAuthStatus('ready');
      } catch (e) {
        setLoginError('Session expired. Please sign in again.');
        localStorage.removeItem(PHONE_AUTH_TOKEN_KEY);
        localStorage.removeItem(PHONE_AUTH_USER_KEY);
        setAuthToken('');
        setAuthUser(null);
        setAuthStatus('unauthorized');
      }
    }

    validateExistingSession();
  }, [authToken]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.getConversations();
      setConversations(data);
      setTotalUnread(data.reduce((sum, c) => sum + (c.unreadCount || 0), 0));
    } catch (e) { console.error('Failed to load conversations', e); }
  }, []);

  const loadContacts = useCallback(async (search) => {
    try {
      const data = await api.getContacts(search);
      setContacts(data);
    } catch (e) { console.error('Failed to load contacts', e); }
  }, []);

  const loadCallHistory = useCallback(async () => {
    try {
      const data = await api.getCallHistory(50);
      setCallHistory(data);
    } catch (e) { console.error('Failed to load call history', e); }
  }, []);

  const loadVoicemails = useCallback(async () => {
    try {
      const [data, count] = await Promise.all([
        api.getVoicemails(),
        api.getUnlistenedCount(),
      ]);
      setVoicemails(data);
      setUnreadVm(typeof count === 'number' ? count : 0);
    } catch (e) { console.error('Failed to load voicemails', e); }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    loadConversations();
    loadContacts();
    loadCallHistory();
    loadVoicemails();
  }, [isReady, loadConversations, loadContacts, loadCallHistory, loadVoicemails]);

  useEffect(() => {
    if (!isReady) return;
    const unsubs = [
      socket.on('message:received', () => { loadConversations(); }),
      socket.on('message:sent', () => { loadConversations(); }),
      socket.on('call:new', () => { loadCallHistory(); }),
      socket.on('call:status', () => { loadCallHistory(); }),
      socket.on('voicemail:new', () => { loadVoicemails(); }),
      socket.on('voicemail:transcribed', () => { loadVoicemails(); }),
    ];
    return () => unsubs.forEach((fn) => fn && fn());
  }, [isReady, socket, loadConversations, loadCallHistory, loadVoicemails]);

  function handleCallFromContact(phoneNumber) {
    phone.makeCall(phoneNumber);
  }

  function handleTextFromContact(phoneNumber) {
    const existing = conversations.find((c) => c.phoneNumber === phoneNumber);
    if (existing) {
      setSelectedConvo(existing);
    } else {
      setSelectedConvo({ phoneNumber, _id: null, isNew: true });
    }
    setView('messages');
  }

  const isOnCall = phone.callStatus !== 'idle';

  async function handleLoginSubmit(e) {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);

    try {
      const payload = await api.authLogin(loginForm.username, loginForm.password);
      const token = pickToken(payload);
      if (!token) {
        throw new Error('No auth token returned from GIDDY DIGS.');
      }

      const me = await api.authMe(token);
      if (!me?.isAdmin) {
        throw new Error('Access denied: admin privileges required.');
      }

      localStorage.setItem(PHONE_AUTH_TOKEN_KEY, token);
      localStorage.setItem(PHONE_AUTH_USER_KEY, JSON.stringify(me));
      setAuthToken(token);
      setAuthUser(me);
      setAuthStatus('ready');
    } catch (err) {
      setLoginError(err?.message || 'Login failed.');
      setAuthStatus('unauthorized');
    } finally {
      setLoggingIn(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem(PHONE_AUTH_TOKEN_KEY);
    localStorage.removeItem(PHONE_AUTH_USER_KEY);
    setAuthToken('');
    setAuthUser(null);
    setAuthStatus('unauthorized');
    setLoginForm({ username: '', password: '' });
    setConversations([]);
    setContacts([]);
    setCallHistory([]);
    setVoicemails([]);
    setUnreadVm(0);
    setTotalUnread(0);
  }

  if (authStatus !== 'ready') {
    return (
      <div className="auth-gate">
        <form className="auth-card" onSubmit={handleLoginSubmit}>
          <h1>GIDDY DIGS Phone</h1>
          <p>Admin sign-in required (staging auth).</p>
          <input
            className="input"
            type="text"
            placeholder="Username"
            value={loginForm.username}
            onChange={(e) => setLoginForm((f) => ({ ...f, username: e.target.value }))}
            autoComplete="username"
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={loginForm.password}
            onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
            autoComplete="current-password"
            required
          />
          {loginError && <div className="error-banner">{loginError}</div>}
          <button className="btn btn-primary" type="submit" disabled={loggingIn}>
            {loggingIn ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar
        view={view}
        setView={(v) => { setView(v); setSelectedConvo(null); setEditingContact(null); }}
        unreadMessages={totalUnread}
        unreadVoicemails={unreadVm}
        deviceReady={phone.deviceReady}
        socketConnected={socket.connected}
        onLogout={handleLogout}
      />

      <main className="main-content">
        <div className="phone-auth-pill">
          Admin: {authUser?.username || 'Unknown'}
        </div>
        {phone.incomingCall && (
          <IncomingCallModal
            callerNumber={phone.incomingCall.parameters?.From || 'Unknown'}
            onAccept={phone.acceptCall}
            onReject={phone.rejectCall}
          />
        )}

        {isOnCall && !phone.incomingCall && (
          <ActiveCallView
            callStatus={phone.callStatus}
            isMuted={phone.isMuted}
            onHangUp={phone.hangUp}
            onToggleMute={phone.toggleMute}
            onSendDtmf={phone.sendDtmf}
          />
        )}

        {!isOnCall && view === 'dialpad' && (
          <Dialpad onCall={phone.makeCall} error={phone.error} />
        )}

        {!isOnCall && view === 'messages' && !selectedConvo && (
          <ConversationList
            conversations={conversations}
            onSelect={(c) => setSelectedConvo(c)}
            onNewMessage={() => setSelectedConvo({ isNew: true })}
          />
        )}

        {!isOnCall && view === 'messages' && selectedConvo && (
          <MessageThread
            conversation={selectedConvo}
            onBack={() => { setSelectedConvo(null); loadConversations(); }}
            onCall={handleCallFromContact}
          />
        )}

        {!isOnCall && view === 'contacts' && !editingContact && (
          <ContactsList
            contacts={contacts}
            onSearch={loadContacts}
            onSelect={setEditingContact}
            onNew={() => setEditingContact({ isNew: true })}
            onCall={handleCallFromContact}
            onText={handleTextFromContact}
          />
        )}

        {!isOnCall && view === 'contacts' && editingContact && (
          <ContactForm
            contact={editingContact}
            onBack={() => { setEditingContact(null); loadContacts(); }}
            onCall={handleCallFromContact}
            onText={handleTextFromContact}
          />
        )}

        {!isOnCall && view === 'calls' && (
          <CallHistory
            calls={callHistory}
            onCall={handleCallFromContact}
            onText={handleTextFromContact}
          />
        )}

        {!isOnCall && view === 'voicemail' && (
          <VoicemailList
            voicemails={voicemails}
            onRefresh={loadVoicemails}
            onCall={handleCallFromContact}
          />
        )}
      </main>
    </div>
  );
}

export default App;
