import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NormalizedPropertyDocument = NormalizedProperty & Document;

@Schema({ collection: 'properties_normalized', timestamps: true, strict: false })
export class NormalizedProperty {
  @Prop({ required: true, unique: true, index: true })
  Id: string;

  @Prop({ type: Object })
  StandardFields: Record<string, any>;

  @Prop({ type: [Object] })
  Photos: Array<Record<string, any>>;

  @Prop({ index: true })
  ApiSource: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
    },
  })
  location: {
    type: string;
    coordinates: number[];
  };

  @Prop({ required: true, index: true })
  source: string;
}

export const NormalizedPropertySchema =
  SchemaFactory.createForClass(NormalizedProperty);
