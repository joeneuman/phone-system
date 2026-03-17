import { Controller, Post, Req, Res, Body, Header } from '@nestjs/common';
import { Request, Response } from 'express';
import { TwilioService } from './twilio.service';
import { CallsService } from '../calls/calls.service';
import { MessagesService } from '../messages/messages.service';
import { VoicemailService } from '../voicemail/voicemail.service';
import { ContactsService } from '../contacts/contacts.service';
import { SettingsService } from '../settings/settings.service';
import { ConfigService } from '@nestjs/config';
const Twilio = require('twilio');
const VoiceResponse = Twilio.twiml.VoiceResponse;
const MessagingResponse = Twilio.twiml.MessagingResponse;

@Controller('webhooks/twilio')
export class TwilioWebhookController {
  constructor(
    private twilioService: TwilioService,
    private callsService: CallsService,
    private messagesService: MessagesService,
    private voicemailService: VoicemailService,
    private contactsService: ContactsService,
    private settingsService: SettingsService,
    private config: ConfigService,
  ) {}

  /**
   * Handles outbound calls initiated from the browser Voice SDK.
   * The TwiML App's Voice URL points here.
   */
  @Post('voice')
  async handleVoice(@Body() body: any, @Res() res: Response) {
    const twiml = new VoiceResponse();
    const to = body.To;

    if (to) {
      const dial = twiml.dial({
        callerId: this.twilioService.getPhoneNumber(),
        answerOnBridge: true,
      });

      if (to.startsWith('client:')) {
        dial.client(to.replace('client:', ''));
      } else {
        dial.number(to);
      }
    } else {
      twiml.say('No destination specified.');
    }

    res.type('text/xml');
    res.send(twiml.toString());
  }

  /**
   * Handles incoming calls to the Twilio phone number.
   * Routes to AI attendant if configured, otherwise rings browser/forwards.
   */
  @Post('voice/incoming')
  async handleIncomingVoice(@Body() body: any, @Res() res: Response) {
    const twiml = new VoiceResponse();
    const from = body.From;
    const callSid = body.CallSid;
    const publicUrl = this.twilioService.getPublicUrl();

    await this.callsService.logCall({
      sid: callSid,
      from,
      to: this.twilioService.getPhoneNumber(),
      direction: 'inbound',
      status: 'ringing',
    });

    const hasAiKey = !!this.config.get<string>('ANTHROPIC_API_KEY');

    if (hasAiKey) {
      // Route to AI attendant via ConversationRelay
      const connect = twiml.connect();
      const wsUrl = publicUrl.replace(/^https?:\/\//, 'wss://') + '/ws/conversation-relay';
      connect.conversationRelay({
        url: wsUrl,
        language: 'en-US',
        interruptible: 'true',
        welcomeGreeting: "Giddy Digs! This is Lucy, how can I help you?",
      });
    } else {
      // Fallback: no AI key — use direct routing
      const forwarding = await this.settingsService.get('callForwarding');

      if (forwarding?.enabled && forwarding?.number) {
        const dial = twiml.dial({
          callerId: from,
          timeout: 25,
          action: `${publicUrl}/api/webhooks/twilio/voice/complete`,
          method: 'POST',
        });
        dial.number(forwarding.number);
      } else {
        const dial = twiml.dial({
          timeout: 25,
          action: `${publicUrl}/api/webhooks/twilio/voice/complete`,
          method: 'POST',
        });
        dial.client('giddy-phone-user');
      }
    }

    res.type('text/xml');
    res.send(twiml.toString());
  }

  /**
   * Called after dial attempt completes. If the call wasn't answered,
   * send to voicemail.
   */
  @Post('voice/complete')
  async handleVoiceComplete(@Body() body: any, @Res() res: Response) {
    const twiml = new VoiceResponse();
    const dialStatus = body.DialCallStatus;
    const publicUrl = this.twilioService.getPublicUrl();

    if (['no-answer', 'busy', 'failed', 'canceled'].includes(dialStatus)) {
      twiml.say(
        { voice: 'Polly.Joanna' },
        "Hey, you've reached Giddy Digs. Leave a message after the beep and we'll get back to you.",
      );
      twiml.record({
        maxLength: 120,
        action: `${publicUrl}/api/webhooks/twilio/voicemail/complete`,
        transcribe: true,
        transcribeCallback: `${publicUrl}/api/webhooks/twilio/voicemail/transcription`,
        playBeep: true,
      });
      twiml.say('We did not receive a recording. Goodbye.');
    } else {
      twiml.hangup();
    }

    res.type('text/xml');
    res.send(twiml.toString());
  }

  /**
   * Called when a call status changes (ringing, in-progress, completed, etc.)
   */
  @Post('voice/status')
  async handleVoiceStatus(@Body() body: any) {
    await this.callsService.updateCallStatus(body.CallSid, {
      status: body.CallStatus,
      duration: body.CallDuration ? parseInt(body.CallDuration) : undefined,
    });
    return { ok: true };
  }

  /**
   * Handles incoming SMS messages
   */
  @Post('sms')
  async handleIncomingSms(@Body() body: any, @Res() res: Response) {
    const from = body.From;
    const msgBody = body.Body || '';
    const numMedia = parseInt(body.NumMedia || '0');
    const mediaUrls: string[] = [];

    for (let i = 0; i < numMedia; i++) {
      mediaUrls.push(body[`MediaUrl${i}`]);
    }

    await this.messagesService.receiveMessage({
      from,
      to: this.twilioService.getPhoneNumber(),
      body: msgBody,
      mediaUrls,
      twilioSid: body.MessageSid,
    });

    // Forward SMS to personal cell if forwarding is enabled
    const forwarding = await this.settingsService.get('callForwarding');
    if (forwarding?.enabled && forwarding?.number) {
      const forwardBody = `[Fwd from ${from}] ${msgBody}`;
      try {
        await this.twilioService.sendSms(forwarding.number, forwardBody, mediaUrls.length ? mediaUrls : undefined);
      } catch (e) {
        console.error('Failed to forward SMS:', e);
      }
    }

    const twiml = new MessagingResponse();
    res.type('text/xml');
    res.send(twiml.toString());
  }

  /**
   * Called when a voicemail recording is complete
   */
  @Post('voicemail/complete')
  async handleVoicemailComplete(@Body() body: any, @Res() res: Response) {
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Joanna' }, 'Thanks for your message. Goodbye.');
    twiml.hangup();

    if (body.RecordingSid) {
      await this.voicemailService.saveVoicemail({
        callSid: body.CallSid,
        recordingSid: body.RecordingSid,
        recordingUrl: body.RecordingUrl,
        from: body.From,
        duration: parseInt(body.RecordingDuration || '0'),
      });
    }

    res.type('text/xml');
    res.send(twiml.toString());
  }

  /**
   * Receives voicemail transcription from Twilio
   */
  @Post('voicemail/transcription')
  async handleTranscription(@Body() body: any) {
    if (body.RecordingSid && body.TranscriptionText) {
      await this.voicemailService.updateTranscription(
        body.RecordingSid,
        body.TranscriptionText,
      );
    }
    return { ok: true };
  }
}
