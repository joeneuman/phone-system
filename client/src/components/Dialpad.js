import React, { useState, useCallback } from 'react';

const KEYS = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

export function Dialpad({ onCall, error }) {
  const [number, setNumber] = useState('');

  const handleKey = useCallback((digit) => {
    setNumber((n) => n + digit);
  }, []);

  const handleBackspace = useCallback(() => {
    setNumber((n) => n.slice(0, -1));
  }, []);

  const handleCall = useCallback(() => {
    if (number.trim()) {
      let formatted = number.trim();
      if (!formatted.startsWith('+')) {
        formatted = '+1' + formatted.replace(/\D/g, '');
      }
      onCall(formatted);
    }
  }, [number, onCall]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && number.trim()) {
      handleCall();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      handleBackspace();
    } else if (/^[\d*#]$/.test(e.key)) {
      e.preventDefault();
      handleKey(e.key);
    }
  }, [number, handleCall, handleBackspace, handleKey]);

  return (
    <div className="dialpad-container" tabIndex={0} onKeyDown={handleKeyDown}>
      {error && <div className="error-banner">{error}</div>}

      <div className="dialpad-number">
        <input
          className="input"
          style={{
            background: 'transparent',
            border: 'none',
            textAlign: 'center',
            fontSize: '32px',
            fontWeight: 300,
            letterSpacing: '2px',
            maxWidth: '400px',
          }}
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Enter number"
          autoFocus
        />
      </div>

      <div className="dialpad-grid">
        {KEYS.map((k) => (
          <button
            key={k.digit}
            className="dialpad-key"
            onClick={() => handleKey(k.digit)}
          >
            {k.digit}
            {k.letters && <small>{k.letters}</small>}
          </button>
        ))}
      </div>

      <div className="dialpad-actions">
        <div style={{ width: 48 }} />
        <button
          className="call-button"
          onClick={handleCall}
          disabled={!number.trim()}
          title="Call"
        >
          📞
        </button>
        <button
          className="backspace-btn"
          onClick={handleBackspace}
          style={{ visibility: number ? 'visible' : 'hidden' }}
          title="Delete"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
