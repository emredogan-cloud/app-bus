import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from './jwt.service.js';
import { KeyLoader } from './key-loader.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [KeyLoader, JwtService],
  exports: [JwtService],
})
export class JwtModule {}
