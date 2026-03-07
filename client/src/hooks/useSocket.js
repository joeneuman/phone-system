import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const WS_URL = process.env.REACT_APP_WS_URL || '/phone';

export function useSocket({ enabled = true } = {}) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef({});

  useEffect(() => {
    if (!enabled) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnected(false);
      return undefined;
    }

    const socket = io(WS_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    const events = [
      'message:received',
      'message:sent',
      'call:new',
      'call:status',
      'voicemail:new',
      'voicemail:transcribed',
    ];

    events.forEach((event) => {
      socket.on(event, (data) => {
        const handlers = listenersRef.current[event] || [];
        handlers.forEach((fn) => fn(data));
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [enabled]);

  const on = useCallback((event, handler) => {
    if (!listenersRef.current[event]) {
      listenersRef.current[event] = [];
    }
    listenersRef.current[event].push(handler);

    return () => {
      listenersRef.current[event] = listenersRef.current[event].filter((h) => h !== handler);
    };
  }, []);

  return { connected, on };
}
