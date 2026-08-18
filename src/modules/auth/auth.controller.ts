import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterWorkerDto } from './dto/register-worker.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Request() req) {
    return this.authService.login(loginDto, {
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }

  @Post('register/worker')
  @HttpCode(HttpStatus.CREATED)
  async registerWorker(@Body() registerDto: RegisterWorkerDto) {
    return this.authService.registerWorker(registerDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req) {
    return req.user;
  }

  /**
   * Cambia la empresa sobre la que opera un representante que tiene varias.
   *
   * Vive en /auth y no en /companies porque no modifica la empresa: modifica la
   * SESION de quien pregunta. Devuelve el usuario completo para que el frontend
   * refresque `user.company` de una vez, sin una segunda vuelta a /auth/me.
   *
   * La validacion de pertenencia esta en el servicio, que es el unico punto por
   * donde se puede mover el puntero.
   */
  @Patch('empresa-activa/:companyId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async setActiveCompany(
    @Param('companyId', new ParseUUIDPipe({ version: '4' })) companyId: string,
    @Request() req,
  ) {
    return this.authService.setActiveCompany(req.user.id, companyId);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req) {
    return this.authService.logout(req.user.id, {
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }
}
