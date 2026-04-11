import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { api } from '../services/api';

const LABEL_OPTIONS = ['mobile', 'landline', 'office', 'other'];

function PhoneRow({ number, label, onChangeNumber, onChangeLabel, onDetect, onRemove, detecting }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
      <input
        className="input"
        style={{ flex: 1 }}
        value={number}
        onChange={(e) => onChangeNumber(e.target.value)}
        placeholder="+14355551234"
      />
      <select
        className="input"
        style={{ width: 100, padding: '8px 6px' }}
        value={label || ''}
        onChange={(e) => onChangeLabel(e.target.value)}
      >
        <option value="">Label</option>
        {LABEL_OPTIONS.map((l) => (
          <option key={l} value={l}>{l}</option>
        ))}
      </select>
      <button
        className="btn btn-secondary"
        style={{ fontSize: 11, padding: '6px 8px', whiteSpace: 'nowrap' }}
        onClick={onDetect}
        disabled={detecting || !number.trim()}
        title="Detect line type via Twilio"
      >
        {detecting ? '...' : 'Detect'}
      </button>
      {onRemove && (
        <button
          className="btn btn-secondary"
          style={{ fontSize: 14, padding: '4px 8px', color: 'var(--red)' }}
          onClick={onRemove}
          title="Remove number"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function ContactForm({ contact, onBack, onCall, onText }) {
  const isNew = contact.isNew;
  const [form, setForm] = useState({
    phoneNumber: contact.phoneNumber || '',
    phoneLabel: contact.phoneLabel || '',
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    company: contact.company || '',
    email: contact.email || '',
    notes: contact.notes || '',
  });
  const [additionalPhones, setAdditionalPhones] = useState(
    (contact.additionalPhoneNumbers || []).map((p) => ({ number: p.number, label: p.label || '' }))
  );
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(null); // index or 'primary'
  const [phonePicker, setPhonePicker] = useState(null); // 'call' | 'text' | null
  const [textHistory, setTextHistory] = useState([]);
  const [loadingTexts, setLoadingTexts] = useState(false);

  useEffect(() => {
    if (!contact.phoneNumber || isNew) return;
    setLoadingTexts(true);
    api.getMessagesByPhone(contact.phoneNumber, 50)
      .then((msgs) => setTextHistory(msgs.reverse()))
      .catch(() => {})
      .finally(() => setLoadingTexts(false));
  }, [contact.phoneNumber, isNew]);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const allNumbers = [
    { number: form.phoneNumber, label: form.phoneLabel },
    ...additionalPhones.filter((p) => p.number.trim()),
  ].filter((p) => p.number.trim());

  const handleDetect = async (phoneNumber, onResult) => {
    try {
      let formatted = phoneNumber.trim();
      if (!formatted.startsWith('+')) {
        formatted = '+1' + formatted.replace(/\D/g, '');
      }
      const result = await api.lookupNumber(formatted);
      if (result.type && result.type !== 'unknown') {
        onResult(result.type);
      } else {
        alert('Could not determine line type');
      }
    } catch (e) {
      alert('Lookup failed: ' + e.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let phoneNumber = form.phoneNumber.trim();
      if (!phoneNumber.startsWith('+')) {
        phoneNumber = '+1' + phoneNumber.replace(/\D/g, '');
      }
      const cleaned = additionalPhones
        .filter((p) => p.number.trim())
        .map((p) => {
          let num = p.number.trim();
          if (!num.startsWith('+')) {
            num = '+1' + num.replace(/\D/g, '');
          }
          return { number: num, ...(p.label ? { label: p.label } : {}) };
        });

      const data = {
        ...form,
        phoneNumber,
        additionalPhoneNumbers: cleaned,
      };

      if (isNew) {
        await api.createContact(data);
      } else {
        await api.updateContact(contact._id, data);
      }
      onBack();
    } catch (e) {
      alert('Failed to save contact: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this contact?')) return;
    try {
      await api.deleteContact(contact._id);
      onBack();
    } catch (e) {
      alert('Failed to delete: ' + e.message);
    }
  };

  const handleAction = (type) => {
    if (allNumbers.length <= 1) {
      type === 'call' ? onCall(form.phoneNumber) : onText(form.phoneNumber);
    } else {
      setPhonePicker(type);
    }
  };

  const handlePickNumber = (number) => {
    if (phonePicker === 'call') onCall(number);
    else onText(number);
    setPhonePicker(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-btn" onClick={onBack}>←</button>
          <h2>{isNew ? 'New Contact' : 'Edit Contact'}</h2>
        </div>
        {!isNew && (
          <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
            <button className="btn btn-secondary" onClick={() => handleAction('call')}>📞</button>
            <button className="btn btn-secondary" onClick={() => handleAction('text')}>💬</button>
            {phonePicker && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                zIndex: 10,
                minWidth: 200,
                overflow: 'hidden',
              }}>
                {allNumbers.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handlePickNumber(p.number)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                    onMouseEnter={(e) => e.target.style.background = 'var(--bg-tertiary)'}
                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                  >
                    {p.number}
                    {p.label && <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 11 }}>{p.label}</span>}
                  </button>
                ))}
                <button
                  onClick={() => setPhonePicker(null)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '6px 12px',
                    border: 'none',
                    borderTop: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="contact-form">
        <div className="form-group">
          <label>Phone Number</label>
          <PhoneRow
            number={form.phoneNumber}
            label={form.phoneLabel}
            onChangeNumber={(v) => update('phoneNumber', v)}
            onChangeLabel={(v) => update('phoneLabel', v)}
            onDetect={async () => {
              setDetecting('primary');
              await handleDetect(form.phoneNumber, (type) => update('phoneLabel', type));
              setDetecting(null);
            }}
            detecting={detecting === 'primary'}
          />
        </div>

        {additionalPhones.length > 0 && (
          <div className="form-group">
            <label>Additional Phone Numbers</label>
            {additionalPhones.map((p, i) => (
              <PhoneRow
                key={i}
                number={p.number}
                label={p.label}
                onChangeNumber={(v) => {
                  const updated = [...additionalPhones];
                  updated[i] = { ...updated[i], number: v };
                  setAdditionalPhones(updated);
                }}
                onChangeLabel={(v) => {
                  const updated = [...additionalPhones];
                  updated[i] = { ...updated[i], label: v };
                  setAdditionalPhones(updated);
                }}
                onDetect={async () => {
                  setDetecting(i);
                  await handleDetect(p.number, (type) => {
                    const updated = [...additionalPhones];
                    updated[i] = { ...updated[i], label: type };
                    setAdditionalPhones(updated);
                  });
                  setDetecting(null);
                }}
                detecting={detecting === i}
                onRemove={() => setAdditionalPhones(additionalPhones.filter((_, j) => j !== i))}
              />
            ))}
          </div>
        )}

        <button
          className="btn btn-secondary"
          style={{ fontSize: 12, padding: '6px 12px', marginBottom: 12, alignSelf: 'flex-start' }}
          onClick={() => setAdditionalPhones([...additionalPhones, { number: '', label: '' }])}
        >
          + Add Phone Number
        </button>

        <div style={{ display: 'flex', gap: 12 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label>First Name</label>
            <input
              className="input"
              value={form.firstName}
              onChange={(e) => update('firstName', e.target.value)}
              placeholder="John"
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Last Name</label>
            <input
              className="input"
              value={form.lastName}
              onChange={(e) => update('lastName', e.target.value)}
              placeholder="Doe"
            />
          </div>
        </div>
        <div className="form-group">
          <label>Company</label>
          <input
            className="input"
            value={form.company}
            onChange={(e) => update('company', e.target.value)}
            placeholder="Acme Inc."
          />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="john@example.com"
          />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea
            className="input"
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={4}
            placeholder="Notes about this contact..."
            style={{ resize: 'vertical' }}
          />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          {!isNew && (
            <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
          )}
        </div>

        {!isNew && textHistory.length > 0 && (
          <div className="contact-text-history">
            <label>Text Message History</label>
            <div className="text-history-list">
              {textHistory.map((msg) => (
                <div key={msg._id} className={`text-history-msg ${msg.direction}`}>
                  <div className="text-history-body">{msg.body}</div>
                  {msg.mediaUrls?.map((url, i) => (
                    <img key={i} src={url} alt="attachment" style={{ maxWidth: 120, borderRadius: 6, marginTop: 4 }} />
                  ))}
                  <div className="text-history-time">
                    {msg.createdAt ? format(new Date(msg.createdAt), 'MMM d, h:mm a') : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!isNew && loadingTexts && (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>Loading text history...</div>
        )}
      </div>
    </div>
  );
}
