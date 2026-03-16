import { Controller, Get, Put, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get('forwarding')
  async getForwarding() {
    const val = await this.settingsService.get('callForwarding');
    return val || { enabled: false, number: '' };
  }

  @Put('forwarding')
  async setForwarding(@Body() body: { enabled: boolean; number: string }) {
    await this.settingsService.set('callForwarding', {
      enabled: body.enabled,
      number: body.number,
    });
    return { enabled: body.enabled, number: body.number };
  }
}
