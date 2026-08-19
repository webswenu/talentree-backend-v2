import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WorkerVideoRequirement,
  VideoRequirementStatus,
} from '../entities/worker-video-requirement.entity';
import { Worker } from '../../workers/entities/worker.entity';
import { UserRole } from '../../../common/enums/user-role.enum';

@Injectable()
export class VideoApprovedGuard implements CanActivate {
  constructor(
    @InjectRepository(WorkerVideoRequirement)
    private readonly videoRequirementRepository: Repository<WorkerVideoRequirement>,
    @InjectRepository(Worker)
    private readonly workerRepository: Repository<Worker>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user.role === UserRole.ADMIN_TALENTREE) {
      return true;
    }

    if (user.role !== UserRole.WORKER) {
      return true;
    }

    const workerId = request.body?.workerId || request.params?.workerId;

    if (!workerId) {
      throw new BadRequestException('No pudimos identificar tu perfil de candidato. Vuelve a iniciar sesión.');
    }

    const worker = await this.workerRepository.findOne({
      where: { id: workerId },
      relations: ['user'],
    });

    if (!worker) {
      throw new ForbiddenException('No encontramos tu perfil de candidato. Contacta al equipo de Talentree.');
    }

    if (worker.user.id !== user.userId) {
      throw new ForbiddenException(
        'You can only submit tests for your own profile',
      );
    }

    const approvedVideo = await this.videoRequirementRepository.findOne({
      where: {
        workerId,
        status: VideoRequirementStatus.APPROVED,
      },
    });

    if (!approvedVideo) {
      throw new ForbiddenException(
        'You must have an approved introductory video before accessing tests. Please upload your video and wait for approval.',
      );
    }

    return true;
  }
}
