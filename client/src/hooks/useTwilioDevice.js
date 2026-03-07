import { useState, useEffect, useRef, useCallback } from 'react';
import { Device } from '@twilio/voice-sdk';
import { api } from '../services/api';

function getErrorMessage(err) {
  if (!err) return 'Unknown Twilio error';
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string' && err.message.length > 0) return err.message;
  return 'Unknown Twilio error';
}

export function useTwilioDevice({ enabled = true } = {}) {
  const [device, setDevice] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [deviceReady, setDeviceReady] = useState(false);
  const [error, setError] = useState(null);
  const deviceRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
      setDevice(null);
      setActiveCall(null);
      setIncomingCall(null);
      setCallStatus('idle');
      setIsMuted(false);
      setDeviceReady(false);
      setError(null);
      return undefined;
    }

    let mounted = true;

    async function init() {
      try {
        const { token } = await api.getVoiceToken('giddy-phone-user');
        const newDevice = new Device(token, {
          logLevel: 1,
          codecPreferences: ['opus', 'pcmu'],
        });

        newDevice.on('registered', () => {
          if (mounted) setDeviceReady(true);
          console.log('Twilio Device registered');
        });

        newDevice.on('error', (err) => {
          console.error('Twilio Device error:', err);
          if (mounted) setError(getErrorMessage(err));
        });

        newDevice.on('incoming', (call) => {
          console.log('Incoming call from:', call.parameters.From);
          if (mounted) {
            setIncomingCall(call);
            setCallStatus('ringing');
          }

          call.on('cancel', () => {
            if (mounted) {
              setIncomingCall(null);
              setCallStatus('idle');
            }
          });

          call.on('disconnect', () => {
            if (mounted) {
              setActiveCall(null);
              setIncomingCall(null);
              setCallStatus('idle');
              setIsMuted(false);
            }
          });
        });

        newDevice.on('tokenWillExpire', async () => {
          const { token: newToken } = await api.getVoiceToken('giddy-phone-user');
          newDevice.updateToken(newToken);
        });

        await newDevice.register();
        deviceRef.current = newDevice;
        if (mounted) setDevice(newDevice);
      } catch (err) {
        console.error('Failed to initialize Twilio Device:', err);
        if (mounted) setError(getErrorMessage(err));
      }
    }

    init();

    return () => {
      mounted = false;
      if (deviceRef.current) {
        deviceRef.current.destroy();
      }
    };
  }, [enabled]);

  const makeCall = useCallback(async (phoneNumber) => {
    if (!deviceRef.current) return;
    setCallStatus('connecting');
    setError(null);

    try {
      const call = await deviceRef.current.connect({ params: { To: phoneNumber } });
      setActiveCall(call);

      call.on('accept', () => setCallStatus('in-progress'));
      call.on('ringing', () => setCallStatus('ringing-outbound'));
      call.on('disconnect', () => {
        setActiveCall(null);
        setCallStatus('idle');
        setIsMuted(false);
      });
      call.on('cancel', () => {
        setActiveCall(null);
        setCallStatus('idle');
        setIsMuted(false);
      });
      call.on('error', (err) => {
        setError(getErrorMessage(err));
        setCallStatus('idle');
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setCallStatus('idle');
    }
  }, []);

  const acceptCall = useCallback(() => {
    if (incomingCall) {
      incomingCall.accept();
      setActiveCall(incomingCall);
      setIncomingCall(null);
      setCallStatus('in-progress');
    }
  }, [incomingCall]);

  const rejectCall = useCallback(() => {
    if (incomingCall) {
      incomingCall.reject();
      setIncomingCall(null);
      setCallStatus('idle');
    }
  }, [incomingCall]);

  const hangUp = useCallback(() => {
    if (activeCall) {
      activeCall.disconnect();
      setActiveCall(null);
      setCallStatus('idle');
      setIsMuted(false);
    }
  }, [activeCall]);

  const toggleMute = useCallback(() => {
    if (activeCall) {
      const newMuted = !isMuted;
      activeCall.mute(newMuted);
      setIsMuted(newMuted);
    }
  }, [activeCall, isMuted]);

  const sendDtmf = useCallback((digit) => {
    if (activeCall) {
      activeCall.sendDigits(digit);
    }
  }, [activeCall]);

  return {
    device,
    deviceReady,
    activeCall,
    incomingCall,
    callStatus,
    isMuted,
    error,
    makeCall,
    acceptCall,
    rejectCall,
    hangUp,
    toggleMute,
    sendDtmf,
  };
}
