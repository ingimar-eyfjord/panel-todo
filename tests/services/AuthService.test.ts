/**
 * Unit tests for AuthService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from '../../src/services/AuthService';
import { createMockExtensionContext, MockExtensionContext, workspace, window, env } from '../__mocks__/vscode';
import { CONFIG, STORAGE_KEYS, UserTier } from '../../src/types';
import * as utils from '../../src/utils';

// Mock utils module
vi.mock('../../src/utils', () => ({
  requestJson: vi.fn(),
  delay: vi.fn().mockResolvedValue(undefined),
}));

describe('AuthService', () => {
  let context: MockExtensionContext;
  let authService: AuthService;
  let originalDevMode: boolean;

  beforeEach(() => {
    context = createMockExtensionContext();
    authService = new AuthService(context as any);

    // Store original DEV_MODE
    originalDevMode = CONFIG.DEV_MODE;
    (CONFIG as any).DEV_MODE = false;

    // Reset mocks
    vi.clearAllMocks();

    // Setup workspace mock
    workspace.getConfiguration = vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue('https://api.panel-todo.com'),
    });
  });

  afterEach(() => {
    // Restore DEV_MODE
    (CONFIG as any).DEV_MODE = originalDevMode;
  });

  describe('Initial State', () => {
    it('should have null user initially', () => {
      expect(authService.user).toBeNull();
    });

    it('should not have pending auth initially', () => {
      expect(authService.authPending).toBeNull();
    });

    it('should not be in auth progress initially', () => {
      expect(authService.isAuthInProgress).toBe(false);
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no token', async () => {
      const result = await authService.isAuthenticated();
      expect(result).toBe(false);
    });

    it('should return true when token exists', async () => {
      await context.secrets.store(STORAGE_KEYS.ACCESS_TOKEN, 'test-token');

      const result = await authService.isAuthenticated();
      expect(result).toBe(true);
    });

    it('should return true in dev mode when tier is not "out"', async () => {
      (CONFIG as any).DEV_MODE = true;
      authService.setDevFakeTier('pro');

      const result = await authService.isAuthenticated();
      expect(result).toBe(true);
    });

    it('should return false in dev mode when tier is "out"', async () => {
      (CONFIG as any).DEV_MODE = true;
      authService.setDevFakeTier('out');

      const result = await authService.isAuthenticated();
      expect(result).toBe(false);
    });
  });

  describe('isPro', () => {
    it('should return false when no user', () => {
      expect(authService.isPro()).toBe(false);
    });

    it('should return true in dev mode with pro tier', () => {
      (CONFIG as any).DEV_MODE = true;
      authService.setDevFakeTier('pro');

      expect(authService.isPro()).toBe(true);
    });

    it('should return true in dev mode with team tier', () => {
      (CONFIG as any).DEV_MODE = true;
      authService.setDevFakeTier('team');

      expect(authService.isPro()).toBe(true);
    });

    it('should return false in dev mode with free tier', () => {
      (CONFIG as any).DEV_MODE = true;
      authService.setDevFakeTier('free');

      expect(authService.isPro()).toBe(false);
    });
  });

  describe('getTier', () => {
    it('should return "free" by default', () => {
      expect(authService.getTier()).toBe('free');
    });

    it('should return dev tier when in dev mode', () => {
      (CONFIG as any).DEV_MODE = true;
      authService.setDevFakeTier('pro');

      expect(authService.getTier()).toBe('pro');
    });
  });

  describe('Token Management', () => {
    describe('getAccessToken', () => {
      it('should return undefined when no token', async () => {
        const token = await authService.getAccessToken();
        expect(token).toBeUndefined();
      });

      it('should return stored token', async () => {
        await context.secrets.store(STORAGE_KEYS.ACCESS_TOKEN, 'my-access-token');

        const token = await authService.getAccessToken();
        expect(token).toBe('my-access-token');
      });
    });

    describe('getRefreshToken', () => {
      it('should return undefined when no token', async () => {
        const token = await authService.getRefreshToken();
        expect(token).toBeUndefined();
      });

      it('should return stored token', async () => {
        await context.secrets.store(STORAGE_KEYS.REFRESH_TOKEN, 'my-refresh-token');

        const token = await authService.getRefreshToken();
        expect(token).toBe('my-refresh-token');
      });
    });
  });

  describe('signIn (Dev Mode)', () => {
    beforeEach(() => {
      (CONFIG as any).DEV_MODE = true;
    });

    it('should toggle auth state in dev mode', async () => {
      authService.setDevFakeTier('out');

      await authService.signIn();
      expect(authService.devFakeTier).toBe('pro');

      await authService.signIn();
      expect(authService.devFakeTier).toBe('out');
    });
  });

  describe('signOut', () => {
    it('should clear tokens and user', async () => {
      await context.secrets.store(STORAGE_KEYS.ACCESS_TOKEN, 'access');
      await context.secrets.store(STORAGE_KEYS.REFRESH_TOKEN, 'refresh');

      await authService.signOut();

      expect(await context.secrets.get(STORAGE_KEYS.ACCESS_TOKEN)).toBeUndefined();
      expect(await context.secrets.get(STORAGE_KEYS.REFRESH_TOKEN)).toBeUndefined();
      expect(authService.user).toBeNull();
    });

    it('should show information message', async () => {
      await authService.signOut();

      expect(window.showInformationMessage).toHaveBeenCalledWith('Signed out of Panel Todo');
    });

    it('should set dev tier to out in dev mode', async () => {
      (CONFIG as any).DEV_MODE = true;
      authService.setDevFakeTier('pro');

      await authService.signOut();

      expect(authService.devFakeTier).toBe('out');
    });
  });

  describe('cancelAuthFlow', () => {
    it('should reset auth state', () => {
      // Simulate auth in progress
      (authService as any)._authInProgress = true;
      (authService as any)._authPending = { userCode: 'ABC', verificationUri: 'http://test', expiresAt: 0 };

      authService.cancelAuthFlow();

      expect(authService.isAuthInProgress).toBe(false);
      expect(authService.authPending).toBeNull();
    });
  });

  describe('copyUserCode', () => {
    it('should copy code to clipboard when pending', async () => {
      (authService as any)._authPending = {
        userCode: 'ABC-123',
        verificationUri: 'http://test',
        expiresAt: Date.now() + 10000,
      };

      await authService.copyUserCode();

      expect(env.clipboard.writeText).toHaveBeenCalledWith('ABC-123');
    });

    it('should do nothing when no pending auth', async () => {
      await authService.copyUserCode();

      expect(env.clipboard.writeText).not.toHaveBeenCalled();
    });
  });

  describe('openVerificationUri', () => {
    it('should open URI when pending', () => {
      (authService as any)._authPending = {
        userCode: 'ABC-123',
        verificationUri: 'https://panel-todo.com/verify',
        expiresAt: Date.now() + 10000,
      };

      authService.openVerificationUri();

      expect(env.openExternal).toHaveBeenCalled();
    });

    it('should do nothing when no pending auth', () => {
      authService.openVerificationUri();

      expect(env.openExternal).not.toHaveBeenCalled();
    });
  });

  describe('fetchUserInfo', () => {
    it('should return null when request fails', async () => {
      vi.mocked(utils.requestJson).mockResolvedValue({
        ok: false,
        status: 500,
        data: undefined,
      });

      const user = await authService.fetchUserInfo();
      expect(user).toBeNull();
    });

    it('should return user when successful', async () => {
      vi.mocked(utils.requestJson).mockResolvedValue({
        ok: true,
        status: 200,
        data: {
          user: {
            id: 'user-1',
            email: 'test@example.com',
            tier: 'pro' as UserTier,
          },
        },
      });

      const user = await authService.fetchUserInfo();

      expect(user).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        tier: 'pro',
      });
      expect(authService.user).toEqual(user);
    });

    it('should try token refresh on 401', async () => {
      // First call returns 401
      vi.mocked(utils.requestJson)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          data: undefined,
        })
        // Refresh token call
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: { accessToken: 'new-token' },
        })
        // Retry user info call
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: {
            user: {
              id: 'user-1',
              email: 'test@example.com',
              tier: 'pro' as UserTier,
            },
          },
        });

      await context.secrets.store(STORAGE_KEYS.REFRESH_TOKEN, 'valid-refresh');

      const user = await authService.fetchUserInfo();

      expect(user).not.toBeNull();
      expect(utils.requestJson).toHaveBeenCalledTimes(3);
    });

    it('should return null when no refresh token on 401', async () => {
      vi.mocked(utils.requestJson).mockResolvedValue({
        ok: false,
        status: 401,
        data: undefined,
      });

      const user = await authService.fetchUserInfo();
      expect(user).toBeNull();
    });
  });

  describe('Auth State Events', () => {
    it('should emit authStateChanged on signOut', async () => {
      const callback = vi.fn();
      authService.onAuthStateChanged(callback);

      await authService.signOut();

      expect(callback).toHaveBeenCalled();
    });

    it('should allow unsubscribing from events', async () => {
      const callback = vi.fn();
      authService.onAuthStateChanged(callback);
      authService.offAuthStateChanged(callback);

      await authService.signOut();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should emit authStateChanged on cancelAuthFlow', () => {
      const callback = vi.fn();
      authService.onAuthStateChanged(callback);

      authService.cancelAuthFlow();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Device Code Flow', () => {
    beforeEach(() => {
      // Mock successful device code response
      vi.mocked(utils.requestJson).mockImplementation(async (url: string) => {
        if (url.includes('/auth/device-code')) {
          return {
            ok: true,
            status: 200,
            data: {
              deviceCode: 'device-code-123',
              userCode: 'ABC-DEF',
              verificationUri: 'https://panel-todo.com/verify',
              expiresIn: 900,
              interval: 5,
            },
          };
        }
        if (url.includes('/auth/token')) {
          return {
            ok: false,
            status: 400,
            data: { error: 'AUTHORIZATION_PENDING' },
          };
        }
        return { ok: false, status: 404, data: undefined };
      });

      // Mock window message to prevent actual waiting
      window.showInformationMessage = vi.fn().mockResolvedValue('Copy Code');
    });

    it('should not start if already in progress', async () => {
      (authService as any)._authInProgress = true;

      await authService.signIn();

      expect(window.showInformationMessage).toHaveBeenCalledWith('Sign-in already in progress');
    });

    it('should show error on network failure', async () => {
      vi.mocked(utils.requestJson).mockRejectedValue(new Error('Network error'));

      // We need to wait a bit for the async flow
      const signInPromise = authService.signIn();
      await signInPromise;

      expect(window.showErrorMessage).toHaveBeenCalledWith('Failed to reach auth server');
    });

    it('should show error on invalid response', async () => {
      vi.mocked(utils.requestJson).mockResolvedValue({
        ok: false,
        status: 500,
        data: undefined,
      });

      await authService.signIn();

      expect(window.showErrorMessage).toHaveBeenCalledWith('Failed to start device login');
    });
  });

  describe('Dev Mode Tier', () => {
    beforeEach(() => {
      (CONFIG as any).DEV_MODE = true;
    });

    it('should allow setting dev tier', () => {
      authService.setDevFakeTier('team');
      expect(authService.devFakeTier).toBe('team');

      authService.setDevFakeTier('free');
      expect(authService.devFakeTier).toBe('free');

      authService.setDevFakeTier('out');
      expect(authService.devFakeTier).toBe('out');
    });

    it('should affect isPro based on dev tier', () => {
      authService.setDevFakeTier('free');
      expect(authService.isPro()).toBe(false);

      authService.setDevFakeTier('pro');
      expect(authService.isPro()).toBe(true);

      authService.setDevFakeTier('team');
      expect(authService.isPro()).toBe(true);
    });

    it('should affect getTier based on dev tier', () => {
      authService.setDevFakeTier('free');
      expect(authService.getTier()).toBe('free');

      authService.setDevFakeTier('pro');
      expect(authService.getTier()).toBe('pro');

      authService.setDevFakeTier('team');
      expect(authService.getTier()).toBe('team');
    });
  });

  describe('Error Messages', () => {
    it('should have friendly error for INVALID_CODE', async () => {
      // Access private method via reflection
      const errorMessage = (authService as any).getFriendlyErrorMessage('INVALID_CODE');
      expect(errorMessage).toContain('Invalid device code');
    });

    it('should have friendly error for EXPIRED_CODE', () => {
      const errorMessage = (authService as any).getFriendlyErrorMessage('EXPIRED_CODE');
      expect(errorMessage).toContain('expired');
    });

    it('should have friendly error for NO_SUBSCRIPTION', () => {
      const errorMessage = (authService as any).getFriendlyErrorMessage('NO_SUBSCRIPTION');
      expect(errorMessage).toContain('No Pro subscription');
    });

    it('should have friendly error for USER_NOT_FOUND', () => {
      const errorMessage = (authService as any).getFriendlyErrorMessage('USER_NOT_FOUND');
      expect(errorMessage).toContain('Account not found');
    });

    it('should return generic error for unknown codes', () => {
      const errorMessage = (authService as any).getFriendlyErrorMessage('UNKNOWN_ERROR');
      expect(errorMessage).toContain('Authentication failed');
      expect(errorMessage).toContain('UNKNOWN_ERROR');
    });
  });
});
