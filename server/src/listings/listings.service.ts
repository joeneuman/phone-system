import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  NormalizedProperty,
  NormalizedPropertyDocument,
} from './normalized-property.schema';

export interface ListingSearchParams {
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  minBaths?: number;
  status?: string;
  propertyType?: string;
}

export interface ListingResult {
  address: string;
  city: string;
  state: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number | null;
  yearBuilt: number | null;
  propertyType: string;
  status: string;
  listAgent: string | null;
}

@Injectable()
export class ListingsService {
  constructor(
    @InjectModel(NormalizedProperty.name, 'listings')
    private propertyModel: Model<NormalizedPropertyDocument>,
  ) {}

  async searchProperties(
    params: ListingSearchParams,
  ): Promise<ListingResult[]> {
    const filter: Record<string, any> = {};

    // Default to Active listings
    filter['StandardFields.StandardStatus'] = params.status || 'Active';

    if (params.city) {
      filter['StandardFields.City'] = {
        $regex: new RegExp(`^${params.city}$`, 'i'),
      };
    }

    if (params.minPrice || params.maxPrice) {
      filter['StandardFields.CurrentPrice'] = {};
      if (params.minPrice) {
        filter['StandardFields.CurrentPrice'].$gte = params.minPrice;
      }
      if (params.maxPrice) {
        filter['StandardFields.CurrentPrice'].$lte = params.maxPrice;
      }
    }

    if (params.minBeds) {
      filter['StandardFields.BedsTotal'] = { $gte: params.minBeds };
    }

    if (params.minBaths) {
      filter['StandardFields.BathsTotal'] = { $gte: params.minBaths };
    }

    if (params.propertyType) {
      filter['StandardFields.PropertyType'] = {
        $regex: new RegExp(params.propertyType, 'i'),
      };
    }

    const docs = await this.propertyModel
      .find(filter)
      .sort({ 'StandardFields.CurrentPrice': 1 })
      .limit(5)
      .lean()
      .exec();

    return docs.map((doc) => {
      const sf = doc.StandardFields || {};
      const streetParts = [sf.StreetNumber, sf.StreetName]
        .filter(Boolean)
        .join(' ');

      return {
        address: streetParts || 'Address unavailable',
        city: sf.City || 'Unknown',
        state: sf.StateOrProvince || '',
        price: sf.CurrentPrice || 0,
        beds: sf.BedsTotal || 0,
        baths: sf.BathsTotal || 0,
        sqft: sf.LivingArea || null,
        yearBuilt: sf.YearBuilt || null,
        propertyType: sf.PropertyType || 'Residential',
        status: sf.StandardStatus || 'Active',
        listAgent: sf.ListAgentName || null,
      };
    });
  }

  /**
   * Format search results for conversational use by the AI voice assistant.
   */
  formatForConversation(results: ListingResult[], params: ListingSearchParams): string {
    if (results.length === 0) {
      const parts: string[] = [];
      if (params.city) parts.push(`in ${params.city}`);
      if (params.minBeds) parts.push(`with at least ${params.minBeds} bedrooms`);
      if (params.minBaths) parts.push(`with at least ${params.minBaths} bathrooms`);
      if (params.maxPrice) parts.push(`under $${params.maxPrice.toLocaleString()}`);
      return `No active listings found${parts.length ? ' ' + parts.join(' ') : ''}. The caller may want to adjust their criteria or speak with Joe for more options.`;
    }

    const lines = results.map((r, i) => {
      const parts = [
        `${i + 1}. ${r.address}, ${r.city}`,
        `Price: $${r.price.toLocaleString()}`,
        `${r.beds} bed ${r.baths} bath`,
      ];
      if (r.sqft) parts.push(`${r.sqft.toLocaleString()} sqft`);
      if (r.yearBuilt) parts.push(`built ${r.yearBuilt}`);
      if (r.propertyType !== 'Residential') parts.push(`Type: ${r.propertyType}`);
      return parts.join(', ');
    });

    const summary = `Found ${results.length} listing${results.length > 1 ? 's' : ''}`;
    return `${summary}:\n${lines.join('\n')}\n\nPresent these to the caller conversationally — do not read out raw data. Mention key highlights naturally, and offer to share more details or connect them with Joe.`;
  }
}
