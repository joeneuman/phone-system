import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { api } from '../services/api';

export function MessageThread({ conversation, onBack, onCall }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [toNumber, setToNumber] = useState(conversation.phoneNumber || '');
  const [convoId, setConvoId] = useState(conversation._id || null);
  const messagesEndRef = useRef(null);

  const loadMessages = useCallback(async () => {
    if (!convoId) return;
    try {
      const data = await api.getMessages(convoId);
      setMessages(data.reverse());
      api.markConversationRead(convoId);
    } catch (e) {
      console.error('Failed to load messages', e);
    }
  }, [convoId]);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const targetNumber = toNumber.trim();
    if (!text.trim() || !targetNumber) return;
    setSending(true);
    try {
      let formatted = targetNumber;
      if (!formatted.startsWith('+')) {
        formatted = '+1' + formatted.replace(/\D/g, '');
      }
      const sent = await api.sendMessage(formatted, text.trim());
      setText('');
      if (!convoId && sent?.conversation) {
        setConvoId(sent.conversation);
      } else {
        loadMessages();
      }
    } catch (e) {
      console.error('Failed to send message', e);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayName = conversation.contactName || conversation.phoneNumber || 'New Message';

  return (
    <div className="thread-container">
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-btn" onClick={onBack}>←</button>
          <h2>{displayName}</h2>
        </div>
        {conversation.phoneNumber && (
          <button
            className="btn btn-secondary"
            onClick={() => onCall(conversation.phoneNumber)}
          >
            📞 Call
          </button>
        )}
      </div>

      {conversation.isNew && !conversation._id && (
        <div className="new-message-to">
          <span>To:</span>
          <input
            className="input"
            style={{ border: 'none', background: 'transparent', padding: '4px 0' }}
            value={toNumber}
            onChange={(e) => setToNumber(e.target.value)}
            placeholder="+1 (555) 555-5555"
            autoFocus
          />
        </div>
      )}

      <div className="thread-messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>No messages yet. Start the conversation below.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg._id} className={`message-bubble ${msg.direction}`}>
            <div>{msg.body}</div>
            {msg.mediaUrls?.map((url, i) => (
              <img
                key={i}
                src={url}
                alt="attachment"
                style={{ maxWidth: '100%', borderRadius: 8, marginTop: 4 }}
              />
            ))}
            <div className="message-time">
              {msg.createdAt ? format(new Date(msg.createdAt), 'h:mm a') : ''}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="thread-compose">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
        />
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!text.trim() || sending}
          title="Send"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
