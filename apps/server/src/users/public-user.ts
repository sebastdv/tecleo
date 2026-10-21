import { AVATARS, type AvatarId, type PublicUser } from '@tecleo/shared';

import type { User } from '../generated/prisma/client.js';

function avatarOf(value: string | null): AvatarId | null {
  return AVATARS.find((avatar) => avatar === value) ?? null;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    nickname: user.nickname,
    avatar: avatarOf(user.avatar),
    country: user.country,
    level: user.level,
    xp: user.xp,
    createdAt: user.createdAt.toISOString(),
  };
}
