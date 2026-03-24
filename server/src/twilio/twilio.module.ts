import { Module, Global } from '@nestjs/common';
import { TwilioService } from './twilio.service';
import { TwilioWebhookController } from './twilio-webhook.controller';
import { TwilioTokenController } from './twilio-token.controller';
import { CallsModule } from '../calls/calls.module';
import { MessagesModule } from '../messages/messages.module';
import { VoicemailModule } from '../voicemail/voicemail.module';
import { ContactsModule } from '../contacts/contacts.module';
@Global()
@Module({
  imports: [
    CallsModule,
    MessagesModule,
    VoicemailModule,
    ContactsModule,
  ],
  controllers: [TwilioWebhookController, TwilioTokenController],
  providers: [TwilioService],
  exports: [TwilioService],
})
export class TwilioModule {}
