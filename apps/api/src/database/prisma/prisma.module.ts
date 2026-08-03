import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global so every feature module can inject PrismaService without
 * re-importing this module everywhere — matches the "one pool per
 * process" intent in prisma.service.ts.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
