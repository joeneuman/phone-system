import React, { useState, useEffect } from 'react';

export function ActiveCallView({ callStatus, isMuted, onHangUp, onToggleMute, onSendDtmf }) {
  const [elapsed, setElapsed] = useState(0);
  const [showKeypad, setShowKeypad] = useState(false);

  useEffect(() => {
    if (callStatus !== 'in-progress') {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const statusText = {
    connecting: 'Connecting...',
    'ringing-outbound': 'Ringing...',
    ringing: 'Incoming call...',
    'in-progress': formatTime(elapsed),
  };

  return (
    <div className="active-call">
      <div className="call-info">
        <h2>
          {callStatus === 'in-progress' ? 'On Call' : 'Calling'}
        </h2>
        <p className={callStatus !== 'in-progress' ? 'pulsing' : ''}>
          {statusText[callStatus] || callStatus}
        </p>
      </div>

      {callStatus === 'in-progress' && (
        <div className="call-timer">{formatTime(elapsed)}</div>
      )}

      {showKeypad && (
        <div className="dialpad-grid" style={{ marginTop: 16 }}>
          {['1','2','3','4','5','6','7','8','9','*','0','#'].map((d) => (
            <button
              key={d}
              className="dialpad-key"
              style={{ width: 56, height: 56, fontSize: 20 }}
              onClick={() => onSendDtmf(d)}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      <div className="call-controls">
        <button
          className={`call-control-btn ${isMuted ? 'active' : ''}`}
          onClick={onToggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>
        <button
          className={`call-control-btn ${showKeypad ? 'active' : ''}`}
          onClick={() => setShowKeypad(!showKeypad)}
          title="Keypad"
        >
          ⌨
        </button>
        <button
          className="call-control-btn hangup"
          onClick={onHangUp}
          title="Hang up"
        >
          📵
        </button>
      </div>
    </div>
  );
}
