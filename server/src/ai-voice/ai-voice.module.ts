import { Module, Global } from '@nestjs/common';
import { AiVoiceService } from './ai-voice.service';
import { CallsModule } from '../calls/calls.module';
import { ContactsModule } from '../contacts/contacts.module';
import { ListingsModule } from '../listings/listings.module';
import { MessagesModule } from '../messages/messages.module';

@Global()
@Module({
  imports: [CallsModule, ContactsModule, ListingsModule, MessagesModule],
  providers: [AiVoiceService],
  exports: [AiVoiceService],
})
export class AiVoiceModule {}
