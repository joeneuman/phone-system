import { Controller, Get, Query } from '@nestjs/common';
import { CallsService } from './calls.service';

@Controller('calls')
export class CallsController {
  constructor(private callsService: CallsService) {}

  @Get()
  getHistory(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.callsService.getCallHistory(
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
  }
}
