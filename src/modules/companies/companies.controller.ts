import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyFilterDto } from './dto/company-filter.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @Roles(UserRole.ADMIN_TALENTREE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companiesService.create(createCompanyDto);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  getStats() {
    return this.companiesService.getStats();
  }

  @Get(':id/dashboard-stats')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.EVALUATOR, UserRole.GUEST)
  getDashboardStats(@Param('id') id: string) {
    return this.companiesService.getDashboardStats(id);
  }

  @Get()
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.EVALUATOR)
  findAll(@Query() filters: CompanyFilterDto) {
    return this.companiesService.findAll(filters);
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN_TALENTREE,
    UserRole.COMPANY,
    UserRole.EVALUATOR,
    UserRole.GUEST,
  )
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.GUEST)
  update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto) {
    return this.companiesService.update(id, updateCompanyDto);
  }

  @Post(':id/logo')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.GUEST)
  @UseInterceptors(FileInterceptor('logo'))
  @HttpCode(HttpStatus.OK)
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|gif|webp|svg\+xml)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.companiesService.uploadLogo(id, file);
  }

  @Delete(':id/logo')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY, UserRole.GUEST)
  @HttpCode(HttpStatus.OK)
  async deleteLogo(@Param('id') id: string) {
    return this.companiesService.deleteLogo(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN_TALENTREE)
  async remove(@Param('id') id: string) {
    await this.companiesService.remove(id);
    return;
  }
}
