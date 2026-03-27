import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ListingSearchParams {
  city?: string;
  county?: string;
  zipCode?: string;
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

/** All Utah cities — used as enum values for the search tool and for fuzzy matching. */
export const UTAH_CITIES = [
  'Alpine', 'Alta', 'Altamont', 'Amalga', 'American Fork', 'Annabella', 'Antimony', 'Apple Valley',
  'Aurora', 'Ballard', 'Bear River City', 'Beaver', 'Bicknell', 'Big Water', 'Blanding', 'Bluffdale',
  'Boulder', 'Bountiful', 'Brian Head', 'Brigham City', 'Bryce Canyon City',
  'Cannonville', 'Castle Dale', 'Castle Valley', 'Cedar City', 'Cedar Fort', 'Cedar Hills',
  'Centerfield', 'Centerville', 'Central Valley', 'Charleston', 'Circleville', 'Clarkston',
  'Clawson', 'Clearfield', 'Cleveland', 'Clinton', 'Coalville', 'Corinne', 'Cornish',
  'Cottonwood Heights', 'Daniel', 'Dayton', 'Delta', 'Deweyville', 'Draper', 'Duchesne',
  'Dutch John', 'Eagle Mountain', 'East Carbon', 'Elk Ridge', 'Elmo', 'Elsinore', 'Elwood',
  'Emery', 'Enoch', 'Enterprise', 'Ephraim', 'Erda', 'Escalante',
  'Eureka', 'Fairfield', 'Fairview', 'Farmington', 'Farr West', 'Fayette', 'Ferron',
  'Fielding', 'Fillmore', 'Fort Duchesne', 'Fountain Green', 'Francis', 'Fruit Heights', 'Garden City',
  'Garland', 'Genola', 'Glendale', 'Glenwood', 'Goshen', 'Grantsville', 'Green River',
  'Gunnison', 'Hanksville', 'Harrisville', 'Hatch', 'Heber City', 'Helper', 'Henefer',
  'Henrieville', 'Herriman', 'Highland', 'Hildale', 'Hinckley', 'Holden', 'Holladay',
  'Honeyville', 'Hooper', 'Howell', 'Huntington', 'Huntsville', 'Hurricane', 'Hyde Park',
  'Hyrum', 'Independence', 'Ivins', 'Joseph', 'Junction', 'Kamas', 'Kanab', 'Kanosh',
  'Kaysville', 'Kingston', 'Koosharem', 'La Verkin', 'Laketown', 'Layton', 'Leamington',
  'Leeds', 'Lehi', 'Levan', 'Lewiston', 'Lindon', 'Loa', 'Logan', 'Lyman',
  'Maeser', 'Manila', 'Manti', 'Mantua', 'Mapleton', 'Marriott-Slaterville', 'Marysvale',
  'Mayfield', 'Meadow', 'Mendon', 'Midvale', 'Midway', 'Milford', 'Millcreek', 'Millville',
  'Minersville', 'Moab', 'Mona', 'Monroe', 'Monticello', 'Morgan', 'Moroni', 'Mount Pleasant',
  'Murray', 'Myton', 'Naples', 'Nephi', 'New Harmony', 'Newton', 'Nibley', 'North Logan',
  'North Ogden', 'North Salt Lake', 'Oak City', 'Oakley', 'Ogden', 'Ophir', 'Orangeville',
  'Orem', 'Panguitch', 'Paradise', 'Paragonah', 'Park City', 'Parowan', 'Payson', 'Perry',
  'Pine Valley', 'Plain City', 'Pleasant Grove', 'Pleasant View', 'Plymouth', 'Portage',
  'Price', 'Providence', 'Provo', 'Randolph', 'Redmond', 'Richfield', 'Richmond', 'River Heights',
  'Riverdale', 'Riverton', 'Rockville', 'Rocky Ridge', 'Roosevelt', 'Roy',
  'Rush Valley', 'Salem', 'Salina', 'Salt Lake City', 'Sandy', 'Santa Clara', 'Santaquin',
  'Saratoga Springs', 'Scipio', 'Scofield', 'Sigurd', 'Smithfield', 'Snowville',
  'South Jordan', 'South Ogden', 'South Salt Lake', 'South Weber', 'Spanish Fork',
  'Spring City', 'Spring Glen', 'Springdale', 'Springfield', 'Springville',
  'St. George', 'Stansbury Park', 'Sterling', 'Stockton', 'Sunnyside', 'Sunset', 'Syracuse',
  'Tabiona', 'Taylorsville', 'Tooele', 'Torrey', 'Tremonton', 'Trenton', 'Tropic',
  'Uintah', 'Vernal', 'Vernon', 'Vineyard', 'Virgin', 'Wales', 'Wallsburg',
  'Washington', 'Washington Terrace', 'Wellington', 'Wellsville', 'Wendover', 'West Bountiful',
  'West Haven', 'West Jordan', 'West Point', 'West Valley City', 'Willard', 'Woodland Hills',
  'Woodruff', 'Woods Cross',
];

/** All Utah counties. */
export const UTAH_COUNTIES = [
  'Beaver', 'Box Elder', 'Cache', 'Carbon', 'Daggett', 'Davis', 'Duchesne', 'Emery',
  'Garfield', 'Grand', 'Iron', 'Juab', 'Kane', 'Millard', 'Morgan', 'Piute', 'Rich',
  'Salt Lake', 'San Juan', 'Sanpete', 'Sevier', 'Summit', 'Tooele', 'Uintah', 'Utah',
  'Wasatch', 'Washington', 'Wayne', 'Weber',
];

/** Common Utah zip codes (southern Utah focus + major metro areas). */
export const UTAH_ZIP_CODES = [
  // St. George / Washington County
  '84770', '84771', '84780', '84783', '84790', '84737', '84738', '84745', '84746',
  '84765', '84767', '84779', '84782', '84784',
  // Cedar City / Iron County
  '84720', '84721',
  // Hurricane / La Verkin
  '84737',
  // Kanab / Kane County
  '84741',
  // Salt Lake metro
  '84101', '84102', '84103', '84104', '84105', '84106', '84107', '84108', '84109',
  '84110', '84111', '84112', '84113', '84114', '84115', '84116', '84117', '84118',
  '84119', '84120', '84121', '84123', '84124', '84128', '84129', '84130',
  // Sandy / Draper / South Jordan
  '84070', '84091', '84092', '84093', '84094', '84095', '84065',
  // Provo / Orem / Utah County
  '84601', '84602', '84603', '84604', '84605', '84606', '84058', '84057', '84059',
  '84097', '84003', '84004', '84042', '84043', '84045', '84062', '84660',
  // Park City / Summit County
  '84060', '84068', '84098',
  // Ogden / Weber County
  '84401', '84402', '84403', '84404', '84405', '84414',
  // Logan / Cache County
  '84321', '84322', '84332', '84333', '84335', '84339',
  // Moab
  '84532',
];

/** Find the closest matching Utah city using simple similarity scoring. */
function findClosestCity(input: string): string {
  const lower = input.trim().toLowerCase()
    .replace(/\bst\b(?!\.)/, 'st.'); // normalize "st" → "st."
  let bestMatch = input;
  let bestScore = 0;
  for (const city of UTAH_CITIES) {
    const cityLower = city.toLowerCase();
    if (cityLower === lower) return city; // exact match
    // Score: length of longest common prefix + bonus for similar length
    let prefix = 0;
    while (prefix < lower.length && prefix < cityLower.length && lower[prefix] === cityLower[prefix]) {
      prefix++;
    }
    const lengthPenalty = Math.abs(lower.length - cityLower.length);
    const score = prefix * 2 - lengthPenalty;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = city;
    }
  }
  return bestMatch;
}

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
      searchData.city = findClosestCity(params.city);
      this.logger.log(`City "${params.city}" → "${searchData.city}"`);
    }
    if (params.county) {
      searchData.county = params.county;
    }
    if (params.zipCode) {
      searchData.postalCode = params.zipCode;
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
      if (params.county) parts.push(`in ${params.county} County`);
      if (params.zipCode) parts.push(`in zip code ${params.zipCode}`);
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
