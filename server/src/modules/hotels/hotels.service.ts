import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { TboService } from '../integrations/tbo/tbo.service';
import { HotelSearchDto } from './dto/hotel-search.dto';
import { NormalizedHotelResult, NormalizedHotelDetails, PrebookResult } from '../integrations/normalized.types';
import { SearchCriteria } from '../integrations/normalized.types';

const CACHE_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class HotelsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HotelsService.name);
  private redis: Redis | null = null;

  constructor(
    private readonly tboService: TboService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    try {
      this.redis = new Redis({
        host: this.config.get<string>('redis.host') ?? 'localhost',
        port: this.config.get<number>('redis.port') ?? 6379,
        password: this.config.get<string>('redis.password'),
        keyPrefix: 'hotel_search:',
        lazyConnect: true,
        enableOfflineQueue: false,
      });
      this.redis.on('error', (err: Error) => {
        this.logger.warn(`Redis error (falling back to no-cache): ${err.message}`);
      });
    } catch {
      this.logger.warn('Redis init failed — hotel search cache disabled');
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }

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

  private async getFromCache(key: string): Promise<NormalizedHotelResult[] | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as NormalizedHotelResult[];
    } catch {
      return null;
    }
  }

  private async setInCache(key: string, data: NormalizedHotelResult[]): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(key, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
    } catch {
      // cache write failure is non-fatal
    }
  }

  // ── Public methods ────────────────────────────────────────────────────────────

  async search(dto: HotelSearchDto): Promise<{ searchId: string; hotels: NormalizedHotelResult[]; count: number }> {
    const searchId = this.hashSearchParams(dto);

    const cached = await this.getFromCache(searchId);
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
    await this.setInCache(searchId, hotels);

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
