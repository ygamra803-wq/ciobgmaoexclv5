import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import React, { act } from 'react';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { Container } from '../../core/di/Container';

// Mock Dependencies
vi.mock('../../utils/AccessLogService', () => ({
  accessLogService: {
    recordLogin: vi.fn().mockResolvedValue(true),
    recordLogout: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../utils/vaultService', () => ({
  vaultService: {
    isVaultExists: vi.fn().mockReturnValue(false),
    decryptVault: vi.fn(),
    encryptVault: vi.fn(),
    setPinHash: vi.fn(),
  },
}));

vi.mock('../../utils/storageService', () => ({
  storageService: {
    hashPin: vi.fn().mockReturnValue('hashed_pin'),
    verifyPin: vi.fn(),
  },
}));

describe('AuthContext Security and Hardening Suite', () => {
  let mockAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthService = {
      getCurrentUser: vi.fn().mockReturnValue(null),
      getAvailableAccounts: vi.fn().mockReturnValue([]),
      login: vi.fn(),
      loginWithPin: vi.fn(),
      logout: vi.fn(),
      isPinConfigured: vi.fn().mockReturnValue(false),
    };

    // Spy Container resolve to return mock service
    vi.spyOn(Container, 'resolve').mockImplementation((key) => {
      if (key === 'auth') return mockAuthService;
      return null;
    });
  });

  // Self-contained asynchronous hook test runner
  async function runWithAuthContext(testFn) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    let activeContext = null;

    function HookRunner() {
      activeContext = useAuth();
      return null;
    }

    await act(async () => {
      root.render(
        React.createElement(AuthProvider, null, React.createElement(HookRunner))
      );
    });

    try {
      await testFn(activeContext);
    } finally {
      await act(async () => {
        root.unmount();
        container.remove();
      });
    }
  }

  it('should validate inputs using LoginSchema and reject invalid characters in username', async () => {
    await runWithAuthContext(async (auth) => {
      await expect(
        auth.login({ username: 'admin; DROP TABLE Users;--', password: 'password123' })
      ).rejects.toThrow(/validation|caractères invalides/i);

      await expect(
        auth.login({ username: 'sh', password: 'password123' })
      ).rejects.toThrow(/validation|Nom d'utilisateur d'au moins 3 caractères/i);
    });
  });

  it('should enforce rate-limiting lockout after max failed logins', async () => {
    await runWithAuthContext(async (auth) => {
      const username = 'targettech';
      mockAuthService.login.mockRejectedValue(new Error('Mot de passe incorrect'));

      // Trigger max failed logins (5 attempts)
      for (let i = 0; i < 5; i++) {
        await expect(
          auth.login({ username, password: 'wrongpassword' })
        ).rejects.toThrow(/incorrect/i);
      }

      // 6th attempt should be blocked instantly by rate-limiting lockout
      await expect(
        auth.login({ username, password: 'anypassword' })
      ).rejects.toThrow(/Trop de tentatives|verrouillé/i);
    });
  });

  it('should enforce rate-limiting lockout on PIN login attempts', async () => {
    await runWithAuthContext(async (auth) => {
      mockAuthService.loginWithPin.mockRejectedValue(new Error('PIN incorrect'));

      // Trigger max failed PIN logins
      for (let i = 0; i < 5; i++) {
        await expect(
          auth.loginWithPin('1111')
        ).rejects.toThrow(/incorrect|PIN/i);
      }

      // Next PIN login attempt should trigger rate limit lockout instantly
      await expect(
        auth.loginWithPin('9999')
      ).rejects.toThrow(/Trop de tentatives|verrouillé/i);
    });
  });
});
