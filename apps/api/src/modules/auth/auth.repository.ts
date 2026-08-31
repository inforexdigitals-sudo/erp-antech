import { Injectable } from '@nestjs/common';
import { RefreshToken } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

export interface CreateRefreshTokenData {
  userId: string;
  tokenFamily: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface RecordLoginHistoryData {
  userId?: string;
  success: boolean;
  failureReason?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Owns every direct Prisma call Auth needs (refresh_tokens,
 * login_history) — kept out of AuthService so the "a service never
 * imports PrismaClient, only that module's repository does" rule
 * (docs/phase-3-system-architecture/folder-structure.md) actually
 * holds for the first module built, not just the ones after it.
 */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  async createRefreshToken(data: CreateRefreshTokenData): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  /**
   * Atomically claims a token for rotation: only succeeds if the token
   * is still the live tip of its family at the moment of the write.
   * Guards against two concurrent refresh calls presenting the same
   * token both passing the earlier read-only checks and each minting
   * their own "replacement" — only one `updateMany` can match the row
   * while it's still unrevoked, so the loser gets `count === 0` and
   * must back off instead of creating an orphaned valid token.
   */
  async claimRefreshTokenForRotation(id: string): Promise<boolean> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null, replacedById: null },
      data: { revokedAt: new Date() },
    });
    return result.count === 1;
  }

  async linkReplacementToken(oldTokenId: string, newTokenId: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id: oldTokenId },
      data: { replacedById: newTokenId },
    });
  }

  async revokeTokenFamily(tokenFamily: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenFamily, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeTokenByHash(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Called on password change — every other device/session's refresh token is invalidated, same as changing a password on most real accounts. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async recordLoginHistory(data: RecordLoginHistoryData): Promise<void> {
    await this.prisma.loginHistory.create({ data });
  }
}
