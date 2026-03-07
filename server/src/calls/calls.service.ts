import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CallLog } from './schemas/call-log.schema';
import { ContactsService } from '../contacts/contacts.service';

@Injectable()
export class CallsService {
  private eventCallback: (event: string, data: any) => void;

  constructor(
    @InjectModel(CallLog.name) private callLogModel: Model<CallLog>,
    private contactsService: ContactsService,
  ) {}

  setEventCallback(cb: (event: string, data: any) => void) {
    this.eventCallback = cb;
  }

  private emit(event: string, data: any) {
    if (this.eventCallback) this.eventCallback(event, data);
  }

  async logCall(data: {
    sid: string;
    from: string;
    to: string;
    direction: string;
    status: string;
  }): Promise<CallLog> {
    const remoteNumber = data.direction === 'inbound' ? data.from : data.to;
    const contactName = await this.contactsService.resolveContactName(remoteNumber);
    const contact = await this.contactsService.findByPhone(remoteNumber);

    const callLog = await this.callLogModel.create({
      ...data,
      contactName,
      contact: contact?._id,
    });

    this.emit('call:new', callLog);
    return callLog;
  }

  async updateCallStatus(sid: string, update: { status: string; duration?: number }): Promise<void> {
    const log = await this.callLogModel.findOneAndUpdate({ sid }, update, { new: true }).exec();
    if (log) {
      this.emit('call:status', log);
    }
  }

  async getCallHistory(limit = 50, offset = 0): Promise<CallLog[]> {
    return this.callLogModel
      .find()
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }

  async getCallsByPhone(phoneNumber: string): Promise<CallLog[]> {
    return this.callLogModel
      .find({ $or: [{ from: phoneNumber }, { to: phoneNumber }] })
      .sort({ createdAt: -1 })
      .exec();
  }
}
