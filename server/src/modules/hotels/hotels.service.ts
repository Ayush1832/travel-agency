import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { TboService } from '../integrations/tbo/tbo.service';
import { HotelSearchDto } from './dto/hotel-search.dto';
import { NormalizedHotelResult, NormalizedHotelDetails, PrebookResult } from '../integrations/normalized.types';
import { SearchCriteria } from '../integrations/normalized.types';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class HotelsService {
  private readonly logger = new Logger(HotelsService.name);

  // In-memory search cache with 5-minute TTL
  private readonly searchCache = new Map<string, CacheEntry<NormalizedHotelResult[]>>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly tboService: TboService) {}

  // ── Cache helpers ────────────────────────────────────────────────────────────

  private hashSearchParams(dto: HotelSearchDto): string {
    const key = JSON.stringify({
      destination: dto.destination,
      cityId: dto.cityId,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      rooms: dto.rooms,
      nationality: dto.nationality ?? 'AE',
      currency: dto.currency ?? 'AED',
    });
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  private getFromCache(key: string): NormalizedHotelResult[] | null {
    const entry = this.searchCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.searchCache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setInCache(key: string, data: NormalizedHotelResult[]): void {
    // Purge expired entries periodically
    if (this.searchCache.size > 500) {
      const now = Date.now();
      for (const [k, v] of this.searchCache.entries()) {
        if (now > v.expiresAt) this.searchCache.delete(k);
      }
    }
    this.searchCache.set(key, { data, expiresAt: Date.now() + this.CACHE_TTL_MS });
  }

  // ── Public methods ────────────────────────────────────────────────────────────

  async search(dto: HotelSearchDto): Promise<{ searchId: string; hotels: NormalizedHotelResult[]; count: number }> {
    const searchId = this.hashSearchParams(dto);

    // Try cache first
    const cached = this.getFromCache(searchId);
    if (cached) {
      this.logger.log(`Cache HIT for searchId=${searchId}`);
      return { searchId, hotels: cached, count: cached.length };
    }

    this.logger.log(`Cache MISS for searchId=${searchId}, calling TBO`);

    const criteria: SearchCriteria = {
      destination: dto.destination,
      cityId: dto.cityId,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      rooms: (dto.rooms ?? []).map((r) => ({
        adults: r.adults,
        children: r.children ?? 0,
        childrenAges: r.childrenAges ?? [],
      })),
      nationality: dto.nationality ?? 'AE',
      currency: dto.currency ?? 'AED',
    };

    const hotels = await this.tboService.search(criteria);
    this.setInCache(searchId, hotels);

    return { searchId, hotels, count: hotels.length };
  }

  async getDetails(
    supplierHotelId: string,
    searchId: string,
  ): Promise<NormalizedHotelDetails> {
    return this.tboService.getDetails(supplierHotelId, searchId);
  }

  async prebook(roomToken: string): Promise<PrebookResult> {
    return this.tboService.prebook(roomToken);
  }

  getDestinationsAutocomplete(q: string): { id: string; name: string; country: string; type: string }[] {
    const destinations = [
      // UAE
      { id: 'DXB', name: 'Dubai', country: 'United Arab Emirates', type: 'city' },
      { id: 'AUH', name: 'Abu Dhabi', country: 'United Arab Emirates', type: 'city' },
      { id: 'SHJ', name: 'Sharjah', country: 'United Arab Emirates', type: 'city' },
      { id: 'AJM', name: 'Ajman', country: 'United Arab Emirates', type: 'city' },
      { id: 'RKT', name: 'Ras Al Khaimah', country: 'United Arab Emirates', type: 'city' },
      { id: 'FJR', name: 'Fujairah', country: 'United Arab Emirates', type: 'city' },
      { id: 'UMM', name: 'Umm Al Quwain', country: 'United Arab Emirates', type: 'city' },
      // Saudi Arabia
      { id: 'RUH', name: 'Riyadh', country: 'Saudi Arabia', type: 'city' },
      { id: 'JED', name: 'Jeddah', country: 'Saudi Arabia', type: 'city' },
      { id: 'MKK', name: 'Mecca', country: 'Saudi Arabia', type: 'city' },
      { id: 'MED', name: 'Medina', country: 'Saudi Arabia', type: 'city' },
      { id: 'DMM', name: 'Dammam', country: 'Saudi Arabia', type: 'city' },
      { id: 'KhobarSA', name: 'Al Khobar', country: 'Saudi Arabia', type: 'city' },
      { id: 'AbhaSA', name: 'Abha', country: 'Saudi Arabia', type: 'city' },
      // Egypt
      { id: 'CAI', name: 'Cairo', country: 'Egypt', type: 'city' },
      { id: 'HRG', name: 'Hurghada', country: 'Egypt', type: 'city' },
      { id: 'SSH', name: 'Sharm El Sheikh', country: 'Egypt', type: 'city' },
      { id: 'ALY', name: 'Alexandria', country: 'Egypt', type: 'city' },
      { id: 'LXR', name: 'Luxor', country: 'Egypt', type: 'city' },
      { id: 'ASW', name: 'Aswan', country: 'Egypt', type: 'city' },
      // Other MENA
      { id: 'AMM', name: 'Amman', country: 'Jordan', type: 'city' },
      { id: 'AQJ', name: 'Aqaba', country: 'Jordan', type: 'city' },
      { id: 'BEY', name: 'Beirut', country: 'Lebanon', type: 'city' },
      { id: 'MCT', name: 'Muscat', country: 'Oman', type: 'city' },
      { id: 'SLL', name: 'Salalah', country: 'Oman', type: 'city' },
      { id: 'DOH', name: 'Doha', country: 'Qatar', type: 'city' },
      { id: 'BAH', name: 'Bahrain', country: 'Bahrain', type: 'city' },
      { id: 'KWI', name: 'Kuwait City', country: 'Kuwait', type: 'city' },
      { id: 'IST', name: 'Istanbul', country: 'Turkey', type: 'city' },
      { id: 'AYT', name: 'Antalya', country: 'Turkey', type: 'city' },
    ];

    if (!q || q.trim().length < 1) return destinations.slice(0, 10);

    const query = q.trim().toLowerCase();
    return destinations
      .filter(
        (d) =>
          d.name.toLowerCase().includes(query) ||
          d.country.toLowerCase().includes(query) ||
          d.id.toLowerCase().includes(query),
      )
      .slice(0, 10);
  }
}
