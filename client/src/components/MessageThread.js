import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { api } from '../services/api';

export function MessageThread({ conversation, onBack, onCall }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [toNumber, setToNumber] = useState(conversation.phoneNumber || '');
  const [convoId, setConvoId] = useState(conversation._id || null);
  const [attachments, setAttachments] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

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

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const newAttachments = files.map((file) => ({
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => {
      const removed = prev[index];
      if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSend = async () => {
    const targetNumber = toNumber.trim();
    if ((!text.trim() && attachments.length === 0) || !targetNumber) return;
    setSending(true);
    try {
      let formatted = targetNumber;
      if (!formatted.startsWith('+')) {
        formatted = '+1' + formatted.replace(/\D/g, '');
      }
      // Upload attachments and collect URLs
      let mediaUrls;
      if (attachments.length > 0) {
        const uploads = await Promise.all(
          attachments.map((a) => api.uploadMedia(a.file))
        );
        mediaUrls = uploads.map((u) => u.url);
      }
      const sent = await api.sendMessage(formatted, text.trim() || '', mediaUrls);
      setText('');
      attachments.forEach((a) => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); });
      setAttachments([]);
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
        {attachments.length > 0 && (
          <div className="attachment-previews">
            {attachments.map((a, i) => (
              <div key={i} className="attachment-preview">
                {a.previewUrl ? (
                  <img src={a.previewUrl} alt="attachment" />
                ) : (
                  <div className="attachment-file">{a.file.name}</div>
                )}
                <button className="attachment-remove" onClick={() => removeAttachment(i)}>×</button>
              </div>
            ))}
          </div>
        )}
        <div className="compose-row">
          <button
            className="attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,.pdf"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
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
            disabled={sending}
            title="Send"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
