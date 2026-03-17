import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TwilioModule } from './twilio/twilio.module';
import { ContactsModule } from './contacts/contacts.module';
import { MessagesModule } from './messages/messages.module';
import { CallsModule } from './calls/calls.module';
import { VoicemailModule } from './voicemail/voicemail.module';
import { SettingsModule } from './settings/settings.module';
import { AiVoiceModule } from './ai-voice/ai-voice.module';
import { ListingsModule } from './listings/listings.module';
import { PhoneGateway } from './phone.gateway';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/giddy-phone'),
    TwilioModule,
    ContactsModule,
    MessagesModule,
    CallsModule,
    VoicemailModule,
    SettingsModule,
    AiVoiceModule,
    ListingsModule,
  ],
  controllers: [HealthController],
  providers: [PhoneGateway],
})
export class AppModule {}
