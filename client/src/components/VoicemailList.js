import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../services/api';

export function VoicemailList({ voicemails, onRefresh, onCall }) {
  const handleListen = async (vm) => {
    if (!vm.listened) {
      await api.markVoicemailListened(vm._id);
      onRefresh();
    }
  };

  const handleDelete = async (vm) => {
    if (!window.confirm('Delete this voicemail?')) return;
    await api.deleteVoicemail(vm._id);
    onRefresh();
  };

  if (!voicemails.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className="view-header"><h2>Voicemail</h2></div>
        <div className="empty-state">
          <div className="icon">📩</div>
          <p>No voicemails</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="view-header"><h2>Voicemail</h2></div>
      <div className="list-container">
        {voicemails.map((vm) => (
          <div key={vm._id} className="voicemail-item">
            <div className="voicemail-header">
              <div className="voicemail-from">
                {!vm.listened && <div className="unread-dot" />}
                {vm.contactName || vm.from}
              </div>
              <span className="list-item-time">
                {vm.createdAt
                  ? formatDistanceToNow(new Date(vm.createdAt), { addSuffix: true })
                  : ''}
              </span>
            </div>

            {vm.duration > 0 && (
              <div className="call-duration">Duration: {vm.duration}s</div>
            )}

            {vm.transcription && (
              <div className="voicemail-transcript">"{vm.transcription}"</div>
            )}

            <audio
              className="voicemail-audio"
              controls
              preload="none"
              src={vm.recordingUrl ? `${vm.recordingUrl}.mp3` : '#'}
              onPlay={() => handleListen(vm)}
            />

            <div className="voicemail-actions">
              <button className="btn btn-secondary" onClick={() => onCall(vm.from)}>
                📞 Call back
              </button>
              <button className="btn btn-danger" onClick={() => handleDelete(vm)} style={{ fontSize: 12, padding: '6px 12px' }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
