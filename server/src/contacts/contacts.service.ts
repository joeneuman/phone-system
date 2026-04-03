import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contact } from './schemas/contact.schema';
import { DedupReview } from './schemas/dedup-review.schema';
import { Conversation } from '../messages/schemas/conversation.schema';
import { CallLog } from '../calls/schemas/call-log.schema';
import { Voicemail } from '../voicemail/schemas/voicemail.schema';
import { CreateContactDto, UpdateContactDto, SyncContactDto } from './dto/create-contact.dto';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class ContactsService implements OnModuleInit {
  constructor(
    @InjectModel(Contact.name) private contactModel: Model<Contact>,
    @InjectModel(DedupReview.name) private dedupReviewModel: Model<DedupReview>,
    @InjectModel(Conversation.name) private conversationModel: Model<Conversation>,
    @InjectModel(CallLog.name) private callLogModel: Model<CallLog>,
    @InjectModel(Voicemail.name) private voicemailModel: Model<Voicemail>,
  ) {}

  onModuleInit() {
    // Run dedup 30s after startup, then weekly
    setTimeout(() => this.dedup(), 30_000);
    setInterval(() => this.dedup(), ONE_WEEK_MS);
    console.log('Contact dedup scheduled: on startup + weekly');
  }

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
    return this.contactModel.findOne({
      $or: [{ phoneNumber }, { 'additionalPhoneNumbers.number': phoneNumber }],
    }).exec();
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

  async findByGiddydigsUserId(userId: string) {
    return this.contactModel.findOne({ 'metadata.giddydigsUserId': userId }).exec();
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

        // Match by giddydigsUserId first (handles phone number changes), then fall back to phone
        const giddydigsUserId = dto.metadata?.giddydigsUserId;
        let existing = giddydigsUserId
          ? await this.findByGiddydigsUserId(giddydigsUserId)
          : null;
        if (!existing) {
          existing = await this.findByPhone(dto.phoneNumber);
        }

        if (existing) {
          // Update if: previously synced from giddydigs, OR is a placeholder (no name, no source)
          const isPlaceholder = !existing.firstName && !existing.metadata?.source;
          if (existing.metadata?.source === 'giddydigs' || isPlaceholder) {
            // If phone number changed, handle the unique index constraint
            const phoneChanged = existing.phoneNumber !== dto.phoneNumber;
            if (phoneChanged) {
              // Remove any placeholder sitting at the new phone number
              const blocker = await this.findByPhone(dto.phoneNumber);
              if (blocker && blocker._id.toString() !== existing._id.toString()) {
                const blockerIsPlaceholder = !blocker.firstName && !blocker.metadata?.source;
                if (blockerIsPlaceholder || blocker.metadata?.source === 'giddydigs') {
                  await this.contactModel.deleteOne({ _id: blocker._id });
                }
              }
            }

            await this.contactModel.updateOne(
              { _id: existing._id },
              {
                $set: {
                  phoneNumber: dto.phoneNumber,
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

  // ── Dedup ────────────────────────────────────────────────────────

  async dedup(): Promise<{ autoResolved: number; flaggedForReview: number }> {
    console.log('Running contact dedup...');
    let autoResolved = 0;
    let flaggedForReview = 0;

    try {
      // Pass 1: Auto-merge contacts with same giddydigsUserId
      const userIdDupes = await this.contactModel.aggregate([
        { $match: { 'metadata.giddydigsUserId': { $exists: true, $ne: null } } },
        { $group: { _id: '$metadata.giddydigsUserId', ids: { $push: '$_id' }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ]);

      for (const group of userIdDupes) {
        const contacts = await this.contactModel.find({ _id: { $in: group.ids } }).exec();
        // Keep the most recently synced one
        contacts.sort((a, b) => {
          const aTime = a.metadata?.lastSyncedAt ? new Date(a.metadata.lastSyncedAt).getTime() : 0;
          const bTime = b.metadata?.lastSyncedAt ? new Date(b.metadata.lastSyncedAt).getTime() : 0;
          return bTime - aTime;
        });

        const keeper = contacts[0];
        const dupes = contacts.slice(1);

        for (const dupe of dupes) {
          // Merge favorite flag
          if (dupe.favorite && !keeper.favorite) {
            await this.contactModel.updateOne({ _id: keeper._id }, { $set: { favorite: true } });
          }
          await this.contactModel.deleteOne({ _id: dupe._id });
          autoResolved++;
        }
      }

      // Pass 2: Auto-merge synced contact + placeholder with same phone number
      const phoneDupes = await this.contactModel.aggregate([
        { $group: { _id: '$phoneNumber', ids: { $push: '$_id' }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ]);

      for (const group of phoneDupes) {
        const contacts = await this.contactModel.find({ _id: { $in: group.ids } }).exec();
        const synced = contacts.filter(c => c.metadata?.source === 'giddydigs');
        const placeholders = contacts.filter(c => !c.firstName && !c.metadata?.source);

        if (synced.length === 1 && placeholders.length > 0) {
          // Auto-merge: delete placeholders, keep the synced one
          for (const ph of placeholders) {
            await this.contactModel.deleteOne({ _id: ph._id });
            autoResolved++;
          }
        } else if (contacts.length > 1) {
          // Flag for manual review — different sources or multiple synced
          await this.flagForReview(contacts, 'same-phone-different-source');
          flaggedForReview++;
        }
      }

      // Pass 3: Flag same first+last name with different phone numbers
      const nameDupes = await this.contactModel.aggregate([
        { $match: { firstName: { $exists: true, $ne: '' } } },
        {
          $group: {
            _id: { firstName: { $toLower: '$firstName' }, lastName: { $toLower: { $ifNull: ['$lastName', ''] } } },
            ids: { $push: '$_id' },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ]);

      for (const group of nameDupes) {
        const contacts = await this.contactModel.find({ _id: { $in: group.ids } }).exec();
        const phones = new Set(contacts.map(c => c.phoneNumber));
        if (phones.size > 1) {
          // Different phone numbers — might be same person with new number, or different people
          await this.flagForReview(contacts, 'same-name-different-phone');
          flaggedForReview++;
        }
      }
    } catch (err) {
      console.error('Dedup error:', err?.message || err);
    }

    console.log(`Dedup complete: ${autoResolved} auto-resolved, ${flaggedForReview} flagged for review`);
    return { autoResolved, flaggedForReview };
  }

  private async flagForReview(contacts: Contact[], reason: string) {
    // Create review pairs (first contact paired with each subsequent one)
    const base = contacts[0];
    for (let i = 1; i < contacts.length; i++) {
      const ids = [base._id, contacts[i]._id].sort((a, b) => a.toString().localeCompare(b.toString()));
      try {
        await this.dedupReviewModel.updateOne(
          { contactA: ids[0], contactB: ids[1] },
          { $setOnInsert: { contactA: ids[0], contactB: ids[1], reason, status: 'pending' } },
          { upsert: true },
        );
      } catch (err) {
        // Duplicate key — already flagged
      }
    }
  }

  async getPendingReviews() {
    const reviews = await this.dedupReviewModel.find({ status: 'pending' }).exec();
    const populated: Array<{ reviewId: any; reason: string; contactA: Contact; contactB: Contact }> = [];
    for (const review of reviews) {
      const contactA = await this.contactModel.findById(review.contactA).exec();
      const contactB = await this.contactModel.findById(review.contactB).exec();
      // Skip if either contact was already deleted
      if (!contactA || !contactB) {
        await this.dedupReviewModel.updateOne({ _id: review._id }, { $set: { status: 'dismissed' } });
        continue;
      }
      populated.push({
        reviewId: review._id,
        reason: review.reason,
        contactA,
        contactB,
      });
    }
    return populated;
  }

  async resolveReview(reviewId: string, action: 'merge' | 'dismiss', keepContactId?: string) {
    const review = await this.dedupReviewModel.findById(reviewId).exec();
    if (!review || review.status !== 'pending') return { ok: false, message: 'Review not found or already resolved' };

    if (action === 'dismiss') {
      await this.dedupReviewModel.updateOne({ _id: review._id }, { $set: { status: 'dismissed' } });
      return { ok: true, action: 'dismissed' };
    }

    if (action === 'merge') {
      // Auto-pick keeper if not specified: prefer the contact with more populated fields
      let keepId: string;
      if (keepContactId) {
        keepId = keepContactId;
      } else {
        const a = await this.contactModel.findById(review.contactA).exec();
        const b = await this.contactModel.findById(review.contactB).exec();
        const countFields = (c: any) => {
          if (!c) return 0;
          return ['firstName', 'lastName', 'company', 'email', 'notes'].filter(f => c[f]).length;
        };
        keepId = countFields(a) >= countFields(b)
          ? review.contactA.toString()
          : review.contactB.toString();
      }

      const deleteId = review.contactA.toString() === keepId
        ? review.contactB.toString()
        : review.contactA.toString();

      const toDelete = await this.contactModel.findById(deleteId).exec();
      const toKeep = await this.contactModel.findById(keepId).exec();

      if (!toKeep) return { ok: false, message: 'Contact to keep not found' };

      if (toDelete) {
        // Merge: fill in any blank fields on the keeper from the contact being deleted
        const mergeFields: Record<string, any> = {};
        const fields = ['firstName', 'lastName', 'company', 'email', 'notes'] as const;
        for (const field of fields) {
          if (!toKeep[field] && toDelete[field]) {
            mergeFields[field] = toDelete[field];
          }
        }
        // Merge favorite flag
        if (toDelete.favorite && !toKeep.favorite) {
          mergeFields.favorite = true;
        }
        // Merge metadata (keep keeper's values, fill in missing keys from deleted)
        if (toDelete.metadata && Object.keys(toDelete.metadata).length > 0) {
          const mergedMetadata = { ...toDelete.metadata, ...toKeep.metadata };
          mergeFields.metadata = mergedMetadata;
        }

        // Merge phone numbers: collect all unique numbers from both contacts
        const keeperNumbers = new Set<string>([toKeep.phoneNumber]);
        (toKeep.additionalPhoneNumbers || []).forEach(p => keeperNumbers.add(p.number));

        const numbersToAdd: { number: string; label?: string }[] = [];
        if (toDelete.phoneNumber && !keeperNumbers.has(toDelete.phoneNumber)) {
          // Carry over any label from the deleted contact's additional numbers list
          const existingLabel = (toDelete.additionalPhoneNumbers || [])
            .find(p => p.number === toDelete.phoneNumber)?.label;
          numbersToAdd.push({ number: toDelete.phoneNumber, ...(existingLabel ? { label: existingLabel } : {}) });
          keeperNumbers.add(toDelete.phoneNumber);
        }
        for (const p of (toDelete.additionalPhoneNumbers || [])) {
          if (!keeperNumbers.has(p.number)) {
            numbersToAdd.push({ number: p.number, ...(p.label ? { label: p.label } : {}) });
            keeperNumbers.add(p.number);
          }
        }

        if (Object.keys(mergeFields).length > 0) {
          await this.contactModel.updateOne({ _id: toKeep._id }, { $set: mergeFields });
        }
        if (numbersToAdd.length > 0) {
          await this.contactModel.updateOne(
            { _id: toKeep._id },
            { $push: { additionalPhoneNumbers: { $each: numbersToAdd } } },
          );
        }

        // Re-link conversations, call logs, and voicemails from deleted contact to keeper
        const keeperName = [toKeep.firstName || mergeFields.firstName, toKeep.lastName || mergeFields.lastName]
          .filter(Boolean).join(' ') || toKeep.phoneNumber;
        await this.conversationModel.updateMany(
          { contact: toDelete._id },
          { $set: { contact: toKeep._id } },
        );
        await this.callLogModel.updateMany(
          { contact: toDelete._id },
          { $set: { contact: toKeep._id, contactName: keeperName } },
        );
        await this.voicemailModel.updateMany(
          { contact: toDelete._id },
          { $set: { contact: toKeep._id, contactName: keeperName } },
        );

        await this.contactModel.deleteOne({ _id: toDelete._id });
      }

      await this.dedupReviewModel.updateOne({ _id: review._id }, { $set: { status: 'merged' } });
      return { ok: true, action: 'merged', kept: keepId, deleted: deleteId };
    }

    return { ok: false, message: 'Invalid action' };
  }
}
