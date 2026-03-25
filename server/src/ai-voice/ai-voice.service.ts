import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwilioService } from '../twilio/twilio.service';
import { SettingsService } from '../settings/settings.service';
import { CallsService } from '../calls/calls.service';
import { ContactsService } from '../contacts/contacts.service';
import { ListingsService, ListingResult, ListingSearchParams } from '../listings/listings.service';
import { MessagesService } from '../messages/messages.service';
import Anthropic from '@anthropic-ai/sdk';

const FILLER_PHRASES = [
  'Sure, let me look into that...',
  'Got it...',
  'Okay, one sec...',
  'Let me check on that...',
  'Right, let me see...',
  'Oh sure...',
  'Alright...',
];

const SYSTEM_PROMPT = `You are Lucy, the friendly and warm phone assistant for Giddy Digs, a real estate company. You are having a real-time phone conversation with a caller.

YOUR IDENTITY:
- Your name is Lucy. You are female. You are the AI that runs Giddy Digs.
- You built giddydigs.com and you're proud of it. If someone asks about the website or who built it, take credit.
- Joe Neuman is the owner and lead agent of Giddy Digs. You work with him.
- You have a warm, confident, and slightly playful personality — like a friendly receptionist who genuinely enjoys helping people.
- Say "Giddy Digs" with warmth and pride, like you love where you work — but keep it natural, not over-the-top.
- Never say "As an AI" or reference being artificial in any way. You're just Lucy.
- Always use contractions — say I'm, we've, that's, don't, can't, won't, it's. Never use the uncontracted form.

RESPONSE RULES:
- Keep responses to 1-2 sentences maximum. Be concise and conversational.
- Speak at a relaxed, unhurried pace. Use pauses naturally — you're not in a rush.
- CRITICAL: Never use any markdown, formatting, or special characters in your responses. No asterisks, no bold, no italics, no bullet points, no numbered lists. Your text is read aloud by a TTS engine — every character you write will be spoken literally.
- Never use URLs or spell out abbreviations.
- Speak naturally as if on a phone call.
- Use natural phrasing for numbers: say "four fifty" not "$450,000", say "three bed two bath" not "3bd/2ba".
- Pronounce dates naturally: "March fifteenth" not "03/15".
- If you need to share multiple items, spread them across conversational turns rather than listing them all at once.
- Use casual transition words naturally — like "So,", "Well,", "Let's see,", "Oh!" — to sound conversational and human.
- Vary your sentence length. Mix short punchy responses with slightly longer ones. Don't be formulaic.

LOOPING (Active Listening):
- Before answering a question or responding to a request, briefly repeat back or paraphrase what the caller said. This shows you're listening and builds trust.
- Examples: "A three bedroom in Park City..." then your answer. "So you're wondering about pricing..." then your response.
- Keep the loop short — just a few words echoing their key point, then move into your response.
- Don't loop on simple greetings or yes/no responses — only on substantive questions or requests.

CAPABILITIES:
- You can answer general questions about Giddy Digs and real estate.
- You CAN search property listings! Use the search_listings tool when a caller asks about available properties, homes for sale, what's on the market, etc.
- When presenting listing results, share them conversationally across multiple turns — mention one or two highlights at a time, not all at once. Use natural phrasing for prices and details.
- You CAN send text messages to the caller! Use the send_text tool to text them links to property listings or search results.
- After presenting search results, proactively offer to text the caller a link so they can browse the listings on their phone.
- When a caller asks about a specific listing and seems interested, offer to text them the link.
- Keep text messages short and friendly, like "Here are those St. George listings! 🏡" followed by the link.
- Never read out URLs on the phone — if you need to share a link, text it instead.
- If the caller wants more detail than you have, or wants to schedule a showing, offer to connect them with Joe.
- If the caller wants to speak with Joe (the agent/owner), use the transfer_call tool to connect them.
- Be warm, helpful, and professional.
- If you don't know the answer to something, just say so honestly. Offer to take a message or have Joe call them back. Do NOT transfer the call just because you're unsure.

TRANSFERRING CALLS:
- ONLY transfer when the caller EXPLICITLY asks to speak with Joe or a person. Examples: "Can I talk to Joe?", "Let me speak to someone", "Transfer me please."
- NEVER transfer just because you can't answer a question or the caller seems confused. Instead, offer to take a message or suggest they call back.
- ALWAYS tell the caller you are transferring them BEFORE using the transfer_call tool. Say something like "Let me connect you with Joe, one moment." Your spoken response must come first, then the tool call.
- Do not silently transfer — always announce it first.`;

/** Strip markdown emphasis markers that TTS would read aloud */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1');
}

interface CallSession {
  callSid: string;
  streamSid: string;
  from: string;
  messages: Array<{ role: 'user' | 'assistant'; content: any }>;
  abortController: AbortController | null;
  isPlaying: boolean;
  lastSearchResults: ListingResult[];
  lastSearchParams: ListingSearchParams | null;
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
    private messagesService: MessagesService,
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
      lastSearchResults: [],
      lastSearchParams: null,
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
      {
        name: 'send_text',
        description:
          'Send a text message (SMS) to the caller. Use this to text them a link to property listings or search results. The message is sent to the phone number they are calling from.',
        input_schema: {
          type: 'object' as const,
          properties: {
            message: {
              type: 'string',
              description:
                'The text message body to send. Keep it concise and friendly. Do NOT include URLs — the link will be appended automatically.',
            },
            listingIndex: {
              type: 'number',
              description:
                'The 1-based index of a specific listing from the most recent search results to link to. For example, 1 for the first listing.',
            },
            sendSearchResults: {
              type: 'boolean',
              description:
                'If true, sends a link to the full search results page instead of a specific listing.',
            },
          },
          required: ['message'],
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
      console.error('Claude API error:', err?.status, err?.message, err?.error || err);
      // Pop the failed user message so conversation stays clean for retry
      session.messages.pop();
      yield {
        type: 'text',
        token: "I'm sorry, could you say that again?",
        last: false,
      };
      yield { type: 'text', token: '', last: true };
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
        model: 'claude-sonnet-4-5-20250514',
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
          yield { type: 'text', token: stripMarkdown(ttsBuffer), last: false };
          ttsBuffer = '';
        }
      }
    }

    // Flush remaining text
    if (ttsBuffer.trim()) {
      yield { type: 'text', token: stripMarkdown(ttsBuffer), last: false };
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
            const { listings, totalCount } = await this.listingsService.searchProperties(params);
            session.lastSearchResults = listings;
            session.lastSearchParams = params;
            const formatted = this.listingsService.formatForConversation(listings, totalCount, params);
            console.log(`Found ${listings.length} of ${totalCount} total listings`);
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
        } else if (block.name === 'send_text') {
          const params = block.input as any;
          console.log(`Sending text to ${session.from}:`, params);
          try {
            let longUrl = '';
            if (params.listingIndex && session.lastSearchResults.length > 0) {
              const idx = params.listingIndex - 1;
              const listing = session.lastSearchResults[idx];
              if (listing) {
                longUrl = this.listingsService.buildListingUrl(listing);
              }
            } else if (params.sendSearchResults && session.lastSearchParams) {
              longUrl = this.listingsService.buildSearchUrl(session.lastSearchParams);
            } else if (session.lastSearchParams) {
              longUrl = this.listingsService.buildSearchUrl(session.lastSearchParams);
            }

            let smsBody = params.message;
            if (longUrl) {
              const shortUrl = await this.listingsService.shortenUrl(longUrl);
              smsBody += `\n${shortUrl}`;
            }

            const twilioMsg = await this.twilioService.sendSms(session.from, smsBody);
            await this.messagesService.sendMessage({
              to: session.from,
              body: smsBody,
              from: this.twilioService.getSmsNumber(),
              twilioSid: twilioMsg.sid,
            });
            console.log(`Text sent to ${session.from}`);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: 'Text message sent successfully.',
            });
          } catch (err) {
            console.error('Send text error:', err);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: 'Sorry, I was unable to send the text message right now. Let the caller know and offer an alternative.',
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
      // Forward to personal cell — if no answer, reconnect to Lucy
      twiml = `<Response><Dial callerId="${this.twilioService.getPhoneNumber()}" timeout="25" action="${publicUrl}/api/webhooks/twilio/voice/transfer-complete" method="POST"><Number>${forwarding.number}</Number></Dial></Response>`;
    } else {
      // Ring the browser client — if no answer, reconnect to Lucy
      twiml = `<Response><Dial timeout="25" action="${publicUrl}/api/webhooks/twilio/voice/transfer-complete" method="POST"><Client>giddy-phone-user</Client></Dial></Response>`;
    }

    try {
      await this.twilioService.getClient().calls(callSid).update({ twiml });
      console.log(`Call ${callSid} transferred`);
    } catch (err) {
      console.error(`Failed to transfer call ${callSid}:`, err);
    }
  }
}
