import { Controller, Get, Put, Body } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  private availableNumbers: { number: string; label: string }[];

  constructor(
    private settingsService: SettingsService,
    private config: ConfigService,
  ) {
    const fmt = (e164: string) => {
      const d = e164.replace(/^\+1/, '');
      return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : e164;
    };
    const n1 = this.config.get<string>('TWILIO_PHONE_NUMBER') || '';
    const n2 = this.config.get<string>('TWILIO_PHONE_NUMBER_2') || '';
    this.availableNumbers = [{ number: n1, label: fmt(n1) }];
    if (n2) this.availableNumbers.push({ number: n2, label: fmt(n2) });
  }

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

  @Get('phone-numbers')
  getPhoneNumbers() {
    return { numbers: this.availableNumbers };
  }

  @Get('active-number')
  async getActiveNumber() {
    const saved = await this.settingsService.get('activePhoneNumber');
    const number = (saved && this.availableNumbers.some((n) => n.number === saved))
      ? saved
      : this.availableNumbers[0]?.number;
    return { number };
  }

  @Put('active-number')
  async setActiveNumber(@Body() body: { number: string }) {
    await this.settingsService.set('activePhoneNumber', body.number);
    return { number: body.number };
  }
}
