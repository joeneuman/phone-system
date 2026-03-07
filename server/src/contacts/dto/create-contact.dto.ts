import { IsString, IsOptional, IsBoolean, Matches } from 'class-validator';

export class CreateContactDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Phone number must be in E.164 format' })
  phoneNumber: string;

  @IsString() @IsOptional()
  firstName?: string;

  @IsString() @IsOptional()
  lastName?: string;

  @IsString() @IsOptional()
  company?: string;

  @IsString() @IsOptional()
  email?: string;

  @IsString() @IsOptional()
  notes?: string;

  @IsBoolean() @IsOptional()
  favorite?: boolean;
}

export class UpdateContactDto {
  @IsString() @IsOptional()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Phone number must be in E.164 format' })
  phoneNumber?: string;

  @IsString() @IsOptional()
  firstName?: string;

  @IsString() @IsOptional()
  lastName?: string;

  @IsString() @IsOptional()
  company?: string;

  @IsString() @IsOptional()
  email?: string;

  @IsString() @IsOptional()
  notes?: string;

  @IsBoolean() @IsOptional()
  favorite?: boolean;
}
