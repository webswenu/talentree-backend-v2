import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invitation, InvitationStatus } from './entities/invitation.entity';
import { User } from '../users/entities/user.entity';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { EmailHelper } from '../../common/helpers/email.helper';
import { UserRole } from '../../common/enums/user-role.enum';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(Invitation)
    private readonly invitationRepository: Repository<Invitation>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(
    createInvitationDto: CreateInvitationDto,
    companyId: string,
    invitedById: string,
  ): Promise<Invitation> {
    // Verificar si el email ya está registrado
    const existingUser = await this.userRepository.findOne({
      where: { email: createInvitationDto.email },
    });

    if (existingUser) {
      throw new ConflictException(
        'Ya existe un usuario registrado con este email',
      );
    }

    // Verificar si ya existe una invitación pendiente
    const existingInvitation = await this.invitationRepository.findOne({
      where: {
        email: createInvitationDto.email,
        companyId: companyId,
        status: InvitationStatus.PENDING,
      },
    });

    if (existingInvitation) {
      throw new ConflictException(
        'Ya existe una invitación pendiente para este email',
      );
    }

    // Generar token único
    const token = crypto.randomBytes(32).toString('hex');

    // Crear invitación con expiración de 7 días
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = this.invitationRepository.create({
      ...createInvitationDto,
      token,
      companyId,
      invitedById,
      expiresAt,
      status: InvitationStatus.PENDING,
    });

    const savedInvitation = await this.invitationRepository.save(invitation);

    // Enviar email de invitación
    try {
      const invitationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accept-invitation/${token}`;

      await EmailHelper.sendEmail(
        createInvitationDto.email,
        'Invitación a Talentree',
        `Hola ${createInvitationDto.firstName},\n\nHas sido invitado a unirte a Talentree como usuario invitado.\n\nHaz clic en el siguiente enlace para aceptar la invitación:\n${invitationLink}\n\nEste enlace expirará en 7 días.\n\nSaludos,\nEquipo Talentree`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Invitación a Talentree</h2>
            <p>Hola <strong>${createInvitationDto.firstName}</strong>,</p>
            <p>Has sido invitado a unirte a Talentree como usuario invitado.</p>
            <p>Haz clic en el siguiente botón para aceptar la invitación:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invitationLink}"
                 style="background-color: #2563eb; color: white; padding: 12px 24px;
                        text-decoration: none; border-radius: 6px; display: inline-block;">
                Aceptar Invitación
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              Este enlace expirará en 7 días.
            </p>
            <p style="color: #666; font-size: 14px;">
              Si no solicitaste esta invitación, puedes ignorar este correo.
            </p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px;">
              Equipo Talentree
            </p>
          </div>
        `,
      );
    } catch (error) {
      console.error('Error sending invitation email:', error);
      // No lanzamos error para no fallar la creación de la invitación
    }

    return savedInvitation;
  }

  async findAll(companyId: string): Promise<{
    sent: Invitation[];
    registered: Invitation[];
    pending: Invitation[];
  }> {
    const invitations = await this.invitationRepository.find({
      where: { companyId },
      relations: ['user', 'invitedBy'],
      order: { createdAt: 'DESC' },
    });

    const now = new Date();

    // Actualizar invitaciones expiradas
    for (const invitation of invitations) {
      if (
        invitation.status === InvitationStatus.PENDING &&
        invitation.expiresAt < now
      ) {
        invitation.status = InvitationStatus.EXPIRED;
        await this.invitationRepository.save(invitation);
      }
    }

    return {
      sent: invitations.filter(
        (inv) =>
          inv.status === InvitationStatus.PENDING ||
          inv.status === InvitationStatus.EXPIRED ||
          inv.status === InvitationStatus.CANCELLED,
      ),
      registered: invitations.filter(
        (inv) => inv.status === InvitationStatus.ACCEPTED,
      ),
      pending: invitations.filter(
        (inv) => inv.status === InvitationStatus.PENDING,
      ),
    };
  }

  async findByToken(token: string): Promise<Invitation> {
    const invitation = await this.invitationRepository.findOne({
      where: { token },
      relations: ['company'],
    });

    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Esta invitación ya fue utilizada');
    }

    if (invitation.expiresAt < new Date()) {
      invitation.status = InvitationStatus.EXPIRED;
      await this.invitationRepository.save(invitation);
      throw new BadRequestException('Esta invitación ha expirado');
    }

    return invitation;
  }

  async acceptInvitation(
    acceptInvitationDto: AcceptInvitationDto,
  ): Promise<{ message: string; user: User }> {
    const invitation = await this.findByToken(acceptInvitationDto.token);

    // Crear usuario GUEST
    const hashedPassword = await bcrypt.hash(acceptInvitationDto.password, 10);

    const user = this.userRepository.create({
      email: invitation.email,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      password: hashedPassword,
      role: UserRole.GUEST,
      companyId: invitation.companyId,
      isActive: true,
      isEmailVerified: true,
    });

    const savedUser = await this.userRepository.save(user);

    // Actualizar invitación
    invitation.status = InvitationStatus.ACCEPTED;
    invitation.acceptedAt = new Date();
    invitation.userId = savedUser.id;
    await this.invitationRepository.save(invitation);

    return {
      message: 'Invitación aceptada exitosamente',
      user: savedUser,
    };
  }

  async resendInvitation(id: string): Promise<Invitation> {
    const invitation = await this.invitationRepository.findOne({
      where: { id },
    });

    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada');
    }

    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new BadRequestException('Esta invitación ya fue aceptada');
    }

    // Generar nuevo token y extender expiración
    invitation.token = crypto.randomBytes(32).toString('hex');
    invitation.expiresAt = new Date();
    invitation.expiresAt.setDate(invitation.expiresAt.getDate() + 7);
    invitation.status = InvitationStatus.PENDING;

    const updatedInvitation =
      await this.invitationRepository.save(invitation);

    // Reenviar email
    try {
      const invitationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accept-invitation/${invitation.token}`;

      await EmailHelper.sendEmail(
        invitation.email,
        'Invitación a Talentree (Reenviada)',
        `Hola ${invitation.firstName},\n\nTe hemos reenviado tu invitación a Talentree.\n\nHaz clic en el siguiente enlace para aceptar la invitación:\n${invitationLink}\n\nEste enlace expirará en 7 días.\n\nSaludos,\nEquipo Talentree`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Invitación a Talentree (Reenviada)</h2>
            <p>Hola <strong>${invitation.firstName}</strong>,</p>
            <p>Te hemos reenviado tu invitación a Talentree como usuario invitado.</p>
            <p>Haz clic en el siguiente botón para aceptar la invitación:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invitationLink}"
                 style="background-color: #2563eb; color: white; padding: 12px 24px;
                        text-decoration: none; border-radius: 6px; display: inline-block;">
                Aceptar Invitación
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              Este enlace expirará en 7 días.
            </p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px;">
              Equipo Talentree
            </p>
          </div>
        `,
      );
    } catch (error) {
      console.error('Error resending invitation email:', error);
    }

    return updatedInvitation;
  }

  async cancelInvitation(id: string): Promise<void> {
    const invitation = await this.invitationRepository.findOne({
      where: { id },
    });

    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada');
    }

    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new BadRequestException(
        'No se puede cancelar una invitación ya aceptada',
      );
    }

    invitation.status = InvitationStatus.CANCELLED;
    await this.invitationRepository.save(invitation);
  }

  async deactivateUser(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.role !== UserRole.GUEST) {
      throw new BadRequestException(
        'Solo se pueden desactivar usuarios invitados',
      );
    }

    user.isActive = false;
    await this.userRepository.save(user);
  }

  async reactivateUser(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.role !== UserRole.GUEST) {
      throw new BadRequestException(
        'Solo se pueden reactivar usuarios invitados',
      );
    }

    user.isActive = true;
    await this.userRepository.save(user);
  }
}
