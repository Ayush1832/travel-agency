import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SupportTicket,
  SupportTicketDocument,
  TicketStatus,
} from '../../db/schemas/support-ticket.schema';
import {
  TicketSequence,
  TicketSequenceDocument,
} from '../../db/schemas/ticket-sequence.schema';
import { CreateTicketDto, ReplyDto } from './dto/support.dto';

interface AuthUser {
  userId: string;
  companyId: string;
  role: string;
}

@Injectable()
export class SupportService {
  constructor(
    @InjectModel(SupportTicket.name)
    private ticketModel: Model<SupportTicketDocument>,
    @InjectModel(TicketSequence.name)
    private sequenceModel: Model<TicketSequenceDocument>,
  ) {}

  private async generateTicketNo(): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await this.sequenceModel.findOneAndUpdate(
      { year },
      { $inc: { seq: 1 } },
      { upsert: true, new: true },
    );
    const padded = String(seq.seq).padStart(6, '0');
    return `TK-${year}-${padded}`;
  }

  async createTicket(dto: CreateTicketDto, user: AuthUser): Promise<SupportTicketDocument> {
    const ticketNo = await this.generateTicketNo();

    return this.ticketModel.create({
      ticketNo,
      companyId: new Types.ObjectId(user.companyId),
      userId: new Types.ObjectId(user.userId),
      subject: dto.subject,
      category: dto.category,
      priority: dto.priority,
      bookingRef: dto.bookingRef,
      status: TicketStatus.OPEN,
      messages: [
        {
          fromUserId: new Types.ObjectId(user.userId),
          fromType: 'client',
          body: dto.message,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });
  }

  async listTickets(
    companyId: string,
    filters: { status?: string; category?: string },
    page = 1,
    limit = 20,
  ) {
    const query: Record<string, unknown> = {
      companyId: new Types.ObjectId(companyId),
    };
    if (filters.status) query.status = filters.status;
    if (filters.category) query.category = filters.category;

    const [data, total] = await Promise.all([
      this.ticketModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.ticketModel.countDocuments(query),
    ]);

    return { data, total, page, limit };
  }

  async getTicket(id: string, companyId: string): Promise<SupportTicketDocument> {
    const ticket = await this.ticketModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: new Types.ObjectId(companyId),
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async replyToTicket(
    id: string,
    companyId: string,
    userId: string,
    dto: ReplyDto,
  ): Promise<SupportTicketDocument> {
    const ticket = await this.getTicket(id, companyId);

    ticket.messages.push({
      fromUserId: new Types.ObjectId(userId),
      fromType: 'client',
      body: dto.body,
      attachments: [],
      createdAt: new Date(),
    });

    if (ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.IN_PROGRESS;
    }

    return ticket.save();
  }

  async closeTicket(id: string, companyId: string): Promise<SupportTicketDocument> {
    const ticket = await this.getTicket(id, companyId);
    ticket.status = TicketStatus.CLOSED;
    return ticket.save();
  }

  async reopenTicket(id: string, companyId: string): Promise<SupportTicketDocument> {
    const ticket = await this.getTicket(id, companyId);
    if (ticket.status !== TicketStatus.CLOSED) {
      throw new ForbiddenException('Only closed tickets can be reopened');
    }
    ticket.status = TicketStatus.OPEN;
    return ticket.save();
  }

  // ── Admin methods ────────────────────────────────────────────────────────────

  async adminListTickets(
    filters: { status?: string; assignedTo?: string; companyId?: string },
    page = 1,
    limit = 20,
  ) {
    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.assignedTo) query.assignedTo = new Types.ObjectId(filters.assignedTo);
    if (filters.companyId) query.companyId = new Types.ObjectId(filters.companyId);

    const [data, total] = await Promise.all([
      this.ticketModel
        .find(query)
        .populate('companyId', 'name email')
        .populate('userId', 'firstName lastName email')
        .populate('assignedTo', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.ticketModel.countDocuments(query),
    ]);

    return { data, total, page, limit };
  }

  async adminUpdateTicket(
    id: string,
    updates: { assignedTo?: string; status?: TicketStatus },
  ) {
    const updateData: Record<string, unknown> = {};
    if (updates.assignedTo) updateData.assignedTo = new Types.ObjectId(updates.assignedTo);
    if (updates.status) updateData.status = updates.status;

    const ticket = await this.ticketModel.findByIdAndUpdate(id, updateData, { new: true });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async adminReplyToTicket(
    id: string,
    adminUserId: string,
    body: string,
  ) {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) throw new NotFoundException('Ticket not found');

    ticket.messages.push({
      fromUserId: new Types.ObjectId(adminUserId),
      fromType: 'admin',
      body,
      attachments: [],
      createdAt: new Date(),
    });

    if (ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.IN_PROGRESS;
    }

    return ticket.save();
  }
}
