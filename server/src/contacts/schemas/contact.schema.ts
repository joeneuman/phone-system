import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Contact extends Document {
  @Prop({ required: true })
  phoneNumber: string;

  @Prop()
  phoneLabel: string;

  @Prop()
  firstName: string;

  @Prop()
  lastName: string;

  @Prop()
  company: string;

  @Prop()
  email: string;

  @Prop()
  notes: string;

  @Prop({ default: false })
  favorite: boolean;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({
    type: [{ number: String, label: String }],
    default: [],
  })
  additionalPhoneNumbers: { number: string; label?: string }[];
}

export const ContactSchema = SchemaFactory.createForClass(Contact);
ContactSchema.index({ phoneNumber: 1 }, { unique: true });
ContactSchema.index({ 'additionalPhoneNumbers.number': 1 }, { sparse: true });
ContactSchema.index({ firstName: 'text', lastName: 'text', company: 'text' });
ContactSchema.index({ 'metadata.giddydigsUserId': 1 }, { sparse: true });
