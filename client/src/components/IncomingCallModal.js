import React from 'react';

export function IncomingCallModal({ callerNumber, onAccept, onReject }) {
  const initials = callerNumber.slice(-2);

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-card">
        <div className="caller-avatar">{initials}</div>
        <h3>{callerNumber}</h3>
        <p>Incoming call</p>
        <div className="incoming-call-actions">
          <button className="incoming-reject" onClick={onReject} title="Decline">
            📵
          </button>
          <button className="incoming-accept" onClick={onAccept} title="Answer">
            📞
          </button>
        </div>
      </div>
    </div>
  );
}
