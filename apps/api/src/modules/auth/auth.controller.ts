import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiBody } from '@nestjs/swagger';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import { OAuthService } from './oauth/oauth.service.js';
import { Public } from './auth.guard.js';
import { LoginThrottleService } from '../rate-limit/login-throttle.service.js';
import {
  ForgotPasswordDto,
  ForgotPasswordDtoSchema,
  LoginDto,
  LoginDtoSchema,
  OAuthDto,
  OAuthDtoSchema,
  RefreshDto,
  RefreshDtoSchema,
  RegisterDto,
  RegisterDtoSchema,
  ResetPasswordDto,
  ResetPasswordDtoSchema,
} from './auth.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly oauth: OAuthService,
    private readonly throttle: LoginThrottleService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOkResponse({ description: 'Registered + auto-logged-in user' })
  @ApiBody({
    schema: {
      example: {
        email: 'a@b.com',
        password: 'StrongP4ss',
        name: 'Ada',
        locale: 'tr',
        kvkk_consent_version: '2026-05-05',
        marketing_opt_in: false,
      },
    },
  })
  async register(
    @Body(new ZodValidationPipe(RegisterDtoSchema)) body: RegisterDto,
    @Req() req: Request,
  ) {
    return this.auth.register({
      email: body.email,
      password: body.password,
      name: body.name,
      locale: body.locale,
      kvkkConsentVersion: body.kvkk_consent_version,
      marketingOptIn: body.marketing_opt_in,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body(new ZodValidationPipe(LoginDtoSchema)) body: LoginDto, @Req() req: Request) {
    const ip = req.ip ?? 'unknown';
    const gate = await this.throttle.checkAttempt(ip);
    if (!gate.allowed) {
      throw new HttpException(
        { code: 'too_many_login_attempts', retry_after_ms: gate.retryAfterMs },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    try {
      return await this.auth.login({
        email: body.email,
        password: body.password,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
    } catch (err) {
      // Failed login still counts against the bucket (already consumed above);
      // intentional — protects from credential stuffing.
      throw err;
    }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(new ZodValidationPipe(RefreshDtoSchema)) body: RefreshDto,
    @Req() req: Request,
  ) {
    return this.auth.refreshSession({
      refreshToken: body.refresh_token,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body(new ZodValidationPipe(RefreshDtoSchema)) body: RefreshDto) {
    await this.auth.logout(body.refresh_token);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgot(
    @Body(new ZodValidationPipe(ForgotPasswordDtoSchema)) body: ForgotPasswordDto,
    @Req() req: Request,
  ) {
    await this.auth.beginPasswordReset({ email: body.email, ip: req.ip });
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reset(@Body(new ZodValidationPipe(ResetPasswordDtoSchema)) body: ResetPasswordDto) {
    await this.auth.completePasswordReset({
      token: body.token,
      newPassword: body.new_password,
    });
  }

  @Public()
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    if (!token) throw new UnauthorizedException({ code: 'verify_token_invalid' });
    await this.auth.verifyEmail(token);
    return { ok: true };
  }

  @Public()
  @Post('oauth/google')
  @HttpCode(HttpStatus.OK)
  async google(@Body(new ZodValidationPipe(OAuthDtoSchema)) body: OAuthDto, @Req() req: Request) {
    return this.oauth.signInWithGoogle({
      idToken: body.id_token,
      kvkkConsentVersion: body.kvkk_consent_version,
      marketingOptIn: body.marketing_opt_in ?? false,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
  }

  @Public()
  @Post('oauth/apple')
  @HttpCode(HttpStatus.OK)
  async apple(@Body(new ZodValidationPipe(OAuthDtoSchema)) body: OAuthDto, @Req() req: Request) {
    return this.oauth.signInWithApple({
      idToken: body.id_token,
      kvkkConsentVersion: body.kvkk_consent_version,
      marketingOptIn: body.marketing_opt_in ?? false,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
  }
}
