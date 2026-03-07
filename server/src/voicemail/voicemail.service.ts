import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Voicemail } from './schemas/voicemail.schema';
import { ContactsService } from '../contacts/contacts.service';

@Injectable()
export class VoicemailService {
  private eventCallback: (event: string, data: any) => void;

  constructor(
    @InjectModel(Voicemail.name) private voicemailModel: Model<Voicemail>,
    private contactsService: ContactsService,
  ) {}

  setEventCallback(cb: (event: string, data: any) => void) {
    this.eventCallback = cb;
  }

  private emit(event: string, data: any) {
    if (this.eventCallback) this.eventCallback(event, data);
  }

  async saveVoicemail(data: {
    callSid: string;
    recordingSid: string;
    recordingUrl: string;
    from: string;
    duration: number;
  }): Promise<Voicemail> {
    const contactName = await this.contactsService.resolveContactName(data.from);
    const contact = await this.contactsService.findByPhone(data.from);

    const vm = await this.voicemailModel.create({
      ...data,
      contactName,
      contact: contact?._id,
    });

    this.emit('voicemail:new', vm);
    return vm;
  }

  async updateTranscription(recordingSid: string, transcription: string): Promise<void> {
    const vm = await this.voicemailModel
      .findOneAndUpdate({ recordingSid }, { transcription }, { new: true })
      .exec();
    if (vm) {
      this.emit('voicemail:transcribed', vm);
    }
  }

  async getAll(limit = 50): Promise<Voicemail[]> {
    return this.voicemailModel.find().sort({ createdAt: -1 }).limit(limit).exec();
  }

  async markListened(id: string): Promise<void> {
    await this.voicemailModel.findByIdAndUpdate(id, { listened: true }).exec();
  }

  async delete(id: string): Promise<void> {
    await this.voicemailModel.findByIdAndDelete(id).exec();
  }

  async getUnlistenedCount(): Promise<number> {
    return this.voicemailModel.countDocuments({ listened: false }).exec();
  }
}
