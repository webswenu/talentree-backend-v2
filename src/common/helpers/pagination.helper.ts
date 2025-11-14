import { Repository, SelectQueryBuilder } from 'typeorm';
import { PaginationDto, PaginatedResult } from '../dto/pagination.dto';

/**
 * Helper para paginar resultados de TypeORM
 * @param repository - Repository de TypeORM
 * @param options - Opciones de paginación (page, limit)
 * @param queryBuilder - QueryBuilder opcional para consultas personalizadas
 * @returns Resultado paginado con data y meta
 */
export async function paginate<T>(
  repository: Repository<T>,
  options: PaginationDto,
  queryBuilder?: SelectQueryBuilder<T>,
): Promise<PaginatedResult<T>> {
  const { page = 1, limit = 10 } = options;

  const builder = queryBuilder || repository.createQueryBuilder();

  const [data, total] = await builder
    .skip((page - 1) * limit)
    .take(limit)
    .getManyAndCount();

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
