import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useMediaQuery } from './hooks/useMediaQuery';
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
  const [forwardingEnabled, setForwardingEnabled] = useState(false);
  const [forwardingLoading, setForwardingLoading] = useState(false);
  const [activeNumber, setActiveNumber] = useState('');
  const [availableNumbers, setAvailableNumbers] = useState([]);
  const [numberSwitching, setNumberSwitching] = useState(false);

  useEffect(() => {
    async function validateExistingSession() {
      try {
        // First try shared session auth (staging/prod cookie flow).
        const res = await api.authMe();
        const me = res?.user || res;
        if (!me?.isAdmin) {
          setLoginError('Access denied: admin privileges required.');
          throw new Error('Not an admin');
        }

        setAuthUser(me);
        localStorage.setItem(PHONE_AUTH_USER_KEY, JSON.stringify(me));
        setAuthStatus('ready');
      } catch (e) {
        // Fallback to local token flow (manual login inside phone app).
        if (!authToken) {
          setAuthStatus('unauthorized');
          return;
        }
        try {
          const res = await api.authMe(authToken);
          const me = res?.user || res;
          if (!me?.isAdmin) {
            setLoginError('Access denied: admin privileges required.');
            throw new Error('Not an admin');
          }
          setAuthUser(me);
          localStorage.setItem(PHONE_AUTH_USER_KEY, JSON.stringify(me));
          setAuthStatus('ready');
        } catch {
          setLoginError('Session expired. Please sign in again.');
          localStorage.removeItem(PHONE_AUTH_TOKEN_KEY);
          localStorage.removeItem(PHONE_AUTH_USER_KEY);
          setAuthToken('');
          setAuthUser(null);
          setAuthStatus('unauthorized');
        }
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

  const loadForwarding = useCallback(async () => {
    try {
      const data = await api.getForwarding();
      setForwardingEnabled(data.enabled || false);
    } catch (e) { console.error('Failed to load forwarding setting', e); }
  }, []);

  const loadPhoneNumbers = useCallback(async () => {
    try {
      const [numbersData, activeData] = await Promise.all([
        api.getPhoneNumbers(),
        api.getActiveNumber(),
      ]);
      setAvailableNumbers(numbersData.numbers || []);
      setActiveNumber(activeData.number || '');
    } catch (e) { console.error('Failed to load phone numbers', e); }
  }, []);

  const switchNumber = useCallback(async (number) => {
    setNumberSwitching(true);
    try {
      await api.setActiveNumber(number);
      setActiveNumber(number);
    } catch (e) { console.error('Failed to switch number', e); }
    setNumberSwitching(false);
  }, []);

  const toggleForwarding = useCallback(async () => {
    setForwardingLoading(true);
    try {
      const newState = !forwardingEnabled;
      await api.setForwarding(newState, '+14357671597');
      setForwardingEnabled(newState);
    } catch (e) { console.error('Failed to toggle forwarding', e); }
    setForwardingLoading(false);
  }, [forwardingEnabled]);

  useEffect(() => {
    if (!isReady) return;
    loadConversations();
    loadContacts();
    loadCallHistory();
    loadVoicemails();
    loadForwarding();
    loadPhoneNumbers();
  }, [isReady, loadConversations, loadContacts, loadCallHistory, loadVoicemails, loadForwarding, loadPhoneNumbers]);

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

  const isWideScreen = useMediaQuery('(min-width: 768px)');
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('messages_panel_width');
    return saved ? parseInt(saved) : 340;
  });
  const dragging = useRef(false);
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

      const meRes = await api.authMe(token);
      const me = meRes?.user || meRes;
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
        setView={(v) => {
          setView(v);
          setEditingContact(null);
          if (v === 'messages' && isWideScreen && conversations.length > 0) {
            setSelectedConvo(conversations[0]);
          } else {
            setSelectedConvo(null);
          }
        }}
        unreadMessages={totalUnread}
        unreadVoicemails={unreadVm}
        deviceReady={phone.deviceReady}
        socketConnected={socket.connected}
        onLogout={handleLogout}
        forwardingEnabled={forwardingEnabled}
        forwardingLoading={forwardingLoading}
        onToggleForwarding={toggleForwarding}
        username={authUser?.username}
        activeNumber={activeNumber}
        availableNumbers={availableNumbers}
        numberSwitching={numberSwitching}
        onSwitchNumber={switchNumber}
      />

      <main className="main-content">
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

        {!isOnCall && view === 'messages' && (
          <div className={`messages-layout ${isWideScreen ? 'split' : 'single'}`}>
            {(isWideScreen || !selectedConvo) && (
              <div className="messages-list-panel" style={isWideScreen ? { width: panelWidth } : undefined}>
                <ConversationList
                  conversations={conversations}
                  onSelect={(c) => setSelectedConvo(c)}
                  onNewMessage={() => setSelectedConvo({ isNew: true })}
                  activeConvoId={selectedConvo?._id}
                  onAvatarClick={async (c) => {
                    try {
                      let contact;
                      if (c.contact) {
                        contact = await api.getContact(c.contact);
                      } else if (c.phoneNumber) {
                        contact = await api.getContactByPhone(c.phoneNumber);
                      }
                      if (contact) {
                        setEditingContact(contact);
                        setView('contacts');
                      }
                    } catch (e) { console.error('Failed to load contact', e); }
                  }}
                />
              </div>
            )}
            {isWideScreen && (
              <div
                className="resize-handle"
                onMouseDown={(e) => {
                  e.preventDefault();
                  dragging.current = true;
                  document.body.style.cursor = 'col-resize';
                  document.body.style.userSelect = 'none';
                  let lastWidth = panelWidth;
                  const onMouseMove = (ev) => {
                    if (!dragging.current) return;
                    const sidebar = 72;
                    lastWidth = Math.min(Math.max(ev.clientX - sidebar, 200), 600);
                    setPanelWidth(lastWidth);
                  };
                  const onMouseUp = () => {
                    dragging.current = false;
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    localStorage.setItem('messages_panel_width', String(lastWidth));
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                  };
                  document.addEventListener('mousemove', onMouseMove);
                  document.addEventListener('mouseup', onMouseUp);
                }}
              >
                <div className="resize-handle-pill" />
              </div>
            )}
            {selectedConvo ? (
              <MessageThread
                conversation={selectedConvo}
                onBack={() => { setSelectedConvo(null); loadConversations(); }}
                onCall={handleCallFromContact}
                showBackButton={!isWideScreen}
                onNameSaved={loadConversations}
              />
            ) : isWideScreen ? (
              <div className="empty-thread-placeholder">
                <p>Select a conversation</p>
              </div>
            ) : null}
          </div>
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
            onContactClick={async (contactId) => {
              try {
                const contact = await api.getContact(contactId);
                if (contact) {
                  setEditingContact(contact);
                  setView('contacts');
                }
              } catch (e) { console.error('Failed to load contact', e); }
            }}
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
