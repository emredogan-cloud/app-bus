import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { FavoriteTarget } from '@prisma/client';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.userFavorite.findMany({
      where: { user_id: userId },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    });
  }

  async add(userId: string, target_type: FavoriteTarget, target_id: string, label?: string) {
    try {
      const existingCount = await this.prisma.userFavorite.count({ where: { user_id: userId } });
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
