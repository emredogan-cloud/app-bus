import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { JwtService, TokenError } from '../jwt/jwt.service.js';
import type { AccessTokenClaims } from '../jwt/jwt.service.js';

export const IS_PUBLIC_KEY = 'auth:is_public';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Augmented request shape for downstream handlers.
 */
export interface AuthedRequest extends Request {
  user?: AccessTokenClaims;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = extractBearer(req);
    if (!token) throw new UnauthorizedException({ code: 'missing_token' });

    try {
      req.user = await this.jwt.verifyAccessToken(token);
      return true;
    } catch (err) {
      if (err instanceof TokenError) {
        throw new UnauthorizedException({ code: err.code, detail: err.message });
      }
      throw new UnauthorizedException({ code: 'invalid_token' });
    }
  }
}

/** Decorates handlers that work for both authed + anonymous callers. */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = extractBearer(req);
    if (!token) return true;
    try {
      req.user = await this.jwt.verifyAccessToken(token);
    } catch {
      // Anonymous fallback — do not error.
    }
    return true;
  }
}

function extractBearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}
