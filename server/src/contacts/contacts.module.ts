import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Contact, ContactSchema } from './schemas/contact.schema';
import { DedupReview, DedupReviewSchema } from './schemas/dedup-review.schema';
import { Conversation, ConversationSchema } from '../messages/schemas/conversation.schema';
import { CallLog, CallLogSchema } from '../calls/schemas/call-log.schema';
import { Voicemail, VoicemailSchema } from '../voicemail/schemas/voicemail.schema';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contact.name, schema: ContactSchema },
      { name: DedupReview.name, schema: DedupReviewSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: CallLog.name, schema: CallLogSchema },
      { name: Voicemail.name, schema: VoicemailSchema },
    ]),
  ],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
