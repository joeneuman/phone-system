import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { AiVoiceService } from './ai-voice.service';

/**
 * Handles Twilio ConversationRelay WebSocket connections.
 *
 * ConversationRelay sends JSON text messages (not raw audio).
 * We receive transcribed speech and send back text to be spoken.
 */
export function setupConversationRelayWebSocket(
  server: Server,
  aiVoiceService: AiVoiceService,
) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url?.split('?')[0];
    if (pathname === '/ws/conversation-relay') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
    // Let other upgrade requests pass through (e.g., Socket.io for browser clients)
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('ConversationRelay WebSocket connected');

    let callSid = '';

    ws.on('message', async (data: Buffer) => {
      let msg: any;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        console.error('Invalid JSON from ConversationRelay');
        return;
      }

      switch (msg.type) {
        case 'setup': {
          callSid = msg.callSid || '';
          const streamSid = msg.streamSid || '';
          const from = msg.from || '';
          aiVoiceService.createSession(callSid, streamSid, from);
          console.log(`AI session started for call ${callSid} from ${from}`);
          break;
        }

        case 'prompt': {
          if (!callSid) break;
          const userText = msg.voicePrompt || msg.transcript || '';
          if (!userText.trim()) break;

          console.log(`[${callSid}] Caller: "${userText}"`);

          // Send immediate filler phrase to mask latency
          const filler = aiVoiceService.getRandomFiller();
          sendText(ws, filler, false);

          // Stream Claude's response
          const responseStream = aiVoiceService.streamResponse(callSid, userText);
          for await (const chunk of responseStream) {
            if (ws.readyState !== WebSocket.OPEN) break;

            if (chunk.type === 'text') {
              sendText(ws, chunk.token, chunk.last);
            } else if (chunk.type === 'transfer') {
              console.log(`[${callSid}] Transferring call: ${chunk.reason}`);
              await aiVoiceService.transferCall(callSid);
            }
          }
          break;
        }

        case 'interrupt': {
          if (!callSid) break;
          console.log(`[${callSid}] Caller interrupted`);
          aiVoiceService.handleInterrupt(callSid);
          break;
        }

        case 'dtmf': {
          console.log(`[${callSid}] DTMF: ${msg.digit}`);
          break;
        }

        case 'error': {
          console.error(`[${callSid}] ConversationRelay error:`, msg);
          break;
        }

        default: {
          console.log(`[${callSid}] Unknown event: ${msg.type}`);
        }
      }
    });

    ws.on('close', () => {
      console.log(`ConversationRelay disconnected for call ${callSid}`);
      if (callSid) {
        aiVoiceService.removeSession(callSid);
      }
    });

    ws.on('error', (err) => {
      console.error(`ConversationRelay WebSocket error:`, err);
    });
  });

  console.log('ConversationRelay WebSocket handler ready at /ws/conversation-relay');
  return wss;
}

function sendText(ws: WebSocket, token: string, last: boolean) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(
    JSON.stringify({
      type: 'text',
      token,
      last,
    }),
  );
}
