import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwilioService } from '../twilio/twilio.service';
import { SettingsService } from '../settings/settings.service';
import { CallsService } from '../calls/calls.service';
import { ContactsService } from '../contacts/contacts.service';
import Anthropic from '@anthropic-ai/sdk';

const FILLER_PHRASES = [
  'Uh-huh...',
  'Mm...',
  'Sure...',
  'Got it...',
  'Right...',
  'Okay...',
  'Mm-hmm...',
];

const SYSTEM_PROMPT = `You are Lucy, the friendly and warm phone assistant for Giddy Digs, a real estate company. You are having a real-time phone conversation with a caller.

YOUR IDENTITY:
- Your name is Lucy. You are female. If someone asks, you're the Giddy Digs assistant.
- You have a warm, confident, and slightly playful personality — like a friendly receptionist who genuinely enjoys helping people.
- Never say "As an AI" or reference being artificial in any way. You're just Lucy.

RESPONSE RULES:
- Keep responses to 1-2 sentences maximum. Be concise and conversational.
- Speak at a relaxed, unhurried pace. Use pauses naturally — you're not in a rush.
- Never use bullet points, numbered lists, markdown, or any formatting.
- Never use special characters, URLs, or spell out abbreviations.
- Speak naturally as if on a phone call.
- Use natural phrasing for numbers: say "four fifty" not "$450,000", say "three bed two bath" not "3bd/2ba".
- Pronounce dates naturally: "March fifteenth" not "03/15".
- If you need to share multiple items, spread them across conversational turns rather than listing them all at once.
- Use natural filler phrases: "Sure thing", "Got it", "Of course", "Let me see".
- A brief acknowledgment like "uh-huh" or "sure" has already been spoken to the caller before your response plays. Do NOT start your response with another acknowledgment. Jump straight to the substance.

LOOPING (Active Listening):
- Before answering a question or responding to a request, briefly repeat back or paraphrase what the caller said. This shows you're listening and builds trust.
- Examples: "A three bedroom in Park City..." then your answer. "So you're wondering about pricing..." then your response.
- Keep the loop short — just a few words echoing their key point, then move into your response.
- Don't loop on simple greetings or yes/no responses — only on substantive questions or requests.

CAPABILITIES:
- You can answer general questions about Giddy Digs and real estate.
- You do NOT have access to MLS listings, property data, or inventory. If someone asks about specific listings, availability, or property details, let them know you don't have that info handy but you'd love to connect them with Joe who can help.
- If the caller wants to speak with Joe (the agent/owner), use the transfer_call tool to connect them.
- If the caller asks something you cannot answer or if they seem frustrated or insistent on talking to a person, transfer the call.
- Be warm, helpful, and professional.

TRANSFERRING CALLS:
- When transferring, say something natural like "Let me connect you with Joe" and then use the transfer_call tool.
- Do not ask for permission to transfer if the caller explicitly asked to talk to someone.`;

interface CallSession {
  callSid: string;
  streamSid: string;
  from: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  abortController: AbortController | null;
  isPlaying: boolean;
}

@Injectable()
export class AiVoiceService implements OnModuleInit {
  private anthropic: Anthropic;
  private sessions: Map<string, CallSession> = new Map();

  constructor(
    private config: ConfigService,
    private twilioService: TwilioService,
    private settingsService: SettingsService,
    private callsService: CallsService,
    private contactsService: ContactsService,
  ) {}

  onModuleInit() {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
      console.log('AI Voice service initialized with Anthropic API');
    } else {
      console.warn('ANTHROPIC_API_KEY not set — AI voice attendant disabled');
    }
  }

  createSession(callSid: string, streamSid: string, from: string): CallSession {
    const session: CallSession = {
      callSid,
      streamSid,
      from,
      messages: [],
      abortController: null,
      isPlaying: false,
    };
    this.sessions.set(callSid, session);
    return session;
  }

  getSession(callSid: string): CallSession | undefined {
    return this.sessions.get(callSid);
  }

  removeSession(callSid: string) {
    const session = this.sessions.get(callSid);
    if (session?.abortController) {
      session.abortController.abort();
    }
    this.sessions.delete(callSid);
  }

  getRandomFiller(): string {
    return FILLER_PHRASES[Math.floor(Math.random() * FILLER_PHRASES.length)];
  }

  handleInterrupt(callSid: string) {
    const session = this.sessions.get(callSid);
    if (session) {
      if (session.abortController) {
        session.abortController.abort();
        session.abortController = null;
      }
      session.isPlaying = false;
    }
  }

  private getTools(): Anthropic.Tool[] {
    return [
      {
        name: 'transfer_call',
        description:
          'Transfer the caller to Joe (the Giddy Digs agent/owner). Use this when the caller wants to speak to a person, or when the conversation requires human assistance.',
        input_schema: {
          type: 'object' as const,
          properties: {
            reason: {
              type: 'string',
              description: 'Brief reason for the transfer',
            },
          },
          required: ['reason'],
        },
      },
    ];
  }

  async *streamResponse(
    callSid: string,
    userText: string,
  ): AsyncGenerator<
    { type: 'text'; token: string; last: boolean } | { type: 'transfer'; reason: string }
  > {
    const session = this.sessions.get(callSid);
    if (!session || !this.anthropic) return;

    session.messages.push({ role: 'user', content: userText });

    const abortController = new AbortController();
    session.abortController = abortController;

    try {
      const stream = this.anthropic.messages.stream(
        {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system: SYSTEM_PROMPT,
          messages: session.messages,
          tools: this.getTools(),
        },
        { signal: abortController.signal },
      );

      let fullResponse = '';
      let ttsBuffer = '';
      let transferRequested = false;
      let transferReason = '';

      for await (const event of stream) {
        if (abortController.signal.aborted) break;

        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          const text = event.delta.text;
          fullResponse += text;
          ttsBuffer += text;

          // Send to TTS in sentence-sized chunks for streaming
          const sentenceEnd = ttsBuffer.match(/[.!?,:;]\s/);
          if (sentenceEnd || ttsBuffer.length > 80) {
            yield { type: 'text', token: ttsBuffer, last: false };
            ttsBuffer = '';
          }
        }

        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'input_json_delta'
        ) {
          // Tool input streaming — accumulate but don't act yet
        }

        if (event.type === 'content_block_stop') {
          // Check if this was a tool use block
        }

        if (event.type === 'message_delta') {
          if (event.delta.stop_reason === 'tool_use') {
            transferRequested = true;
          }
        }
      }

      // Flush remaining text
      if (ttsBuffer.trim()) {
        yield { type: 'text', token: ttsBuffer, last: false };
      }

      // Signal end of response
      yield { type: 'text', token: '', last: true };

      // Save assistant response to history
      if (fullResponse) {
        session.messages.push({ role: 'assistant', content: fullResponse });
      }

      // Handle transfer after response is spoken
      if (transferRequested) {
        // Extract reason from the tool use block
        const finalMessage = await stream.finalMessage();
        for (const block of finalMessage.content) {
          if (block.type === 'tool_use' && block.name === 'transfer_call') {
            transferReason = (block.input as any)?.reason || 'Caller requested transfer';
          }
        }
        yield { type: 'transfer', reason: transferReason };
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        // Interrupted — this is normal during barge-in
        return;
      }
      console.error('Claude API error:', err);
      yield {
        type: 'text',
        token: "I'm sorry, I'm having a little trouble right now. Let me connect you with Joe.",
        last: false,
      };
      yield { type: 'text', token: '', last: true };
      yield { type: 'transfer', reason: 'AI error — fallback transfer' };
    } finally {
      session.abortController = null;
    }
  }

  async transferCall(callSid: string): Promise<void> {
    const forwarding = await this.settingsService.get('callForwarding');
    const publicUrl = this.twilioService.getPublicUrl();

    let twiml: string;
    if (forwarding?.enabled && forwarding?.number) {
      // Forward to personal cell
      twiml = `<Response><Say voice="Polly.Joanna">Connecting you now, please hold.</Say><Dial callerId="${this.twilioService.getPhoneNumber()}" timeout="25" action="${publicUrl}/api/webhooks/twilio/voice/complete" method="POST"><Number>${forwarding.number}</Number></Dial></Response>`;
    } else {
      // Ring the browser client
      twiml = `<Response><Say voice="Polly.Joanna">Connecting you now, please hold.</Say><Dial timeout="25" action="${publicUrl}/api/webhooks/twilio/voice/complete" method="POST"><Client>giddy-phone-user</Client></Dial></Response>`;
    }

    try {
      await this.twilioService.getClient().calls(callSid).update({ twiml });
      console.log(`Call ${callSid} transferred`);
    } catch (err) {
      console.error(`Failed to transfer call ${callSid}:`, err);
    }
  }
}
