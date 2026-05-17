import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { CmsService } from './cms.service';
import { CmsPage } from '../../db/schemas/cms-page.schema';
import { CmsBanner } from '../../db/schemas/cms-banner.schema';
import { CmsEmailTemplate } from '../../db/schemas/cms-email-template.schema';

const makeModel = (methods: Record<string, unknown> = {}) => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn(),
  ...methods,
});

function chainable(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.sort = jest.fn().mockReturnValue(chain);
  chain.lean = jest.fn().mockResolvedValue(result);
  return chain;
}

describe('CmsService', () => {
  let service: CmsService;
  let pageModel: ReturnType<typeof makeModel>;
  let bannerModel: ReturnType<typeof makeModel>;
  let templateModel: ReturnType<typeof makeModel>;

  beforeEach(async () => {
    jest.clearAllMocks();
    pageModel = makeModel();
    bannerModel = makeModel();
    templateModel = makeModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CmsService,
        { provide: getModelToken(CmsPage.name), useValue: pageModel },
        { provide: getModelToken(CmsBanner.name), useValue: bannerModel },
        { provide: getModelToken(CmsEmailTemplate.name), useValue: templateModel },
      ],
    }).compile();

    service = module.get<CmsService>(CmsService);
  });

  describe('onModuleInit — default template seeding', () => {
    it('creates default templates that do not yet exist', async () => {
      templateModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      templateModel.create.mockResolvedValue({});

      await service.onModuleInit();

      expect(templateModel.create).toHaveBeenCalled();
    });

    it('does not create templates that already exist', async () => {
      templateModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ key: 'booking_confirmed' }),
      });

      await service.onModuleInit();

      expect(templateModel.create).not.toHaveBeenCalled();
    });
  });

  describe('getPublishedPages', () => {
    it('queries isPublished: true and returns result', async () => {
      const pages = [{ slug: 'about', title: 'About' }];
      const chain = chainable(pages);
      pageModel.find.mockReturnValue(chain);

      const result = await service.getPublishedPages();

      expect(pageModel.find).toHaveBeenCalledWith({ isPublished: true });
      expect(result).toEqual(pages);
    });
  });

  describe('getPageBySlug', () => {
    it('returns page when found', async () => {
      const page = { slug: 'about', body: '<p>Hello</p>' };
      pageModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(page) });

      const result = await service.getPageBySlug('about');
      expect(result).toEqual(page);
    });

    it('throws NotFoundException when page not found', async () => {
      pageModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      await expect(service.getPageBySlug('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPage — XSS sanitization', () => {
    it('strips script tags from page body on create', async () => {
      const created = { _id: '1', slug: 'test', title: 'Test', body: '' };
      pageModel.create.mockImplementation(async (dto: Record<string, string>) => {
        created.body = dto.body;
        return created;
      });
      pageModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

      await service.createPage({
        slug: 'test',
        title: 'Test',
        body: '<p>Safe</p><script>alert("xss")</script>',
      });

      expect(created.body).not.toContain('<script>');
      expect(created.body).toContain('<p>Safe</p>');
    });

    it('strips onclick attributes from page body', async () => {
      const created = { _id: '1', slug: 'test2', title: 'Test', body: '' };
      pageModel.create.mockImplementation(async (dto: Record<string, string>) => {
        created.body = dto.body;
        return created;
      });
      pageModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

      await service.createPage({
        slug: 'test2',
        title: 'Test',
        body: '<p onclick="evilFn()">Click</p>',
      });

      expect(created.body).not.toContain('onclick');
    });
  });

  describe('updatePage — XSS sanitization', () => {
    it('sanitizes body on update', async () => {
      let calledWith: Record<string, unknown> = {};
      pageModel.findByIdAndUpdate.mockImplementation(
        async (_id: string, data: Record<string, unknown>) => {
          calledWith = data;
          return { _id, ...data };
        },
      );

      await service.updatePage('1', { body: '<img src=x onerror=alert(1)>Safe text' });

      expect(String(calledWith.body)).not.toContain('onerror');
    });
  });

  describe('getActiveBanners', () => {
    it('queries isActive: true', async () => {
      const chain = { find: jest.fn(), sort: jest.fn(), lean: jest.fn() };
      chain.sort.mockReturnValue(chain);
      chain.lean.mockResolvedValue([]);
      bannerModel.find.mockReturnValue(chain);

      await service.getActiveBanners();

      expect(bannerModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
    });
  });
});
