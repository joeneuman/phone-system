import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Message extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true, index: true })
  conversation: Types.ObjectId;

  @Prop({ required: true, enum: ['inbound', 'outbound'] })
  direction: string;

  @Prop({ required: true })
  from: string;

  @Prop({ required: true })
  to: string;

  @Prop({ default: '' })
  body: string;

  @Prop({ type: [String], default: [] })
  mediaUrls: string[];

  @Prop()
  twilioSid: string;

  @Prop({ default: 'delivered', enum: ['queued', 'sent', 'delivered', 'failed', 'received'] })
  status: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ conversation: 1, createdAt: 1 });
