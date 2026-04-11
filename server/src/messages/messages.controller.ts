import { Controller, Get, Post, Param, Body, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { ConfigService } from '@nestjs/config';
import { MessagesService } from './messages.service';
import { TwilioService } from '../twilio/twilio.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('messages')
export class MessagesController {
  constructor(
    private messagesService: MessagesService,
    private twilioService: TwilioService,
    private configService: ConfigService,
  ) {}

  @Get('conversations')
  getConversations() {
    return this.messagesService.getConversations();
  }

  @Get('by-phone/:phoneNumber')
  getMessagesByPhone(
    @Param('phoneNumber') phoneNumber: string,
    @Query('limit') limit?: string,
  ) {
    return this.messagesService.getMessagesByPhone(phoneNumber, limit ? parseInt(limit) : 50);
  }

  @Get('search')
  searchMessages(@Query('q') query: string, @Query('limit') limit?: string) {
    if (!query || query.trim().length < 2) return [];
    return this.messagesService.searchMessages(query.trim(), limit ? parseInt(limit) : 20);
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

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: 'uploads',
      filename: (_req, file, cb) => {
        const unique = randomUUID();
        const ext = extname(file.originalname);
        cb(null, `${unique}${ext}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  }))
  uploadMedia(@UploadedFile() file: Express.Multer.File) {
    const publicUrl = this.configService.get<string>('PUBLIC_URL') || '';
    return { url: `${publicUrl}/uploads/${file.filename}` };
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
