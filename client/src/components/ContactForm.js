import React, { useState } from 'react';
import { api } from '../services/api';

export function ContactForm({ contact, onBack, onCall, onText }) {
  const isNew = contact.isNew;
  const [form, setForm] = useState({
    phoneNumber: contact.phoneNumber || '',
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    company: contact.company || '',
    email: contact.email || '',
    notes: contact.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      let phoneNumber = form.phoneNumber.trim();
      if (!phoneNumber.startsWith('+')) {
        phoneNumber = '+1' + phoneNumber.replace(/\D/g, '');
      }
      const data = { ...form, phoneNumber };

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-btn" onClick={onBack}>←</button>
          <h2>{isNew ? 'New Contact' : 'Edit Contact'}</h2>
        </div>
        {!isNew && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => onCall(contact.phoneNumber)}>📞</button>
            <button className="btn btn-secondary" onClick={() => onText(contact.phoneNumber)}>💬</button>
          </div>
        )}
      </div>
      <div className="contact-form">
        <div className="form-group">
          <label>Phone Number</label>
          <input
            className="input"
            value={form.phoneNumber}
            onChange={(e) => update('phoneNumber', e.target.value)}
            placeholder="+14355551234"
          />
        </div>
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
      </div>
    </div>
  );
}
