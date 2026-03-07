import React from 'react';

const VIEWS = [
  { id: 'dialpad', icon: '☎', label: 'Dialpad' },
  { id: 'messages', icon: '💬', label: 'Messages' },
  { id: 'contacts', icon: '👤', label: 'Contacts' },
  { id: 'calls', icon: '📞', label: 'Calls' },
  { id: 'voicemail', icon: '📩', label: 'Voicemail' },
];

export function Sidebar({ view, setView, unreadMessages, unreadVoicemails, deviceReady, socketConnected }) {
  return (
    <nav className="sidebar">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          className={`sidebar-btn ${view === v.id ? 'active' : ''}`}
          onClick={() => setView(v.id)}
          title={v.label}
        >
          {v.icon}
          {v.id === 'messages' && unreadMessages > 0 && (
            <span className="sidebar-badge">{unreadMessages}</span>
          )}
          {v.id === 'voicemail' && unreadVoicemails > 0 && (
            <span className="sidebar-badge">{unreadVoicemails}</span>
          )}
        </button>
      ))}
      <div className="sidebar-spacer" />
      <div
        className={`sidebar-status ${deviceReady && socketConnected ? 'connected' : 'disconnected'}`}
        title={deviceReady ? 'Phone ready' : 'Connecting...'}
      />
    </nav>
  );
}
