import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoleDocument = Role & Document;

@Schema({ _id: false })
class ModulePermission {
  @Prop({ required: true }) module: string;
  @Prop({ type: [String], default: [] }) actions: string[];
}

@Schema({ timestamps: true })
export class Role {
  @Prop({ required: true }) name: string;

  @Prop() description?: string;

  @Prop({ type: [ModulePermission], default: [] }) permissions: ModulePermission[];

  /** Built-in roles cannot be deleted */
  @Prop({ default: false }) isSystem: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
