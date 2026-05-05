import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import type { FavoriteTarget } from '@prisma/client';
import type { AppEnv } from '../../config/env.js';

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  list(userId: string) {
    return this.prisma.userFavorite.findMany({
      where: { user_id: userId },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    });
  }

  async add(userId: string, target_type: FavoriteTarget, target_id: string, label?: string) {
    // Free-tier cap (Phase 8). Premium = unlimited.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { premium_tier: true },
    });
    const cap = this.config.get('FREE_TIER_MAX_FAVORITES', { infer: true });
    const existingCount = await this.prisma.userFavorite.count({ where: { user_id: userId } });
    if (user?.premium_tier !== 'premium' && existingCount >= cap) {
      throw new ForbiddenException({
        code: 'free_tier_favorite_limit',
        detail: `Upgrade to Premium for unlimited favorites (free limit: ${cap}).`,
      });
    }

    try {
      return await this.prisma.userFavorite.create({
        data: { user_id: userId, target_type, target_id, label, sort_order: existingCount },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new ConflictException({ code: 'favorite_already_exists' });
      }
      throw err;
    }
  }

  async remove(userId: string, id: string) {
    const r = await this.prisma.userFavorite.deleteMany({
      where: { id, user_id: userId },
    });
    if (r.count === 0) throw new NotFoundException({ code: 'favorite_not_found' });
  }

  async reorder(userId: string, ids: string[]): Promise<void> {
    // Single transaction; bumps the sort_order to match the array's index.
    await this.prisma.$transaction(
      ids.map((id, i) =>
        this.prisma.userFavorite.updateMany({
          where: { id, user_id: userId },
          data: { sort_order: i },
        }),
      ),
    );
  }
}
