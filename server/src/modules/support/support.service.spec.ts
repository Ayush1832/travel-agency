import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { SupportService } from './support.service';
import { SupportTicket, TicketStatus } from '../../db/schemas/support-ticket.schema';
import { TicketSequence } from '../../db/schemas/ticket-sequence.schema';

const companyId1 = new Types.ObjectId().toString();
const companyId2 = new Types.ObjectId().toString();
const userId = new Types.ObjectId().toString();
const ticketId = new Types.ObjectId().toString();

const authUser = { userId, companyId: companyId1, role: 'client' };

const makeTicket = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(ticketId),
  companyId: new Types.ObjectId(companyId1),
  userId: new Types.ObjectId(userId),
  ticketNo: 'TK-2026-000001',
  subject: 'Issue',
  status: TicketStatus.OPEN,
  messages: [],
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const mockTicketModel = {
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
  sort: jest.fn(),
  skip: jest.fn(),
  limit: jest.fn(),
  lean: jest.fn(),
  populate: jest.fn(),
};

const mockSequenceModel = {
  findOneAndUpdate: jest.fn(),
};

// Helper to chain find().sort().skip().limit().lean()
function chainableFindMock(result: unknown[]) {
  const chain = { sort: jest.fn(), skip: jest.fn(), limit: jest.fn(), lean: jest.fn() };
  chain.sort.mockReturnValue(chain);
  chain.skip.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.lean.mockResolvedValue(result);
  return chain;
}

describe('SupportService', () => {
  let service: SupportService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: getModelToken(SupportTicket.name), useValue: mockTicketModel },
        { provide: getModelToken(TicketSequence.name), useValue: mockSequenceModel },
      ],
    }).compile();

    service = module.get<SupportService>(SupportService);
  });

  describe('createTicket', () => {
    it('creates a ticket with OPEN status and initial message', async () => {
      mockSequenceModel.findOneAndUpdate.mockResolvedValue({ seq: 1 });
      const created = makeTicket();
      mockTicketModel.create.mockResolvedValue(created);

      const result = await service.createTicket(
        { subject: 'Issue', category: 'general', priority: 'medium', message: 'Help!' },
        authUser,
      );

      expect(mockTicketModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: TicketStatus.OPEN }),
      );
      expect(result).toEqual(created);
    });
  });

  describe('listTickets', () => {
    it('scopes query to companyId', async () => {
      const chain = chainableFindMock([]);
      mockTicketModel.find.mockReturnValue(chain);
      mockTicketModel.countDocuments.mockResolvedValue(0);

      await service.listTickets(companyId1, {});

      expect(mockTicketModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: new Types.ObjectId(companyId1) }),
      );
    });
  });

  describe('getTicket — cross-tenant isolation', () => {
    it('returns ticket when companyId matches', async () => {
      const ticket = makeTicket();
      mockTicketModel.findOne.mockResolvedValue(ticket);

      const result = await service.getTicket(ticketId, companyId1);
      expect(result).toEqual(ticket);
    });

    it('throws NotFoundException when companyId does not match (company 2 cannot access company 1 ticket)', async () => {
      mockTicketModel.findOne.mockResolvedValue(null);

      await expect(service.getTicket(ticketId, companyId2)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException (not ForbiddenException) to avoid leaking ticket existence', async () => {
      mockTicketModel.findOne.mockResolvedValue(null);

      await expect(service.getTicket(ticketId, companyId2)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('queries using both _id and companyId', async () => {
      mockTicketModel.findOne.mockResolvedValue(null);
      try { await service.getTicket(ticketId, companyId1); } catch {}

      expect(mockTicketModel.findOne).toHaveBeenCalledWith({
        _id: new Types.ObjectId(ticketId),
        companyId: new Types.ObjectId(companyId1),
      });
    });
  });

  describe('replyToTicket', () => {
    it('adds message to ticket and sets status to IN_PROGRESS', async () => {
      const ticket = makeTicket({ messages: [], status: TicketStatus.OPEN });
      mockTicketModel.findOne.mockResolvedValue(ticket);
      ticket.save.mockResolvedValue({ ...ticket, status: TicketStatus.IN_PROGRESS });

      const result = await service.replyToTicket(ticketId, companyId1, userId, { body: 'My reply' });

      expect(ticket.messages).toHaveLength(1);
      expect(ticket.messages[0].body).toBe('My reply');
      expect(ticket.save).toHaveBeenCalled();
    });
  });

  describe('closeTicket', () => {
    it('sets ticket status to CLOSED', async () => {
      const ticket = makeTicket({ status: TicketStatus.OPEN });
      mockTicketModel.findOne.mockResolvedValue(ticket);
      ticket.save.mockResolvedValue({ ...ticket, status: TicketStatus.CLOSED });

      await service.closeTicket(ticketId, companyId1);

      expect(ticket.status).toBe(TicketStatus.CLOSED);
    });
  });

  describe('reopenTicket', () => {
    it('reopens a CLOSED ticket', async () => {
      const ticket = makeTicket({ status: TicketStatus.CLOSED });
      mockTicketModel.findOne.mockResolvedValue(ticket);
      ticket.save.mockResolvedValue({ ...ticket, status: TicketStatus.OPEN });

      await service.reopenTicket(ticketId, companyId1);

      expect(ticket.status).toBe(TicketStatus.OPEN);
    });

    it('throws ForbiddenException if ticket is not CLOSED', async () => {
      const ticket = makeTicket({ status: TicketStatus.IN_PROGRESS });
      mockTicketModel.findOne.mockResolvedValue(ticket);

      await expect(service.reopenTicket(ticketId, companyId1)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('adminListTickets', () => {
    it('does not scope by companyId by default', async () => {
      const chain = chainableFindMock([]);
      chain.populate = jest.fn().mockReturnValue(chain);
      mockTicketModel.find.mockReturnValue(chain);
      mockTicketModel.countDocuments.mockResolvedValue(0);

      await service.adminListTickets({});

      expect(mockTicketModel.find).toHaveBeenCalledWith({});
    });
  });
});
