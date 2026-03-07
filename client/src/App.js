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

function App() {
  const phone = useTwilioDevice();
  const socket = useSocket();

  const [view, setView] = useState('dialpad');
  const [conversations, setConversations] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [editingContact, setEditingContact] = useState(null);
  const [callHistory, setCallHistory] = useState([]);
  const [voicemails, setVoicemails] = useState([]);
  const [unreadVm, setUnreadVm] = useState(0);
  const [totalUnread, setTotalUnread] = useState(0);

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
    loadConversations();
    loadContacts();
    loadCallHistory();
    loadVoicemails();
  }, [loadConversations, loadContacts, loadCallHistory, loadVoicemails]);

  useEffect(() => {
    const unsubs = [
      socket.on('message:received', () => { loadConversations(); }),
      socket.on('message:sent', () => { loadConversations(); }),
      socket.on('call:new', () => { loadCallHistory(); }),
      socket.on('call:status', () => { loadCallHistory(); }),
      socket.on('voicemail:new', () => { loadVoicemails(); }),
      socket.on('voicemail:transcribed', () => { loadVoicemails(); }),
    ];
    return () => unsubs.forEach((fn) => fn && fn());
  }, [socket, loadConversations, loadCallHistory, loadVoicemails]);

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

  return (
    <div className="app">
      <Sidebar
        view={view}
        setView={(v) => { setView(v); setSelectedConvo(null); setEditingContact(null); }}
        unreadMessages={totalUnread}
        unreadVoicemails={unreadVm}
        deviceReady={phone.deviceReady}
        socketConnected={socket.connected}
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
