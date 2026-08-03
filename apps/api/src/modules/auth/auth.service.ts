import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';
import ms from 'ms';
import { authenticator } from 'otplib';
import { AuditService } from '../../common/audit/audit.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { SymmetricEncryptionService } from '../../common/crypto/symmetric-encryption.service';
import { AuthenticatedUser, JwtAccessPayload, TwoFactorChallengePayload } from '../../common/types/auth.types';
import { UsersRepository } from '../users/users.repository';
import { AuthRepository } from './auth.repository';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export type LoginResult = { status: 'requires_2fa'; challengeToken: string } | ({ status: 'success' } & TokenPair);

/**
 * A syntactically valid but meaningless argon2id hash, verified against
 * when the looked-up user doesn't exist, so an unknown-email login
 * costs roughly the same CPU time as a real-but-wrong-password one —
 * best-effort mitigation against timing-based user enumeration, not a
 * guarantee (network jitter dwarfs the timing difference this closes).
 */
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$8OaLwXOZbkoTFOTIQVFvS3wz9L6XW3P5x8p8V8Q3o0E';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly users: UsersRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly context: RequestContextService,
    private readonly encryption: SymmetricEncryptionService,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.users.findActiveByEmail(email);

    const passwordOk = await argon2
      .verify(user?.passwordHash ?? DUMMY_PASSWORD_HASH, password)
      .catch(() => false);

    if (!user || !passwordOk) {
      await this.recordLoginAttempt(user?.id, user?.companyId, false, 'invalid_credentials');
      throw new UnauthorizedException('Incorrect email or password.');
    }

    if (user.twoFactorEnabled) {
      const challengeToken = this.jwt.sign(
        { sub: user.id, companyId: user.companyId, type: 'twofa_challenge' } satisfies TwoFactorChallengePayload,
        { secret: this.config.getOrThrow<string>('jwt.accessSecret'), expiresIn: '5m' },
      );
      return { status: 'requires_2fa', challengeToken };
    }

    const tokens = await this.issueTokenPair(user.id, user.companyId);
    await this.recordLoginAttempt(user.id, user.companyId, true);
    await this.users.updateLastLoginAt(user.id, new Date());
    return { status: 'success', ...tokens };
  }

  async verify2fa(challengeToken: string, code: string): Promise<TokenPair> {
    let payload: TwoFactorChallengePayload;
    try {
      payload = this.jwt.verify<TwoFactorChallengePayload>(challengeToken, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      });
    } catch {
      throw new UnauthorizedException('This sign-in attempt has expired — log in again.');
    }
    if (payload.type !== 'twofa_challenge') {
      throw new UnauthorizedException('Invalid challenge token.');
    }

    const user = await this.users.findById(payload.sub);
    if (!user?.twoFactorEnabled || !user.twoFactorSecretEncrypted) {
      throw new UnauthorizedException('Two-factor authentication is not set up for this account.');
    }

    const secret = this.encryption.decrypt(user.twoFactorSecretEncrypted);
    if (!authenticator.check(code, secret)) {
      await this.recordLoginAttempt(user.id, user.companyId, false, 'invalid_2fa_code');
      throw new UnauthorizedException('Incorrect authentication code.');
    }

    await this.recordLoginAttempt(user.id, user.companyId, true);
    await this.users.updateLastLoginAt(user.id, new Date());
    return this.issueTokenPair(user.id, user.companyId);
  }

  /**
   * Rotates a refresh token. Presenting a token that isn't the current
   * tip of its family (already revoked, or already superseded) is
   * treated as reuse — the entire family is burned and the caller has
   * to log in again. This is the standard mitigation for "attacker
   * steals a refresh token and replays it after the legitimate client
   * already rotated past it."
   *
   * The rotation itself claims the token atomically (see
   * AuthRepository.claimRefreshTokenForRotation) before minting its
   * replacement — without that, two concurrent refresh calls
   * presenting the same token could both pass the checks above and
   * each create their own "replacement," leaving an orphaned valid
   * token outside the tracked chain.
   */
  async refresh(rawToken: string): Promise<TokenPair> {
    const tokenHash = hashToken(rawToken);
    const existing = await this.authRepository.findRefreshTokenByHash(tokenHash);

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    if (existing.revokedAt || existing.replacedById) {
      await this.authRepository.revokeTokenFamily(existing.tokenFamily);
      throw new UnauthorizedException('This session has been revoked — please log in again.');
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired — please log in again.');
    }

    const user = await this.users.findById(existing.userId);
    if (!user) {
      throw new UnauthorizedException('Account no longer exists.');
    }

    const claimed = await this.authRepository.claimRefreshTokenForRotation(existing.id);
    if (!claimed) {
      // Lost a race to a concurrent refresh call using the same token.
      throw new UnauthorizedException('This refresh token was already used — please log in again.');
    }

    const created = await this.createRefreshTokenRecord(user.id, existing.tokenFamily);
    await this.authRepository.linkReplacementToken(existing.id, created.id);

    const accessToken = this.signAccessToken(await this.buildAccessPayload(user.id, user.companyId));
    return {
      accessToken,
      refreshToken: created.rawToken,
      refreshTokenExpiresAt: created.expiresAt,
    };
  }

  async logout(rawToken: string): Promise<void> {
    await this.authRepository.revokeTokenByHash(hashToken(rawToken));
  }

  private async issueTokenPair(userId: string, companyId: string): Promise<TokenPair> {
    const accessToken = this.signAccessToken(await this.buildAccessPayload(userId, companyId));
    const created = await this.createRefreshTokenRecord(userId, randomUUID());
    return {
      accessToken,
      refreshToken: created.rawToken,
      refreshTokenExpiresAt: created.expiresAt,
    };
  }

  private async buildAccessPayload(userId: string, companyId: string): Promise<JwtAccessPayload> {
    const permissions = await this.users.getEffectivePermissionCodes(userId);
    return { sub: userId, companyId, permissions, type: 'access' };
  }

  private signAccessToken(payload: JwtAccessPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessTtl') ?? '15m',
    });
  }

  private async createRefreshTokenRecord(
    userId: string,
    tokenFamily: string,
  ): Promise<{ id: string; rawToken: string; expiresAt: Date }> {
    const rawToken = randomBytes(48).toString('base64url');
    const ttlMs = ms(this.config.get<string>('jwt.refreshTtl') ?? '30d');
    const expiresAt = new Date(Date.now() + ttlMs);

    const row = await this.authRepository.createRefreshToken({
      userId,
      tokenFamily,
      tokenHash: hashToken(rawToken),
      expiresAt,
    });

    return { id: row.id, rawToken, expiresAt };
  }

  private async recordLoginAttempt(
    userId: string | undefined,
    companyId: string | undefined,
    success: boolean,
    failureReason?: string,
  ): Promise<void> {
    await this.authRepository.recordLoginHistory({
      userId,
      success,
      failureReason,
      ipAddress: this.context.ipAddress,
      userAgent: this.context.userAgent,
    });
    if (userId && companyId) {
      await this.audit.record({
        companyId,
        actorUserId: userId,
        action: success ? 'login' : 'login_failed',
        entityType: 'user',
        entityId: userId,
      });
    }
  }
}

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** Re-exported so controllers can type their response without reaching into the service module. */
export type { AuthenticatedUser };
