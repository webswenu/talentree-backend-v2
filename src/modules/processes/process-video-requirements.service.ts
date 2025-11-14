import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessVideoRequirement } from './entities/process-video-requirement.entity';
import { SelectionProcess } from './entities/selection-process.entity';
import {
  CreateProcessVideoRequirementDto,
  UpdateProcessVideoRequirementDto,
} from './dto';

@Injectable()
export class ProcessVideoRequirementsService {
  constructor(
    @InjectRepository(ProcessVideoRequirement)
    private readonly processVideoRequirementRepository: Repository<ProcessVideoRequirement>,
    @InjectRepository(SelectionProcess)
    private readonly processRepository: Repository<SelectionProcess>,
  ) {}

  async create(
    processId: string,
    createDto: CreateProcessVideoRequirementDto,
  ): Promise<ProcessVideoRequirement> {
    const process = await this.processRepository.findOne({
      where: { id: processId },
    });

    if (!process) {
      throw new NotFoundException(`Proceso con ID ${processId} no encontrado`);
    }

    const existingConfig =
      await this.processVideoRequirementRepository.findOne({
        where: { processId },
      });

    if (existingConfig) {
      throw new ConflictException(
        'Este proceso ya tiene una configuración de video',
      );
    }

    const videoRequirement = this.processVideoRequirementRepository.create({
      processId,
      isRequired: createDto.isRequired,
      maxDuration: createDto.maxDuration,
      questions: createDto.questions,
      instructions: createDto.instructions,
    });

    return this.processVideoRequirementRepository.save(videoRequirement);
  }

  async findByProcess(
    processId: string,
  ): Promise<ProcessVideoRequirement | null> {
    return this.processVideoRequirementRepository.findOne({
      where: { processId },
      relations: ['process'],
    });
  }

  async update(
    processId: string,
    updateDto: UpdateProcessVideoRequirementDto,
  ): Promise<ProcessVideoRequirement> {
    const videoRequirement = await this.processVideoRequirementRepository.findOne({
      where: { processId },
    });

    if (!videoRequirement) {
      throw new NotFoundException(
        `No se encontró configuración de video para el proceso ${processId}`,
      );
    }

    Object.assign(videoRequirement, updateDto);

    return this.processVideoRequirementRepository.save(videoRequirement);
  }

  async delete(processId: string): Promise<void> {
    const videoRequirement = await this.processVideoRequirementRepository.findOne({
      where: { processId },
    });

    if (!videoRequirement) {
      throw new NotFoundException(
        `No se encontró configuración de video para el proceso ${processId}`,
      );
    }

    await this.processVideoRequirementRepository.remove(videoRequirement);
  }

  async isVideoRequiredForProcess(processId: string): Promise<boolean> {
    const videoRequirement = await this.processVideoRequirementRepository.findOne({
      where: { processId },
    });

    return videoRequirement?.isRequired || false;
  }

  async getAll(): Promise<ProcessVideoRequirement[]> {
    return this.processVideoRequirementRepository.find({
      relations: ['process'],
      order: { createdAt: 'DESC' },
    });
  }
}
