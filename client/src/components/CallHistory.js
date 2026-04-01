import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';

function formatDuration(secs) {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getCallIcon(call) {
  if (call.status === 'no-answer' || call.status === 'busy' || call.status === 'canceled') {
    return { icon: '↙', className: 'missed', label: 'Missed' };
  }
  if (call.direction === 'inbound') {
    return { icon: '↙', className: 'inbound', label: 'Incoming' };
  }
  return { icon: '↗', className: 'outbound', label: 'Outgoing' };
}

export function CallHistory({ calls, onCall, onText }) {
  if (!calls.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className="view-header"><h2>Call History</h2></div>
        <div className="empty-state">
          <div className="icon">📞</div>
          <p>No calls yet</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="view-header"><h2>Call History</h2></div>
      <div className="list-container">
        {calls.map((call) => {
          const { icon, className, label } = getCallIcon(call);
          const remoteNumber = call.direction === 'inbound' ? call.from : call.to;

          return (
            <div key={call._id} className="list-item">
              <div className={`call-direction ${className}`} title={label}>
                {icon}
              </div>
              <div className="list-item-content">
                <div className="list-item-top">
                  <span className="list-item-name">
                    {call.contactName || remoteNumber}
                  </span>
                  <span className="list-item-time">
                    {call.createdAt
                      ? formatDistanceToNow(new Date(call.createdAt), { addSuffix: true })
                      : ''}
                  </span>
                </div>
                <div className="list-item-preview">
                  {label}
                  {call.duration ? ` · ${formatDuration(call.duration)}` : ''}
                  {call.contactName ? ` · ${remoteNumber}` : ''}
                </div>
              </div>
              <button className="btn-ghost" onClick={() => onCall(remoteNumber)} title="Call back">📞</button>
              <button className="btn-ghost" onClick={() => onText(remoteNumber)} title="Text">💬</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
