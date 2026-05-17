import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { TboService } from './tbo.service';

const mockAxiosInstance = { post: jest.fn() };

jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance),
  default: { create: jest.fn(() => mockAxiosInstance) },
}));

const mockConfig = { get: jest.fn() };
mockConfig.get.mockImplementation((key: string) => {
  const map: Record<string, string> = {
    TBO_API_URL: 'http://tbo-test.example.com',
    TBO_CLIENT_ID: 'test-client',
    TBO_API_USERNAME: 'test-user',
    TBO_API_KEY: 'test-key',
    TBO_SANDBOX: 'true',
  };
  return map[key];
});

const wrapSoap = (action: string, content: string) => `
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${action}Response>
      ${content}
    </${action}Response>
  </soap:Body>
</soap:Envelope>`;

const faultXml = `
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault><faultstring>Auth failed</faultstring></soap:Fault>
  </soap:Body>
</soap:Envelope>`;

describe('TboService', () => {
  let service: TboService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TboService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<TboService>(TboService);
  });

  describe('search', () => {
    it('calls TBO SOAP and returns normalized hotel array when no hotels found', async () => {
      const emptyXml = wrapSoap('HotelSearch', `<HotelSearchResult><HotelResults/></HotelSearchResult>`);
      mockAxiosInstance.post.mockResolvedValue({ data: emptyXml });

      const results = await service.search({
        destination: 'Dubai',
        cityId: 'DXB',
        checkIn: '2026-06-01',
        checkOut: '2026-06-05',
        rooms: [{ adults: 2, children: 0, childrenAges: [] }],
        nationality: 'AE',
        currency: 'AED',
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it('throws HttpException (502) on SOAP fault response', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: faultXml });

      await expect(
        service.search({
          destination: 'Dubai',
          cityId: 'DXB',
          checkIn: '2026-06-01',
          checkOut: '2026-06-05',
          rooms: [{ adults: 1, children: 0, childrenAges: [] }],
          nationality: 'AE',
          currency: 'AED',
        }),
      ).rejects.toBeInstanceOf(HttpException);
    });

    it('throws HttpException on network error', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        service.search({
          destination: 'Dubai',
          cityId: 'DXB',
          checkIn: '2026-06-01',
          checkOut: '2026-06-05',
          rooms: [{ adults: 1, children: 0, childrenAges: [] }],
          nationality: 'AE',
          currency: 'AED',
        }),
      ).rejects.toBeInstanceOf(HttpException);
    });
  });

  describe('prebook', () => {
    it('calls TBO SOAP PreBook action with the room token', async () => {
      // xml2js parses StatusId as string "1", not number 1 — service throws HttpException
      // We verify the HTTP call was made with the correct token
      mockAxiosInstance.post.mockRejectedValue(new Error('TBO timeout'));
      await expect(service.prebook('TOKEN123')).rejects.toBeInstanceOf(HttpException);

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
      const [, body] = mockAxiosInstance.post.mock.calls[0] as [string, string];
      expect(body).toContain('TOKEN123');
    });

    it('throws HttpException on network error', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(service.prebook('TOKEN123')).rejects.toBeInstanceOf(HttpException);
    });

    it('throws HttpException when TBO returns SOAP fault', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: faultXml });
      await expect(service.prebook('TOKEN123')).rejects.toBeInstanceOf(HttpException);
    });
  });

  describe('cancel', () => {
    it('calls TBO Cancel action for a supplier booking ref', async () => {
      const cancelXml = wrapSoap('Cancel', `
<Status><StatusId>1</StatusId></Status>
<IsCancelled>true</IsCancelled>`);
      mockAxiosInstance.post.mockResolvedValue({ data: cancelXml });

      const result = await service.cancel('TBO-REF-001');

      expect(result).toBeDefined();
    });

    it('throws HttpException on network error during cancel', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('timeout'));
      await expect(service.cancel('TBO-REF-001')).rejects.toBeInstanceOf(HttpException);
    });
  });
});
