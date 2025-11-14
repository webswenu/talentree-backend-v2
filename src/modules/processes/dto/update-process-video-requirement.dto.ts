import { PartialType } from '@nestjs/mapped-types';
import { CreateProcessVideoRequirementDto } from './create-process-video-requirement.dto';

export class UpdateProcessVideoRequirementDto extends PartialType(
  CreateProcessVideoRequirementDto,
) {}
