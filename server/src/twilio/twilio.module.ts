import { Module, Global } from '@nestjs/common';
import { TwilioService } from './twilio.service';
import { TwilioWebhookController } from './twilio-webhook.controller';
import { TwilioTokenController } from './twilio-token.controller';
import { CallsModule } from '../calls/calls.module';
import { MessagesModule } from '../messages/messages.module';
import { VoicemailModule } from '../voicemail/voicemail.module';
import { ContactsModule } from '../contacts/contacts.module';
import { ListingsModule } from '../listings/listings.module';
@Global()
@Module({
  imports: [
    CallsModule,
    MessagesModule,
    VoicemailModule,
    ContactsModule,
    ListingsModule,
  ],
  controllers: [TwilioWebhookController, TwilioTokenController],
  providers: [TwilioService],
  exports: [TwilioService],
})
export class TwilioModule {}
