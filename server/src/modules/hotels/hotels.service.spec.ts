import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HotelsService } from './hotels.service';
import { TboService } from '../integrations/tbo/tbo.service';

const mockTboService = {
  search: jest.fn(),
  getDetails: jest.fn(),
  prebook: jest.fn(),
};

const mockConfig = { get: jest.fn() };

// Inject redis mock directly onto service instance to avoid ioredis import issues
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
};

const baseSearchDto = {
  destination: 'Dubai',
  cityId: 'DXB',
  checkIn: '2026-06-01',
  checkOut: '2026-06-05',
  rooms: [{ adults: 2, children: 0, childrenAges: [] }],
  nationality: 'AE',
  currency: 'AED' as const,
};

const mockHotels = [
  {
    supplierHotelId: 'H1',
    name: 'Test Hotel',
    starRating: 4,
    address: 'Dubai',
    city: 'Dubai',
    country: 'UAE',
    lat: 25.2,
    lng: 55.3,
    images: [],
    rooms: [],
    currency: 'AED',
  },
];

describe('HotelsService', () => {
  let service: HotelsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfig.get.mockImplementation((key: string) => {
      if (key === 'redis.host') return 'localhost';
      if (key === 'redis.port') return 6379;
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HotelsService,
        { provide: TboService, useValue: mockTboService },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<HotelsService>(HotelsService);
    // Inject redis mock directly to bypass ioredis module mock complexity
    (service as unknown as Record<string, unknown>).redis = mockRedis;
  });

  describe('search — cache miss', () => {
    it('calls TBO and stores result in cache', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      mockTboService.search.mockResolvedValue(mockHotels);

      const result = await service.search(baseSearchDto);

      expect(mockTboService.search).toHaveBeenCalledTimes(1);
      expect(mockRedis.set).toHaveBeenCalledTimes(1);
      expect(result.hotels).toEqual(mockHotels);
      expect(result.count).toBe(1);
      expect(typeof result.searchId).toBe('string');
    });
  });

  describe('search — cache hit', () => {
    it('returns cached results without calling TBO', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockHotels));

      const result = await service.search(baseSearchDto);

      expect(mockTboService.search).not.toHaveBeenCalled();
      expect(result.hotels).toEqual(mockHotels);
    });
  });

  describe('search — Redis.get throws (fallback)', () => {
    it('calls TBO and returns results when Redis throws', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis down'));
      mockRedis.set.mockRejectedValue(new Error('Redis down'));
      mockTboService.search.mockResolvedValue(mockHotels);

      const result = await service.search(baseSearchDto);

      expect(result.hotels).toEqual(mockHotels);
    });
  });

  describe('search — same params produce same searchId', () => {
    it('produces consistent cache key for identical params', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      mockTboService.search.mockResolvedValue([]);

      const r1 = await service.search(baseSearchDto);
      const r2 = await service.search({ ...baseSearchDto });

      expect(r1.searchId).toBe(r2.searchId);
    });
  });

  describe('search — different params produce different searchIds', () => {
    it('produces different cache key when city changes', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      mockTboService.search.mockResolvedValue([]);

      const r1 = await service.search(baseSearchDto);
      const r2 = await service.search({ ...baseSearchDto, cityId: 'AUH' });

      expect(r1.searchId).not.toBe(r2.searchId);
    });
  });

  describe('getDetails', () => {
    it('delegates to TboService.getDetails', async () => {
      const mockDetails = { supplierHotelId: 'H1', name: 'Test', rooms: [] };
      mockTboService.getDetails.mockResolvedValue(mockDetails);

      const result = await service.getDetails('H1', 'search123');

      expect(mockTboService.getDetails).toHaveBeenCalledWith('H1', 'search123');
      expect(result).toEqual(mockDetails);
    });
  });

  describe('prebook', () => {
    it('delegates to TboService.prebook', async () => {
      const mockPrebook = { sessionId: 'S1', room: { price: 50000, cancellationPolicy: [] } };
      mockTboService.prebook.mockResolvedValue(mockPrebook);

      const result = await service.prebook('token123');

      expect(mockTboService.prebook).toHaveBeenCalledWith('token123');
      expect(result).toEqual(mockPrebook);
    });
  });

  describe('getDestinationsAutocomplete', () => {
    it('returns matching destinations for query', () => {
      const results = service.getDestinationsAutocomplete('dub');
      expect(results.some((r) => r.name.toLowerCase().includes('dubai'))).toBe(true);
    });

    it('returns empty array for no match', () => {
      const results = service.getDestinationsAutocomplete('zzzzz');
      expect(results).toHaveLength(0);
    });
  });
});
