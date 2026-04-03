import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

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

function DedupReviewPanel({ reviews, onResolved }) {
  const [resolving, setResolving] = useState(null);

  const handleResolve = async (reviewId, action, keepContactId) => {
    setResolving(reviewId);
    try {
      await api.resolveDedup(reviewId, action, keepContactId);
      onResolved();
    } catch (e) {
      console.error('Failed to resolve dedup:', e);
    }
    setResolving(null);
  };

  return (
    <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
      {reviews.map((r) => (
        <div key={r.reviewId} style={{
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px',
          marginBottom: '8px',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--orange)', marginBottom: '6px' }}>
            {r.reason === 'same-phone-different-source'
              ? 'Same phone number, different sources'
              : 'Same name, different phone numbers'}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            {[r.contactA, r.contactB].map((c) => (
              <div key={c._id} style={{
                flex: 1,
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px',
                fontSize: '12px',
              }}>
                <div style={{ fontWeight: 600 }}>{getDisplayName(c)}</div>
                <div style={{ color: 'var(--text-secondary)' }}>{c.phoneNumber}</div>
                {c.company && <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{c.company}</div>}
                {c.metadata?.source && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '4px' }}>
                    Source: {c.metadata.source}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn btn-primary"
              disabled={resolving === r.reviewId}
              onClick={() => handleResolve(r.reviewId, 'merge')}
              style={{ fontSize: '11px', padding: '4px 8px', flex: 1 }}
            >
              Merge
            </button>
            <button
              className="btn"
              disabled={resolving === r.reviewId}
              onClick={() => handleResolve(r.reviewId, 'dismiss')}
              style={{ fontSize: '11px', padding: '4px 8px', color: 'var(--text-muted)' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ContactsList({ contacts, onSearch, onSelect, onNew, onCall, onText }) {
  const [search, setSearch] = useState('');
  const [dedupReviews, setDedupReviews] = useState([]);
  const [showDedup, setShowDedup] = useState(false);

  useEffect(() => {
    loadDedupReviews();
  }, []);

  const loadDedupReviews = async () => {
    try {
      const data = await api.getDedupPending();
      setDedupReviews(Array.isArray(data) ? data : []);
    } catch (e) {
      // Dedup endpoint might not exist yet on older deploys
    }
  };

  const handleSearch = (val) => {
    setSearch(val);
    onSearch(val || undefined);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="view-header">
        <h2>Contacts</h2>
        <button className="btn btn-primary" onClick={onNew}>+ Add</button>
      </div>
      {dedupReviews.length > 0 && (
        <div
          onClick={() => setShowDedup(!showDedup)}
          style={{
            padding: '8px 16px',
            background: 'var(--red-dim)',
            color: 'var(--orange)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            textAlign: 'center',
          }}
        >
          ⚠️ {dedupReviews.length} possible duplicate{dedupReviews.length !== 1 ? 's' : ''} found — {showDedup ? 'Hide' : 'Review'}
        </div>
      )}
      {showDedup && dedupReviews.length > 0 && (
        <DedupReviewPanel
          reviews={dedupReviews}
          onResolved={() => { loadDedupReviews(); onSearch(search || undefined); }}
        />
      )}
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
        {contacts.map((c) => {
          const extraCount = c.additionalPhoneNumbers?.length || 0;
          return (
            <div key={c._id} className="list-item">
              <div className="list-avatar" onClick={() => onSelect(c)} style={{ cursor: 'pointer' }}>
                {getInitials(c)}
              </div>
              <div className="list-item-content" onClick={() => onSelect(c)} style={{ cursor: 'pointer' }}>
                <div className="list-item-name">{getDisplayName(c)}</div>
                {c.company && (
                  <div className="list-item-preview">{c.company}</div>
                )}
                <div className="list-item-preview">
                  {c.phoneNumber}
                  {extraCount > 0 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: 6 }}>
                      +{extraCount} more
                    </span>
                  )}
                </div>
              </div>
              <button className="btn-ghost" onClick={() => onCall(c.phoneNumber)} title="Call">📞</button>
              <button className="btn-ghost" onClick={() => onText(c.phoneNumber)} title="Text">💬</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
