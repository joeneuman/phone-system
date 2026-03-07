import React from 'react';
import { formatDistanceToNow } from 'date-fns';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function ConversationList({ conversations, onSelect, onNewMessage }) {
  if (!conversations.length) {
    return (
      <div className="empty-state">
        <div className="icon">💬</div>
        <p>No conversations yet</p>
        <button className="btn btn-primary" onClick={onNewMessage}>
          New message
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="view-header">
        <h2>Messages</h2>
        <button className="btn btn-primary" onClick={onNewMessage}>+ New</button>
      </div>
      <div className="list-container">
        {conversations.map((c) => (
          <div key={c._id} className="list-item" onClick={() => onSelect(c)}>
            <div className="list-avatar">
              {getInitials(c.contactName)}
            </div>
            <div className="list-item-content">
              <div className="list-item-top">
                <span className="list-item-name">
                  {c.contactName || c.phoneNumber}
                </span>
                <span className="list-item-time">
                  {c.lastMessageAt
                    ? formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: true })
                    : ''}
                </span>
              </div>
              <div className="list-item-preview">{c.lastMessageBody || 'No messages'}</div>
            </div>
            {c.unreadCount > 0 && <div className="unread-dot" />}
          </div>
        ))}
      </div>
    </div>
  );
}
