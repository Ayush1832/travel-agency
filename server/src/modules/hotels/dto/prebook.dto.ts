import { IsString, IsNotEmpty } from 'class-validator';

export class PrebookDto {
  @IsString()
  @IsNotEmpty()
  roomToken: string;
}
