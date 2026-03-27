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
  listingId: string;
  address: string;
  addressFirstLine: string;
  city: string;
  county: string;
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

/** Normalize common city name variations so the API can match them. */
function normalizeCity(city: string): string {
  let normalized = city.trim();
  // "St George" / "st george" → "St. George" (MLS convention)
  normalized = normalized.replace(/\bSt\b(?!\.)/gi, 'St.');
  return normalized;
}

/**
 * Metro-area aliases: when a caller asks about a metro area name,
 * search the surrounding cities too so we don't miss results.
 */
const METRO_ALIASES: Record<string, string[]> = {
  'st. george': ['St. George', 'Washington', 'Hurricane', 'Ivins', 'Santa Clara', 'La Verkin'],
};

function mapPropertyToListing(prop: any): ListingResult {
  const sf = prop.StandardFields || {};
  return {
    listingId: prop.Id || sf.ListingId || sf.ListingKey || '',
    address: sf.UnparsedAddress || 'Address unavailable',
    addressFirstLine: sf.UnparsedFirstLineAddress || sf.UnparsedAddress || 'Address unavailable',
    city: sf.City || 'Unknown',
    county: sf.CountyOrParish || sf.County || '',
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
      searchData.city = normalizeCity(params.city);
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

    const listings = properties.map(mapPropertyToListing);

    // If no results and the city is a metro area name, retry with broader area
    if (listings.length === 0 && params.city) {
      const normalized = normalizeCity(params.city).toLowerCase();
      const metroCities = METRO_ALIASES[normalized];
      if (metroCities) {
        this.logger.log(`No results for "${params.city}", expanding to metro area: ${metroCities.join(', ')}`);
        const broadSearchData = { ...searchData };
        delete broadSearchData.city;
        const broadBody = { searchData: broadSearchData, page: 1, pageLimit: 10 };
        const broadResp = await fetch(`${this.apiUrl}/_api/property-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(broadBody),
        });
        if (broadResp.ok) {
          const broadData = await broadResp.json();
          const broadProps: any[] = broadData.properties || [];
          const metroCitiesLower = metroCities.map(c => c.toLowerCase());
          const metroProps = broadProps.filter(p => {
            const city = (p.StandardFields?.City || '').toLowerCase();
            return metroCitiesLower.includes(city);
          });
          if (metroProps.length > 0) {
            const metroListings = metroProps.map(mapPropertyToListing);
            const metroTotal = broadData.totalQuantity ?? metroListings.length;
            this.logger.log(`Metro area search found ${metroListings.length} listings`);
            return { listings: metroListings, totalCount: metroTotal };
          }
        }
      }
    }

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

    return `${showingNote}:\n${lines.join('\n')}\n\nPresent these to the caller conversationally — do not read out raw data. Mention the total number of listings available, share a few highlights naturally, and offer to narrow the search or connect them with Joe for more options.\nYou can offer to text the caller a link to these search results or to any specific listing. Use the send_text tool to do so.`;
  }

  buildSearchUrl(params: ListingSearchParams): string {
    const base = this.apiUrl;
    const query = new URLSearchParams();
    query.set('mode', 'search');
    if (params.city) query.set('city', params.city);
    if (params.minPrice != null) query.set('minPrice', String(params.minPrice));
    if (params.maxPrice != null) query.set('maxPrice', String(params.maxPrice));
    if (params.minBeds != null) query.set('beds', String(params.minBeds));
    if (params.minBaths != null) query.set('baths', String(params.minBaths));
    if (params.propertyType) query.set('type', params.propertyType);
    return `${base}/?${query.toString()}`;
  }

  async buildListingUrl(listing: ListingResult): Promise<string> {
    try {
      const response = await fetch(`${this.apiUrl}/_api/property-search/property-url/${listing.listingId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.url) return data.url;
      }
    } catch (err) {
      this.logger.warn(`Failed to get property URL from API: ${err.message}`);
    }
    // Fallback to search URL
    return `${this.apiUrl}/?mode=search&city=${encodeURIComponent(listing.city)}`;
  }

  async shortenUrl(longUrl: string): Promise<string> {
    try {
      const shortenerUrl = this.config.get<string>('URL_SHORTENER_URL') || 'https://giddydigs.com';
      const response = await fetch(`${shortenerUrl}/api/short-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: longUrl }),
      });
      if (!response.ok) {
        this.logger.warn(`URL shortener error: ${response.status}`);
        return longUrl;
      }
      const data = await response.json();
      return data.shortUrl || longUrl;
    } catch (err) {
      this.logger.warn(`URL shortener unavailable, using full URL: ${err.message}`);
      return longUrl;
    }
  }

  /**
   * Look up a property listing by sign code (keyword/number from yard signs).
   * Calls the Giddy Digs API. Returns listing data or null if not found.
   */
  async lookupSignCode(code: string): Promise<{
    listingId: string;
    address: string;
    city: string;
    price: number;
    beds: number;
    baths: number;
    sqft: number | null;
    propertyType: string;
    status: string;
    description: string | null;
    url: string;
  } | null> {
    try {
      const response = await fetch(
        `${this.apiUrl}/_api/sign-codes/${encodeURIComponent(code.trim())}`,
      );
      if (!response.ok) {
        this.logger.warn(`Sign code lookup failed: ${response.status}`);
        return null;
      }
      const data = await response.json();
      if (!data.found || !data.listing) return null;
      return data.listing;
    } catch (err) {
      this.logger.warn(`Sign code lookup error: ${err.message}`);
      return null;
    }
  }
}
