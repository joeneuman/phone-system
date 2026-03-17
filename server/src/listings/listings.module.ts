import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ListingsService } from './listings.service';
import {
  NormalizedProperty,
  NormalizedPropertySchema,
} from './normalized-property.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: NormalizedProperty.name, schema: NormalizedPropertySchema }],
      'listings',
    ),
  ],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
