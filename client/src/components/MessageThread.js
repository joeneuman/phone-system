import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { api } from '../services/api';

export function MessageThread({ conversation, onBack, onCall, showBackButton = true, onNameSaved }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [toNumber, setToNumber] = useState(conversation.phoneNumber || '');
  const [convoId, setConvoId] = useState(conversation._id || null);
  const [attachments, setAttachments] = useState([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [overrideName, setOverrideName] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const userScrolledUp = useRef(false);
  const prevMessageCount = useRef(0);
  const isAutoScrolling = useRef(false);

  useEffect(() => {
    setConvoId(conversation._id || null);
    setToNumber(conversation.phoneNumber || '');
    setMessages([]);
    setOverrideName(null);
    setIsEditingName(false);
    setText('');
    setAttachments([]);
    userScrolledUp.current = false;
    prevMessageCount.current = 0;
  }, [conversation._id, conversation.phoneNumber]);

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
    // Only auto-scroll when new messages actually arrive, not on every poll
    if (messages.length === prevMessageCount.current) return;
    const isNewMessage = messages.length > prevMessageCount.current;
    prevMessageCount.current = messages.length;

    if (isNewMessage && !userScrolledUp.current) {
      isAutoScrolling.current = true;
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => { isAutoScrolling.current = false; }, 500);
    }
  }, [messages]);

  const handleScroll = () => {
    if (isAutoScrolling.current) return;
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUp.current = distanceFromBottom > 100;
  };

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
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      userScrolledUp.current = false;
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

  const handleTextChange = (e) => {
    setText(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  };

  const handlePaste = (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItems = items.filter((item) => item.type.startsWith('image/'));
    if (imageItems.length === 0) return;
    e.preventDefault();
    const newAttachments = imageItems.map((item) => {
      const file = item.getAsFile();
      return {
        file,
        previewUrl: URL.createObjectURL(file),
      };
    });
    setAttachments((prev) => [...prev, ...newAttachments]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayName = overrideName || conversation.contactName || conversation.phoneNumber || 'New Message';

  const handleNameClick = () => {
    if (!conversation.phoneNumber) return;
    setEditName(displayName === conversation.phoneNumber ? '' : displayName);
    setIsEditingName(true);
  };

  const handleNameSave = async () => {
    const trimmed = editName.trim();
    if (!trimmed || !conversation.phoneNumber) {
      setIsEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      const parts = trimmed.split(/\s+/);
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ') || '';
      let contact;
      try {
        contact = await api.getContactByPhone(conversation.phoneNumber);
      } catch { contact = null; }
      if (contact && contact._id) {
        await api.updateContact(contact._id, { firstName, lastName });
      } else {
        await api.createContact({ phoneNumber: conversation.phoneNumber, firstName, lastName });
      }
      setOverrideName(trimmed);
      if (onNameSaved) onNameSaved();
    } catch (e) {
      console.error('Failed to save contact name', e);
    } finally {
      setSavingName(false);
      setIsEditingName(false);
    }
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleNameSave(); }
    if (e.key === 'Escape') { setIsEditingName(false); }
  };

  return (
    <div className="thread-container">
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {showBackButton && <button className="back-btn" onClick={onBack}>←</button>}
          {isEditingName ? (
            <input
              className="header-name-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={handleNameKeyDown}
              disabled={savingName}
              autoFocus
              placeholder="Contact name"
            />
          ) : (
            <h2
              className={conversation.phoneNumber ? 'editable' : ''}
              onClick={handleNameClick}
              title={conversation.phoneNumber ? 'Click to edit name' : ''}
            >
              {displayName}
            </h2>
          )}
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

      <div className="thread-messages" ref={messagesContainerRef} onScroll={handleScroll}>
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
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
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
