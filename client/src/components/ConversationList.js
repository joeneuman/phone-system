import React, { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../services/api';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function highlightMatch(text, query) {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i}>{part}</mark>
      : part
  );
}

export function ConversationList({ conversations, onSelect, onNewMessage, activeConvoId }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchQuery.trim().length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await api.searchMessages(searchQuery.trim());
        setSearchResults(results);
      } catch (e) {
        console.error('Search failed', e);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
  };

  const displayList = searchResults || conversations;

  if (!conversations.length && !searchResults) {
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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="view-header">
        <h2>Messages</h2>
        <button className="btn btn-primary" onClick={onNewMessage}>+ New</button>
      </div>
      <div className="search-bar">
        <input
          className="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search messages..."
        />
        {searchQuery && (
          <button className="search-clear" onClick={clearSearch}>×</button>
        )}
      </div>
      <div className="list-container">
        {searching && <div className="search-status">Searching...</div>}
        {searchResults && !searching && searchResults.length === 0 && (
          <div className="search-status">No results found</div>
        )}
        {displayList.map((c) => (
          <div
            key={c._id}
            className={`list-item ${c._id === activeConvoId ? 'active' : ''}`}
            onClick={() => onSelect(c)}
          >
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
              <div className="list-item-preview">
                {searchResults && c.matchingMessages?.length > 0
                  ? highlightMatch(c.matchingMessages[0].body, searchQuery)
                  : (c.lastMessageBody || 'No messages')}
              </div>
              {searchResults && c.matchingMessages?.length > 1 && (
                <div className="search-match-count">
                  {c.matchingMessages.length} matching messages
                </div>
              )}
            </div>
            {!searchResults && c.unreadCount > 0 && <div className="unread-dot" />}
          </div>
        ))}
      </div>
    </div>
  );
}
