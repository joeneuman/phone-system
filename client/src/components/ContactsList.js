import React, { useState } from 'react';

function getInitials(contact) {
  if (contact.firstName) {
    return (
      (contact.firstName[0] || '') + (contact.lastName?.[0] || '')
    ).toUpperCase();
  }
  return contact.phoneNumber?.slice(-2) || '??';
}

function getDisplayName(contact) {
  if (contact.firstName) {
    return [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  }
  return contact.phoneNumber;
}

export function ContactsList({ contacts, onSearch, onSelect, onNew, onCall, onText }) {
  const [search, setSearch] = useState('');

  const handleSearch = (val) => {
    setSearch(val);
    onSearch(val || undefined);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="view-header">
        <h2>Contacts</h2>
        <button className="btn btn-primary" onClick={onNew}>+ Add</button>
      </div>
      <div className="search-bar">
        <input
          className="input"
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>
      <div className="list-container">
        {contacts.length === 0 && (
          <div className="empty-state">
            <div className="icon">👤</div>
            <p>No contacts yet</p>
          </div>
        )}
        {contacts.map((c) => (
          <div key={c._id} className="list-item">
            <div className="list-avatar" onClick={() => onSelect(c)} style={{ cursor: 'pointer' }}>
              {getInitials(c)}
            </div>
            <div className="list-item-content" onClick={() => onSelect(c)} style={{ cursor: 'pointer' }}>
              <div className="list-item-name">{getDisplayName(c)}</div>
              {c.company && (
                <div className="list-item-preview">{c.company}</div>
              )}
              <div className="list-item-preview">{c.phoneNumber}</div>
            </div>
            <button className="btn-ghost" onClick={() => onCall(c.phoneNumber)} title="Call">📞</button>
            <button className="btn-ghost" onClick={() => onText(c.phoneNumber)} title="Text">💬</button>
          </div>
        ))}
      </div>
    </div>
  );
}
