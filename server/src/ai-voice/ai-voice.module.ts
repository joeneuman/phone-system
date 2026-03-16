import { Module, Global } from '@nestjs/common';
import { AiVoiceService } from './ai-voice.service';

@Global()
@Module({
  providers: [AiVoiceService],
  exports: [AiVoiceService],
})
export class AiVoiceModule {}
