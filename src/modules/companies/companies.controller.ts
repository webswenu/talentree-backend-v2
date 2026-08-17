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
import { assertBelongsToUserCompany } from '../../common/helpers/ownership.helper';
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
  getDashboardStats(@Param('id') id: string, @Request() req) {
    this.assertOwnCompany(req, id);
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
  findOne(@Param('id') id: string, @Request() req) {
    this.assertOwnCompany(req, id);
    return this.companiesService.findOne(id);
  }

  // El Invitado es de solo consulta: no edita la ficha de la empresa.
  @Patch(':id')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY)
  update(
    @Param('id') id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @Request() req,
  ) {
    this.assertOwnCompany(req, id);
    return this.companiesService.update(id, updateCompanyDto);
  }

  @Post(':id/logo')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY)
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
    @Request() req,
  ) {
    this.assertOwnCompany(req, id);
    return this.companiesService.uploadLogo(id, file);
  }

  @Delete(':id/logo')
  @Roles(UserRole.ADMIN_TALENTREE, UserRole.COMPANY)
  @HttpCode(HttpStatus.OK)
  async deleteLogo(@Param('id') id: string, @Request() req) {
    this.assertOwnCompany(req, id);
    return this.companiesService.deleteLogo(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN_TALENTREE)
  async remove(@Param('id') id: string) {
    await this.companiesService.remove(id);
    return;
  }

  /**
   * P-22 / P-35. Los roles COMPANY y GUEST solo pueden apuntar a SU empresa.
   * Sin esto, cualquiera de los dos editaba la ficha, el logo y las estadisticas
   * de cualquier otra empresa con solo cambiar el id de la URL.
   */
  private assertOwnCompany(req: any, companyId: string): void {
    assertBelongsToUserCompany(req.user, companyId, 'esta empresa');
  }
}
