import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contact } from './schemas/contact.schema';
import { CreateContactDto, UpdateContactDto, SyncContactDto } from './dto/create-contact.dto';

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

  async bulkSync(contacts: SyncContactDto[]): Promise<{ created: number; updated: number; skipped: number }> {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const dto of contacts) {
      try {
        if (!dto.phoneNumber || !dto.metadata?.source) {
          skipped++;
          continue;
        }

        const existing = await this.findByPhone(dto.phoneNumber);

        if (existing) {
          // Update if: previously synced from giddydigs, OR is a placeholder (no name, no source)
          const isPlaceholder = !existing.firstName && !existing.metadata?.source;
          if (existing.metadata?.source === 'giddydigs' || isPlaceholder) {
            await this.contactModel.updateOne(
              { _id: existing._id },
              {
                $set: {
                  firstName: dto.firstName || existing.firstName,
                  lastName: dto.lastName || existing.lastName,
                  company: dto.company || existing.company,
                  email: dto.email || existing.email,
                  notes: dto.notes || existing.notes,
                  metadata: { ...dto.metadata, lastSyncedAt: new Date() },
                },
              },
            );
            updated++;
          } else {
            skipped++; // Manual contact with real data — don't overwrite
          }
        } else {
          await this.contactModel.create({
            ...dto,
            metadata: { ...dto.metadata, lastSyncedAt: new Date() },
          });
          created++;
        }
      } catch (err) {
        console.error(`Contact sync failed for ${dto.phoneNumber}:`, err?.message || err);
        skipped++;
      }
    }

    return { created, updated, skipped };
  }
}
