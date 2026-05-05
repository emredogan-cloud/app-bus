import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DevicePlatform } from '@prisma/client';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Upsert by expo_push_token: re-binding the same token to a new user is allowed. */
  upsert(input: { userId: string; expoPushToken: string; platform: DevicePlatform }) {
    return this.prisma.deviceToken.upsert({
      where: { expo_push_token: input.expoPushToken },
      create: {
        user_id: input.userId,
        expo_push_token: input.expoPushToken,
        platform: input.platform,
      },
      update: {
        user_id: input.userId,
        platform: input.platform,
        last_seen_at: new Date(),
      },
    });
  }

  remove(userId: string, expoPushToken: string) {
    return this.prisma.deviceToken.deleteMany({
      where: { user_id: userId, expo_push_token: expoPushToken },
    });
  }

  listForUser(userId: string) {
    return this.prisma.deviceToken.findMany({
      where: { user_id: userId },
      orderBy: { last_seen_at: 'desc' },
    });
  }

  /** Called by the dispatcher when Expo returns DeviceNotRegistered. */
  invalidate(expoPushToken: string) {
    return this.prisma.deviceToken.deleteMany({ where: { expo_push_token: expoPushToken } });
  }
}
