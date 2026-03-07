import { Controller, Get, Query } from '@nestjs/common';
import { TwilioService } from './twilio.service';

@Controller('token')
export class TwilioTokenController {
  constructor(private twilioService: TwilioService) {}

  @Get('voice')
  getVoiceToken(@Query('identity') identity: string) {
    const id = identity || 'giddy-phone-user';
    const token = this.twilioService.generateVoiceToken(id);
    return { token, identity: id };
  }
}
