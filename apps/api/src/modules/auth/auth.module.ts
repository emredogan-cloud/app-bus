import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { OAuthService } from './oauth/oauth.service.js';
import { GoogleVerifier } from './oauth/google.verifier.js';
import { AppleVerifier } from './oauth/apple.verifier.js';
import { JwksClient } from './oauth/jwks-client.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshTokenService,
    OAuthService,
    GoogleVerifier,
    AppleVerifier,
    JwksClient,
  ],
  exports: [AuthService, RefreshTokenService],
})
export class AuthModule {}
