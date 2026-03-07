import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contact } from './schemas/contact.schema';
import { CreateContactDto, UpdateContactDto } from './dto/create-contact.dto';

@Injectable()
export class ContactsService {
  constructor(@InjectModel(Contact.name) private contactModel: Model<Contact>) {}

  async findAll(search?: string): Promise<Contact[]> {
    if (search) {
      return this.contactModel
        .find({ $text: { $search: search } })
        .sort({ firstName: 1, lastName: 1 })
        .exec();
    }
    return this.contactModel.find().sort({ favorite: -1, firstName: 1, lastName: 1 }).exec();
  }

  async findByPhone(phoneNumber: string) {
    return this.contactModel.findOne({ phoneNumber }).exec();
  }

  async findById(id: string) {
    return this.contactModel.findById(id).exec();
  }

  async create(dto: CreateContactDto) {
    return this.contactModel.create(dto);
  }

  async update(id: string, dto: UpdateContactDto) {
    return this.contactModel.findByIdAndUpdate(id, dto, { new: true }).exec();
  }

  async delete(id: string): Promise<void> {
    await this.contactModel.findByIdAndDelete(id).exec();
  }

  async getOrCreatePlaceholder(phoneNumber: string): Promise<Contact> {
    let contact = await this.findByPhone(phoneNumber);
    if (!contact) {
      contact = await this.contactModel.create({ phoneNumber });
    }
    return contact;
  }

  async resolveContactName(phoneNumber: string): Promise<string> {
    const contact = await this.findByPhone(phoneNumber);
    if (contact?.firstName) {
      return [contact.firstName, contact.lastName].filter(Boolean).join(' ');
    }
    return phoneNumber;
  }
}
