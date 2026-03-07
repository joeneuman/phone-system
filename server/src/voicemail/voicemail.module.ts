import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Voicemail, VoicemailSchema } from './schemas/voicemail.schema';
import { VoicemailService } from './voicemail.service';
import { VoicemailController } from './voicemail.controller';
import { ContactsModule } from '../contacts/contacts.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Voicemail.name, schema: VoicemailSchema }]),
    ContactsModule,
  ],
  controllers: [VoicemailController],
  providers: [VoicemailService],
  exports: [VoicemailService],
})
export class VoicemailModule {}
