import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../../db/schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findById(id: string) {
    const user = await this.userModel.findById(id).lean();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByCompany(companyId: string) {
    return this.userModel.find({ companyId: new Types.ObjectId(companyId) }).lean();
  }

  async updateStatus(id: string, status: 'active' | 'disabled') {
    return this.userModel.findByIdAndUpdate(id, { status }, { new: true }).lean();
  }
}
