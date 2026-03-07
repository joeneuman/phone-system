import { IsString, IsOptional, IsArray } from 'class-validator';

export class SendMessageDto {
  @IsString()
  to: string;

  @IsString()
  body: string;

  @IsArray() @IsOptional()
  mediaUrls?: string[];
}
