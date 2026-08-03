import { Global, Module } from '@nestjs/common';
import { SymmetricEncryptionService } from './symmetric-encryption.service';

@Global()
@Module({
  providers: [SymmetricEncryptionService],
  exports: [SymmetricEncryptionService],
})
export class CryptoModule {}
