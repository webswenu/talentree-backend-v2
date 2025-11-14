import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../companies/entities/company.entity';

@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly invitationsService: InvitationsService,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createInvitationDto: CreateInvitationDto,
    @Request() req,
  ) {
    let companyId: string;

    if (req.user.role === UserRole.COMPANY) {
      // Buscar la empresa del usuario
      const company = await this.companyRepository.findOne({
        where: { user: { id: req.user.id } },
      });

      if (!company) {
        throw new BadRequestException(
          'No se encontró una empresa asociada al usuario',
        );
      }

      companyId = company.id;
    } else {
      companyId = createInvitationDto['companyId'];
    }

    return this.invitationsService.create(
      createInvitationDto,
      companyId,
      req.user.id,
    );
  }

  @Get('company/:companyId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY)
  findAll(@Param('companyId') companyId: string) {
    return this.invitationsService.findAll(companyId);
  }

  @Get('token/:token')
  findByToken(@Param('token') token: string) {
    return this.invitationsService.findByToken(token);
  }

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  acceptInvitation(@Body() acceptInvitationDto: AcceptInvitationDto) {
    return this.invitationsService.acceptInvitation(acceptInvitationDto);
  }

  @Patch(':id/resend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY)
  resendInvitation(@Param('id') id: string) {
    return this.invitationsService.resendInvitation(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY)
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelInvitation(@Param('id') id: string) {
    return this.invitationsService.cancelInvitation(id);
  }

  @Patch('user/:userId/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY)
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivateUser(@Param('userId') userId: string) {
    return this.invitationsService.deactivateUser(userId);
  }

  @Patch('user/:userId/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY)
  @HttpCode(HttpStatus.NO_CONTENT)
  reactivateUser(@Param('userId') userId: string) {
    return this.invitationsService.reactivateUser(userId);
  }
}
