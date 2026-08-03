import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { DocumentStorageService } from './document-storage.service';
import { DocumentsController } from './documents.controller';
import { DocumentsRepository } from './documents.repository';
import { DocumentsService } from './documents.service';

@Module({
  imports: [UsersModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsRepository, DocumentStorageService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
