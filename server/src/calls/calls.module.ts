import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CallLog, CallLogSchema } from './schemas/call-log.schema';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';
import { ContactsModule } from '../contacts/contacts.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CallLog.name, schema: CallLogSchema }]),
    ContactsModule,
  ],
  controllers: [CallsController],
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}
