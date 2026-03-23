import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
  description: string | null;
  lotSize: string | null;
  garageSpaces: number | null;
  stories: number | null;
  daysOnMarket: number | null;
  hoaFee: string | null;
  hoaIncludes: string | null;
}

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);
  private readonly apiUrl: string;

  constructor(private config: ConfigService) {
    this.apiUrl =
      this.config.get<string>('GIDDYDIGS_API_URL') || 'https://giddydigs.com';
  }

  async searchProperties(
    params: ListingSearchParams,
  ): Promise<{ listings: ListingResult[]; totalCount: number }> {
    const searchData: Record<string, any> = {};

    if (params.city) {
      searchData.city = params.city;
    }
    if (params.minPrice != null) {
      searchData.minPrice = params.minPrice;
    }
    if (params.maxPrice != null) {
      searchData.maxPrice = params.maxPrice;
    }
    if (params.minBeds != null) {
      searchData.minBedrooms = params.minBeds;
    }
    if (params.minBaths != null) {
      searchData.minBathrooms = params.minBaths;
    }

    // Map property type to boolean flags
    if (params.propertyType) {
      const pt = params.propertyType.toLowerCase();
      if (pt.includes('residential') || pt.includes('house') || pt.includes('single')) {
        searchData.isResidential = true;
      }
      if (pt.includes('commercial')) {
        searchData.isCommercial = true;
      }
      if (pt.includes('condo')) {
        searchData.isCondo = true;
      }
      if (pt.includes('townhouse') || pt.includes('townhome')) {
        searchData.isTownhouse = true;
      }
      if (pt.includes('land') || pt.includes('lot')) {
        searchData.isLand = true;
      }
    }

    const requestBody = {
      searchData,
      page: 1,
      pageLimit: 10,
    };

    this.logger.log(
      `Searching Giddy Digs API: ${JSON.stringify(requestBody)}`,
    );

    const response = await fetch(`${this.apiUrl}/_api/property-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(
        `Giddy Digs API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    const properties: any[] = data.properties || [];

    const totalCount = data.totalQuantity ?? properties.length;

    this.logger.log(
      `API returned ${properties.length} of ${totalCount} total`,
    );

    const listings = properties.map((prop) => {
      const sf = prop.StandardFields || {};
      return {
        address: sf.UnparsedAddress || 'Address unavailable',
        city: sf.City || 'Unknown',
        state: sf.StateOrProvince || '',
        price: sf.CurrentPrice || 0,
        beds: sf.BedsTotal || 0,
        baths: sf.BathsTotal || 0,
        sqft: sf.LivingArea || null,
        yearBuilt: sf.YearBuilt || null,
        propertyType: sf.PropertyTypeLabel || 'Residential',
        status: sf.MlsStatus || 'Active',
        listAgent: sf.ListAgentName || null,
        description: sf.PublicRemarks || null,
        lotSize: sf.LotSizeArea || sf.LotSizeAcres ? `${sf.LotSizeArea || sf.LotSizeAcres}` : null,
        garageSpaces: sf.GarageSpaces || null,
        stories: sf.Stories || null,
        daysOnMarket: sf.DaysOnMarket || null,
        hoaFee: sf.AssociationFee ? `$${sf.AssociationFee} ${sf.AssociationFeeFrequency || ''}`.trim() : null,
        hoaIncludes: sf.AssociationFeeIncludes || null,
      };
    });

    return { listings, totalCount };
  }

  /**
   * Format search results for conversational use by the AI voice assistant.
   */
  formatForConversation(
    results: ListingResult[],
    totalCount: number,
    params: ListingSearchParams,
  ): string {
    if (results.length === 0) {
      const parts: string[] = [];
      if (params.city) parts.push(`in ${params.city}`);
      if (params.minBeds)
        parts.push(`with at least ${params.minBeds} bedrooms`);
      if (params.minBaths)
        parts.push(`with at least ${params.minBaths} bathrooms`);
      if (params.maxPrice)
        parts.push(`under $${params.maxPrice.toLocaleString()}`);
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
      if (r.propertyType !== 'Residential')
        parts.push(`Type: ${r.propertyType}`);
      if (r.lotSize) parts.push(`Lot: ${r.lotSize}`);
      if (r.garageSpaces) parts.push(`${r.garageSpaces}-car garage`);
      if (r.stories) parts.push(`${r.stories} ${r.stories === 1 ? 'story' : 'stories'}`);
      if (r.daysOnMarket) parts.push(`${r.daysOnMarket} days on market`);
      if (r.hoaFee) parts.push(`Total Dues/Fees: ${r.hoaFee}`);
      if (r.hoaIncludes) parts.push(`Dues include: ${r.hoaIncludes}`);
      if (r.listAgent) parts.push(`Listed by: ${r.listAgent}`);
      if (r.description) parts.push(`Description: ${r.description}`);
      return parts.join(', ');
    });

    const showingNote = totalCount > results.length
      ? `There are ${totalCount} total listings matching this search. Here are ${results.length} of them`
      : `Found ${totalCount} listing${totalCount > 1 ? 's' : ''} total`;

    return `${showingNote}:\n${lines.join('\n')}\n\nPresent these to the caller conversationally — do not read out raw data. Mention the total number of listings available, share a few highlights naturally, and offer to narrow the search or connect them with Joe for more options.`;
  }
}
