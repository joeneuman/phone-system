import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Setting } from './schemas/setting.schema';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Setting.name) private settingModel: Model<Setting>,
  ) {}

  async get(key: string): Promise<any> {
    const doc = await this.settingModel.findOne({ key }).exec();
    return doc ? doc.value : null;
  }

  async set(key: string, value: any): Promise<Setting> {
    return this.settingModel.findOneAndUpdate(
      { key },
      { key, value },
      { upsert: true, new: true },
    ).exec();
  }

  async isForwardingEnabled(): Promise<boolean> {
    const val = await this.get('callForwarding');
    return val?.enabled === true;
  }

  async getForwardingNumber(): Promise<string | null> {
    const val = await this.get('callForwarding');
    return val?.number || null;
  }
}
