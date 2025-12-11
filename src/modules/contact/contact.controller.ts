import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ContactService } from './contact.service';
import { SendContactFormDto } from './contact.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

@Controller('contact')
@UseGuards(JwtAuthGuard)
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  /**
   * Endpoint público para enviar formulario de contacto desde la landing page
   * Envía confirmación al remitente y notificación a contacto@talentree.cl
   */
  @Post('send')
  @Public()
  async sendContactForm(@Body() dto: SendContactFormDto) {
    return this.contactService.sendContactForm(dto);
  }
}
