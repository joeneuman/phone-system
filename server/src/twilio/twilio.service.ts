import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as TwilioLib from 'twilio';
const Twilio = require('twilio');

@Injectable()
export class TwilioService implements OnModuleInit {
  private client: ReturnType<typeof Twilio>;
  private accountSid: string;
  private authToken: string;
  private apiKey: string;
  private apiSecret: string;
  private twimlAppSid: string;
  private phoneNumber: string;
  private smsNumber: string;
  private publicUrl: string;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    this.accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID') || '';
    this.authToken = this.config.get<string>('TWILIO_AUTH_TOKEN') || '';
    this.apiKey = this.config.get<string>('TWILIO_API_KEY') || '';
    this.apiSecret = this.config.get<string>('TWILIO_API_SECRET') || '';
    this.twimlAppSid = this.config.get<string>('TWILIO_TWIML_APP_SID') || '';
    this.phoneNumber = this.config.get<string>('TWILIO_PHONE_NUMBER') || '';
    this.smsNumber = this.config.get<string>('TWILIO_SMS_NUMBER') || this.phoneNumber;
    this.publicUrl = this.config.get<string>('PUBLIC_URL') || '';
    this.client = Twilio(this.accountSid, this.authToken);
  }

  getClient() {
    return this.client;
  }

  getPhoneNumber(): string {
    return this.phoneNumber;
  }

  getPublicUrl(): string {
    return this.publicUrl;
  }

  generateVoiceToken(identity: string): string {
    const AccessToken = TwilioLib.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: this.twimlAppSid,
      incomingAllow: true,
    });

    const token = new AccessToken(
      this.accountSid,
      this.apiKey,
      this.apiSecret,
      { identity },
    );
    token.addGrant(voiceGrant);
    return token.toJwt();
  }

  getSmsNumber(): string {
    return this.smsNumber;
  }

  async sendSms(to: string, body: string, mediaUrls?: string[]): Promise<any> {
    const opts: any = {
      to,
      from: this.smsNumber,
      body,
    };
    if (mediaUrls?.length) {
      opts.mediaUrl = mediaUrls;
    }
    return this.client.messages.create(opts);
  }

  async getRecordingUrl(recordingSid: string): Promise<string> {
    const recording = await this.client.recordings(recordingSid).fetch();
    return `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;
  }

  validateTwilioRequest(signature: string, url: string, params: Record<string, string>): boolean {
    return TwilioLib.validateRequest(this.authToken, signature, url, params);
  }
}
