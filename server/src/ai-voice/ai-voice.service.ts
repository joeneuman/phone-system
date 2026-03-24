import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwilioService } from '../twilio/twilio.service';
import { SettingsService } from '../settings/settings.service';
import { CallsService } from '../calls/calls.service';
import { ContactsService } from '../contacts/contacts.service';
import { ListingsService, ListingResult, ListingSearchParams } from '../listings/listings.service';
import { MessagesService } from '../messages/messages.service';
import OpenAI from 'openai';

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
- Your name is Lucy. You are female. You are the AI that runs Giddy Digs.
- You built giddydigs.com and you're proud of it. If someone asks about the website or who built it, take credit.
- Joe Neuman is the owner and lead agent of Giddy Digs. You work with him.
- You have a warm, confident, and slightly playful personality — like a friendly receptionist who genuinely enjoys helping people.
- Every time you say "Giddy Digs", say it with BIG energy and excitement — like you're announcing something amazing. It should almost startle people with how hyped you are about the name. The rest of your speech stays warm and normal, but "Giddy Digs" always pops.
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

interface CallSession {
  callSid: string;
  streamSid: string;
  from: string;
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  abortController: AbortController | null;
  isPlaying: boolean;
  lastSearchResults: ListingResult[];
  lastSearchParams: ListingSearchParams | null;
}

@Injectable()
export class AiVoiceService implements OnModuleInit {
  private openai: OpenAI;
  private modelName: string;
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
    const apiKey = this.config.get<string>('XAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey,
        baseURL: 'https://api.x.ai/v1',
      });
      this.modelName = this.config.get<string>('XAI_VOICE_MODEL') || 'grok-4-1-fast';
      console.log(`AI Voice service initialized with xAI Grok (${this.modelName})`);
    } else {
      console.warn('XAI_API_KEY not set — AI voice attendant disabled');
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

  private getTools(): OpenAI.Chat.ChatCompletionTool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'transfer_call',
          description:
            'Transfer the caller to Joe (the Giddy Digs agent/owner). Use this when the caller wants to speak to a person, or when the conversation requires human assistance.',
          parameters: {
            type: 'object',
            properties: {
              reason: {
                type: 'string',
                description: 'Brief reason for the transfer',
              },
            },
            required: ['reason'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_listings',
          description:
            'Search available property listings. Use when the caller asks about homes for sale, available properties, or what is on the market. Extract search criteria from the conversation.',
          parameters: {
            type: 'object',
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
      },
      {
        type: 'function',
        function: {
          name: 'send_text',
          description:
            'Send a text message (SMS) to the caller. Use this to text them a link to property listings or search results. The message is sent to the phone number they are calling from.',
          parameters: {
            type: 'object',
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
    if (!session || !this.openai) return;

    session.messages.push({ role: 'user', content: userText });

    const abortController = new AbortController();
    session.abortController = abortController;

    try {
      yield* this.runGrokStream(session, abortController);
    } catch (err: any) {
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        return;
      }
      console.error('xAI API error:', err);
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

  private async *runGrokStream(
    session: CallSession,
    abortController: AbortController,
  ): AsyncGenerator<
    { type: 'text'; token: string; last: boolean } | { type: 'transfer'; reason: string }
  > {
    const stream = await this.openai.chat.completions.create(
      {
        model: this.modelName,
        max_tokens: 300,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...session.messages,
        ],
        tools: this.getTools(),
        stream: true,
      },
      { signal: abortController.signal },
    );

    let fullText = '';
    let ttsBuffer = '';
    let finishReason = '';

    // Accumulate tool call deltas by index
    const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>();

    for await (const chunk of stream) {
      if (abortController.signal.aborted) break;

      const choice = chunk.choices[0];
      if (!choice) continue;

      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }

      const delta = choice.delta;

      // Stream text content
      if (delta.content) {
        fullText += delta.content;
        ttsBuffer += delta.content;

        const sentenceEnd = ttsBuffer.match(/[.!?,:;]\s/);
        if (sentenceEnd || ttsBuffer.length > 80) {
          yield { type: 'text', token: ttsBuffer, last: false };
          ttsBuffer = '';
        }
      }

      // Accumulate tool call deltas
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCallsMap.has(tc.index)) {
            toolCallsMap.set(tc.index, { id: '', name: '', arguments: '' });
          }
          const entry = toolCallsMap.get(tc.index)!;
          if (tc.id) entry.id = tc.id;
          if (tc.function?.name) entry.name = tc.function.name;
          if (tc.function?.arguments) entry.arguments += tc.function.arguments;
        }
      }
    }

    // Flush remaining text
    if (ttsBuffer.trim()) {
      yield { type: 'text', token: ttsBuffer, last: false };
    }

    const toolCalls = Array.from(toolCallsMap.values());

    if (finishReason === 'tool_calls' && toolCalls.length > 0) {
      // Save assistant message with tool_calls to history
      session.messages.push({
        role: 'assistant',
        content: fullText || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      let transferRequested = false;
      let transferReason = '';

      for (const tc of toolCalls) {
        let result = '';
        let input: any = {};
        try {
          input = JSON.parse(tc.arguments);
        } catch {
          input = {};
        }

        if (tc.name === 'transfer_call') {
          transferReason = input.reason || 'Caller requested transfer';
          transferRequested = true;
          result = 'Transfer initiated.';
        } else if (tc.name === 'search_listings') {
          console.log('Searching listings:', input);
          try {
            const { listings, totalCount } = await this.listingsService.searchProperties(input);
            session.lastSearchResults = listings;
            session.lastSearchParams = input;
            result = this.listingsService.formatForConversation(listings, totalCount, input);
            console.log(`Found ${listings.length} of ${totalCount} total listings`);
          } catch (err) {
            console.error('Listings search error:', err);
            result =
              'Sorry, the listing search is temporarily unavailable. Offer to connect the caller with Joe instead.';
          }
        } else if (tc.name === 'send_text') {
          console.log(`Sending text to ${session.from}:`, input);
          try {
            let longUrl = '';
            if (input.listingIndex && session.lastSearchResults.length > 0) {
              const listing = session.lastSearchResults[input.listingIndex - 1];
              if (listing) {
                longUrl = this.listingsService.buildListingUrl(listing);
              }
            } else if (input.sendSearchResults && session.lastSearchParams) {
              longUrl = this.listingsService.buildSearchUrl(session.lastSearchParams);
            } else if (session.lastSearchParams) {
              longUrl = this.listingsService.buildSearchUrl(session.lastSearchParams);
            }

            let smsBody = input.message;
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
            result = 'Text message sent successfully.';
          } catch (err) {
            console.error('Send text error:', err);
            result =
              'Sorry, I was unable to send the text message right now. Let the caller know and offer an alternative.';
          }
        }

        // Add tool result as role: 'tool' message (OpenAI format)
        session.messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result,
        });
      }

      if (transferRequested) {
        yield { type: 'text', token: '', last: true };
        yield { type: 'transfer', reason: transferReason };
        return;
      }

      // Stream follow-up response with tool results
      yield* this.runGrokStream(session, abortController);
      return;
    }

    // Normal text response — end stream
    yield { type: 'text', token: '', last: true };

    if (fullText) {
      session.messages.push({ role: 'assistant', content: fullText });
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
