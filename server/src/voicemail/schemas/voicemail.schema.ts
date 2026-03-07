import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Voicemail extends Document {
  @Prop({ required: true })
  callSid: string;

  @Prop({ required: true })
  recordingSid: string;

  @Prop({ required: true })
  recordingUrl: string;

  @Prop({ required: true })
  from: string;

  @Prop()
  duration: number;

  @Prop()
  transcription: string;

  @Prop({ default: false })
  listened: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Contact' })
  contact: Types.ObjectId;

  @Prop()
  contactName: string;
}

export const VoicemailSchema = SchemaFactory.createForClass(Voicemail);
VoicemailSchema.index({ createdAt: -1 });
