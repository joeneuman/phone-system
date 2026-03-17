import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwilioService } from '../twilio/twilio.service';
import { SettingsService } from '../settings/settings.service';
import { CallsService } from '../calls/calls.service';
import { ContactsService } from '../contacts/contacts.service';
import { ListingsService } from '../listings/listings.service';
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
- Do NOT use filler sounds like "um", "uh", "mm", "uh-huh", or "mm-hmm". Just respond naturally and directly.

LOOPING (Active Listening):
- Before answering a question or responding to a request, briefly repeat back or paraphrase what the caller said. This shows you're listening and builds trust.
- Examples: "A three bedroom in Park City..." then your answer. "So you're wondering about pricing..." then your response.
- Keep the loop short — just a few words echoing their key point, then move into your response.
- Don't loop on simple greetings or yes/no responses — only on substantive questions or requests.

CAPABILITIES:
- You can answer general questions about Giddy Digs and real estate.
- You CAN search property listings! Use the search_listings tool when a caller asks about available properties, homes for sale, what's on the market, etc.
- When presenting listing results, share them conversationally across multiple turns — mention one or two highlights at a time, not all at once. Use natural phrasing for prices and details.
- If the caller wants more detail than you have, or wants to schedule a showing, offer to connect them with Joe.
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
  messages: Array<{ role: 'user' | 'assistant'; content: any }>;
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
    private listingsService: ListingsService,
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
      {
        name: 'search_listings',
        description:
          'Search available property listings. Use when the caller asks about homes for sale, available properties, or what is on the market. Extract search criteria from the conversation.',
        input_schema: {
          type: 'object' as const,
          properties: {
            city: {
              type: 'string',
              description: 'City to search in (e.g. "St George", "Washington", "Hurricane")',
            },
            minPrice: {
              type: 'number',
              description: 'Minimum price filter',
            },
            maxPrice: {
              type: 'number',
              description: 'Maximum price filter',
            },
            minBeds: {
              type: 'number',
              description: 'Minimum number of bedrooms',
            },
            minBaths: {
              type: 'number',
              description: 'Minimum number of bathrooms',
            },
            status: {
              type: 'string',
              description: 'Listing status — defaults to Active',
            },
            propertyType: {
              type: 'string',
              description: 'Property type (e.g. "Residential", "Condo", "Townhouse", "Land")',
            },
          },
          required: [],
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
      yield* this.runClaudeStream(session, abortController);
    } catch (err: any) {
      if (err.name === 'AbortError' || abortController.signal.aborted) {
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

  private async *runClaudeStream(
    session: CallSession,
    abortController: AbortController,
  ): AsyncGenerator<
    { type: 'text'; token: string; last: boolean } | { type: 'transfer'; reason: string }
  > {
    const stream = this.anthropic.messages.stream(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: session.messages,
        tools: this.getTools(),
      },
      { signal: abortController.signal },
    );

    let fullResponse = '';
    let ttsBuffer = '';

    for await (const event of stream) {
      if (abortController.signal.aborted) break;

      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        const text = event.delta.text;
        fullResponse += text;
        ttsBuffer += text;

        const sentenceEnd = ttsBuffer.match(/[.!?,:;]\s/);
        if (sentenceEnd || ttsBuffer.length > 80) {
          yield { type: 'text', token: ttsBuffer, last: false };
          ttsBuffer = '';
        }
      }
    }

    // Flush remaining text
    if (ttsBuffer.trim()) {
      yield { type: 'text', token: ttsBuffer, last: false };
    }

    const finalMessage = await stream.finalMessage();

    // Check if the response contains tool use
    if (finalMessage.stop_reason === 'tool_use') {
      // Save the assistant message (with tool_use blocks) to history
      session.messages.push({ role: 'assistant', content: finalMessage.content });

      // Process each tool use block
      const toolResults: Array<{
        type: 'tool_result';
        tool_use_id: string;
        content: string;
      }> = [];

      let transferRequested = false;
      let transferReason = '';

      for (const block of finalMessage.content) {
        if (block.type !== 'tool_use') continue;

        if (block.name === 'transfer_call') {
          transferReason = (block.input as any)?.reason || 'Caller requested transfer';
          transferRequested = true;
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: 'Transfer initiated.',
          });
        } else if (block.name === 'search_listings') {
          const params = block.input as any;
          console.log(`Searching listings:`, params);
          try {
            const results = await this.listingsService.searchProperties(params);
            const formatted = this.listingsService.formatForConversation(results, params);
            console.log(`Found ${results.length} listings`);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: formatted,
            });
          } catch (err) {
            console.error('Listings search error:', err);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: 'Sorry, the listing search is temporarily unavailable. Offer to connect the caller with Joe instead.',
            });
          }
        }
      }

      // Add tool results to the conversation
      session.messages.push({ role: 'user', content: toolResults });

      // If transfer was requested, signal it after yielding the text spoken so far
      if (transferRequested) {
        yield { type: 'text', token: '', last: true };
        yield { type: 'transfer', reason: transferReason };
        return;
      }

      // For search_listings: stream a follow-up response from Claude with the results
      yield* this.runClaudeStream(session, abortController);
      return;
    }

    // No tool use — normal text response
    yield { type: 'text', token: '', last: true };

    if (fullResponse) {
      session.messages.push({ role: 'assistant', content: fullResponse });
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
