import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Conversation extends Document {
  @Prop({ required: true, index: true })
  phoneNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Contact' })
  contact: Types.ObjectId;

  @Prop()
  lastMessageBody: string;

  @Prop()
  lastMessageAt: Date;

  @Prop({ default: 0 })
  unreadCount: number;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.index({ phoneNumber: 1 }, { unique: true });
ConversationSchema.index({ lastMessageAt: -1 });
