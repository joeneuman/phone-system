import { Controller, Get, Post, Delete, Param, Query } from '@nestjs/common';
import { VoicemailService } from './voicemail.service';

@Controller('voicemail')
export class VoicemailController {
  constructor(private voicemailService: VoicemailService) {}

  @Get()
  getAll(@Query('limit') limit?: string) {
    return this.voicemailService.getAll(limit ? parseInt(limit) : 50);
  }

  @Get('unread-count')
  getUnlistenedCount() {
    return this.voicemailService.getUnlistenedCount();
  }

  @Post(':id/listened')
  markListened(@Param('id') id: string) {
    return this.voicemailService.markListened(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.voicemailService.delete(id);
  }
}
