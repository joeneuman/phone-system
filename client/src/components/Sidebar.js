import React from 'react';

const VIEWS = [
  { id: 'dialpad', icon: '☎', label: 'Dialpad' },
  { id: 'messages', icon: '💬', label: 'Messages' },
  { id: 'contacts', icon: '👤', label: 'Contacts' },
  { id: 'calls', icon: '📞', label: 'Calls' },
  { id: 'voicemail', icon: '📩', label: 'Voicemail' },
];

export function Sidebar({
  view,
  setView,
  unreadMessages,
  unreadVoicemails,
  deviceReady,
  socketConnected,
  onLogout,
  forwardingEnabled,
  forwardingLoading,
  onToggleForwarding,
}) {
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
      <button
        className={`sidebar-btn forwarding-toggle ${forwardingEnabled ? 'forwarding-on' : ''}`}
        onClick={onToggleForwarding}
        disabled={forwardingLoading}
        title={forwardingEnabled ? 'Forwarding ON - tap to disable' : 'Forwarding OFF - tap to enable'}
      >
        <span className="forwarding-icon">{forwardingEnabled ? '↗' : '↗'}</span>
        <span className={`forwarding-dot ${forwardingEnabled ? 'on' : 'off'}`} />
      </button>
      <div
        className={`sidebar-status ${deviceReady && socketConnected ? 'connected' : 'disconnected'}`}
        title={deviceReady ? 'Phone ready' : 'Connecting...'}
      />
      <button className="sidebar-btn" onClick={onLogout} title="Logout">
        ⇦
      </button>
    </nav>
  );
}
