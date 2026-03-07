import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto } from './dto/create-contact.dto';

@Controller('contacts')
export class ContactsController {
  constructor(private contactsService: ContactsService) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.contactsService.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contactsService.findById(id);
  }

  @Get('phone/:phoneNumber')
  findByPhone(@Param('phoneNumber') phoneNumber: string) {
    return this.contactsService.findByPhone(phoneNumber);
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
