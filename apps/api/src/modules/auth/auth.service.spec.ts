import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuditService } from '../../common/audit/audit.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { SymmetricEncryptionService } from '../../common/crypto/symmetric-encryption.service';
import { UsersRepository } from '../users/users.repository';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

const TEST_USER = {
  id: 'user-1',
  companyId: 'company-1',
  email: 'priya@antech.test',
  twoFactorEnabled: false,
  twoFactorSecretEncrypted: null as string | null,
};

describe('AuthService', () => {
  let authService: AuthService;
  let authRepository: {
    findRefreshTokenByHash: jest.Mock;
    createRefreshToken: jest.Mock;
    claimRefreshTokenForRotation: jest.Mock;
    linkReplacementToken: jest.Mock;
    revokeTokenFamily: jest.Mock;
    revokeTokenByHash: jest.Mock;
    revokeAllForUser: jest.Mock;
    recordLoginHistory: jest.Mock;
  };
  let users: {
    findActiveByEmail: jest.Mock;
    findById: jest.Mock;
    getEffectivePermissionCodes: jest.Mock;
    updateLastLoginAt: jest.Mock;
    updatePasswordHash: jest.Mock;
  };
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await argon2.hash('correct-horse-battery-staple');
  });

  beforeEach(() => {
    authRepository = {
      findRefreshTokenByHash: jest.fn(),
      createRefreshToken: jest.fn().mockResolvedValue({ id: 'rt-new', expiresAt: new Date(Date.now() + 1000) }),
      claimRefreshTokenForRotation: jest.fn().mockResolvedValue(true),
      linkReplacementToken: jest.fn(),
      revokeTokenFamily: jest.fn(),
      revokeTokenByHash: jest.fn(),
      revokeAllForUser: jest.fn(),
      recordLoginHistory: jest.fn(),
    };
    users = {
      findActiveByEmail: jest.fn(),
      findById: jest.fn(),
      getEffectivePermissionCodes: jest.fn().mockResolvedValue(['quotation.view']),
      updateLastLoginAt: jest.fn(),
      updatePasswordHash: jest.fn(),
    };

    const config = new ConfigService({
      jwt: { accessSecret: 'test-access-secret', refreshTtl: '30d', accessTtl: '15m' },
      nodeEnv: 'test',
      twoFactorEncryptionKey: 'test-2fa-key',
    });

    authService = new AuthService(
      authRepository as unknown as AuthRepository,
      users as unknown as UsersRepository,
      new JwtService(),
      config,
      { record: jest.fn() } as unknown as AuditService,
      { ipAddress: '127.0.0.1', userAgent: 'jest' } as unknown as RequestContextService,
      new SymmetricEncryptionService(config),
    );
  });

  describe('login', () => {
    it('rejects an unknown email without revealing that the account does not exist', async () => {
      users.findActiveByEmail.mockResolvedValue(null);

      await expect(authService.login('nobody@antech.test', 'whatever')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authRepository.recordLoginHistory).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });

    it('rejects a wrong password for a real user', async () => {
      users.findActiveByEmail.mockResolvedValue({ ...TEST_USER, passwordHash });

      await expect(authService.login(TEST_USER.email, 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('issues a token pair on correct credentials with 2FA disabled', async () => {
      users.findActiveByEmail.mockResolvedValue({ ...TEST_USER, passwordHash });

      const result = await authService.login(TEST_USER.email, 'correct-horse-battery-staple');

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.accessToken).toEqual(expect.any(String));
        expect(result.refreshToken).toEqual(expect.any(String));
      }
      expect(authRepository.createRefreshToken).toHaveBeenCalled();
      expect(users.updateLastLoginAt).toHaveBeenCalledWith(TEST_USER.id, expect.any(Date));
    });

    it('returns a 2FA challenge instead of tokens when the account has 2FA enabled', async () => {
      users.findActiveByEmail.mockResolvedValue({ ...TEST_USER, passwordHash, twoFactorEnabled: true });

      const result = await authService.login(TEST_USER.email, 'correct-horse-battery-staple');

      expect(result.status).toBe('requires_2fa');
      expect(authRepository.createRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('rejects a token that does not exist', async () => {
      authRepository.findRefreshTokenByHash.mockResolvedValue(null);

      await expect(authService.refresh('unknown-token')).rejects.toThrow(UnauthorizedException);
    });

    it('treats an already-rotated token as reuse and burns the whole family', async () => {
      authRepository.findRefreshTokenByHash.mockResolvedValue({
        id: 'rt-old',
        userId: TEST_USER.id,
        tokenFamily: 'family-1',
        replacedById: 'rt-someone-else',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100_000),
      });

      await expect(authService.refresh('stolen-and-already-used-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authRepository.revokeTokenFamily).toHaveBeenCalledWith('family-1');
      expect(authRepository.claimRefreshTokenForRotation).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      authRepository.findRefreshTokenByHash.mockResolvedValue({
        id: 'rt-old',
        userId: TEST_USER.id,
        tokenFamily: 'family-1',
        replacedById: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(authService.refresh('expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('rotates a valid token: issues a new pair and links the old one to its replacement', async () => {
      authRepository.findRefreshTokenByHash.mockResolvedValue({
        id: 'rt-old',
        userId: TEST_USER.id,
        tokenFamily: 'family-1',
        replacedById: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100_000),
      });
      users.findById.mockResolvedValue({ ...TEST_USER });

      const result = await authService.refresh('valid-current-token');

      expect(result.accessToken).toEqual(expect.any(String));
      expect(authRepository.claimRefreshTokenForRotation).toHaveBeenCalledWith('rt-old');
      expect(authRepository.linkReplacementToken).toHaveBeenCalledWith('rt-old', 'rt-new');
    });

    it('rejects when it loses the atomic-claim race to a concurrent refresh call on the same token', async () => {
      authRepository.findRefreshTokenByHash.mockResolvedValue({
        id: 'rt-old',
        userId: TEST_USER.id,
        tokenFamily: 'family-1',
        replacedById: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100_000),
      });
      users.findById.mockResolvedValue({ ...TEST_USER });
      authRepository.claimRefreshTokenForRotation.mockResolvedValue(false);

      await expect(authService.refresh('raced-token')).rejects.toThrow(UnauthorizedException);
      expect(authRepository.createRefreshToken).not.toHaveBeenCalled();
      expect(authRepository.linkReplacementToken).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('rejects the wrong current password without touching the stored hash or any session', async () => {
      users.findById.mockResolvedValue({ ...TEST_USER, passwordHash });

      await expect(
        authService.changePassword(TEST_USER.id, TEST_USER.companyId, 'wrong-current-password', 'a-new-password'),
      ).rejects.toThrow(BadRequestException);
      expect(users.updatePasswordHash).not.toHaveBeenCalled();
      expect(authRepository.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('updates the hash and revokes every refresh token for this user on a correct current password', async () => {
      users.findById.mockResolvedValue({ ...TEST_USER, passwordHash });

      await authService.changePassword(TEST_USER.id, TEST_USER.companyId, 'correct-horse-battery-staple', 'a-new-password');

      expect(users.updatePasswordHash).toHaveBeenCalledWith(TEST_USER.id, expect.any(String));
      expect(authRepository.revokeAllForUser).toHaveBeenCalledWith(TEST_USER.id);
    });
  });
});
