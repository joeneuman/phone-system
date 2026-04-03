import { Controller, Get, Post, Put, Delete, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto, BulkSyncDto } from './dto/create-contact.dto';
import { TwilioService } from '../twilio/twilio.service';

@Controller('contacts')
export class ContactsController {
  constructor(
    private contactsService: ContactsService,
    private twilioService: TwilioService,
  ) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.contactsService.findAll(search);
  }

  @Get('dedup/pending')
  getPendingReviews() {
    return this.contactsService.getPendingReviews();
  }

  @Post('dedup/run')
  @HttpCode(HttpStatus.OK)
  runDedup() {
    return this.contactsService.dedup();
  }

  @Post('dedup/resolve')
  @HttpCode(HttpStatus.OK)
  resolveReview(@Body() body: { reviewId: string; action: 'merge' | 'dismiss'; keepContactId?: string }) {
    return this.contactsService.resolveReview(body.reviewId, body.action, body.keepContactId);
  }

  @Get('phone/:phoneNumber')
  findByPhone(@Param('phoneNumber') phoneNumber: string) {
    return this.contactsService.findByPhone(phoneNumber);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  bulkSync(@Body() dto: BulkSyncDto) {
    return this.contactsService.bulkSync(dto.contacts);
  }

  @Get('lookup/:phoneNumber')
  async lookupNumber(@Param('phoneNumber') phoneNumber: string) {
    try {
      const result = await this.twilioService.getClient()
        .lookups.v2.phoneNumbers(phoneNumber)
        .fetch({ fields: 'line_type_intelligence' });
      const lineType = result.lineTypeIntelligence?.type || 'unknown';
      return { number: phoneNumber, type: lineType };
    } catch (e) {
      return { number: phoneNumber, type: 'unknown', error: e.message };
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contactsService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateContactDto) {
    return this.contactsService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contactsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.contactsService.delete(id);
  }
}
