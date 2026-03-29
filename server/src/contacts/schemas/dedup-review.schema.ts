import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class DedupReview extends Document {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Contact' })
  contactA: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Contact' })
  contactB: Types.ObjectId;

  @Prop({ required: true })
  reason: string; // e.g. 'same-phone-different-source', 'same-name-different-phone'

  @Prop({ default: 'pending' })
  status: string; // 'pending' | 'merged' | 'dismissed'
}

export const DedupReviewSchema = SchemaFactory.createForClass(DedupReview);
DedupReviewSchema.index({ status: 1 });
DedupReviewSchema.index({ contactA: 1, contactB: 1 }, { unique: true });
