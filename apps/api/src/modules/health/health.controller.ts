import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Used by the reverse proxy / load balancer and CI smoke tests
   * (docs/phase-3-system-architecture/deployment.md §3 and §6). Checks
   * the database is actually reachable, not just that the process is up.
   */
  @Public()
  @Get()
  async check(): Promise<{ status: 'ok' | 'degraded'; database: 'up' | 'down'; timestamp: string }> {
    let database: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      timestamp: new Date().toISOString(),
    };
  }
}
