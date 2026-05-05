import { Global, Module } from '@nestjs/common';
import { PasswordHasher } from './password-hasher.service.js';

@Global()
@Module({
  providers: [PasswordHasher],
  exports: [PasswordHasher],
})
export class CryptoModule {}
