import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class CallLog extends Document {
  @Prop({ required: true, index: true })
  sid: string;

  @Prop({ required: true })
  from: string;

  @Prop({ required: true })
  to: string;

  @Prop({ required: true, enum: ['inbound', 'outbound'] })
  direction: string;

  @Prop({ default: 'initiated' })
  status: string;

  @Prop()
  duration: number;

  @Prop({ type: Types.ObjectId, ref: 'Contact' })
  contact: Types.ObjectId;

  @Prop()
  contactName: string;
}

export const CallLogSchema = SchemaFactory.createForClass(CallLog);
CallLogSchema.index({ createdAt: -1 });
