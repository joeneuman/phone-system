import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { TwilioService } from '../twilio/twilio.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('messages')
export class MessagesController {
  constructor(
    private messagesService: MessagesService,
    private twilioService: TwilioService,
  ) {}

  @Get('conversations')
  getConversations() {
    return this.messagesService.getConversations();
  }

  @Get('conversations/:id/messages')
  getMessages(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.messagesService.getMessages(id, limit ? parseInt(limit) : 50, before);
  }

  @Post('conversations/:id/read')
  markRead(@Param('id') id: string) {
    return this.messagesService.markConversationRead(id);
  }

  @Post('send')
  async sendMessage(@Body() dto: SendMessageDto) {
    const twilioMsg = await this.twilioService.sendSms(dto.to, dto.body, dto.mediaUrls);

    return this.messagesService.sendMessage({
      to: dto.to,
      body: dto.body,
      from: this.twilioService.getSmsNumber(),
      mediaUrls: dto.mediaUrls,
      twilioSid: twilioMsg.sid,
    });
  }
}
