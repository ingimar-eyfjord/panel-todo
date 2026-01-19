import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, chmodSync, readFileSync } from 'fs';
import { User, DeviceCodeResponse, AuthTokens, CONFIG, STORAGE_KEYS, UserTier } from '../types';
import { requestJson, delay, getApiUrl, getApiHeaders } from '../utils';
import { ApiService } from './ApiService';
import { StorageService } from './StorageService';

interface AuthPending {
  userCode: string;
  verificationUri: string;
  expiresAt: number;
}

interface CancelToken {
  canceled: boolean;
}

/**
 * AuthService handles device-code authentication flow for Panel Todo
 */
export class AuthService {
  private _user: User | null = null;
  private _authPending: AuthPending | null = null;
  private _authInProgress = false;
  private _authCancel: CancelToken | null = null;
  private _devFakeTier: UserTier | 'out' | null = CONFIG.DEV_MODE ? 'free' : null;
  private _events = new EventEmitter();
  private _apiService: ApiService | null = null;
  private _storageService: StorageService | null = null;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Set the API service reference (for MCP config setup)
   */
  setApiService(apiService: ApiService): void {
    this._apiService = apiService;
  }

  /**
   * Set the storage service reference (for MCP config setup)
   */
  setStorageService(storageService: StorageService): void {
    this._storageService = storageService;
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChanged(callback: () => void): void {
    this._events.on('authStateChanged', callback);
  }

  /**
   * Unsubscribe from auth state changes
   */
  offAuthStateChanged(callback: () => void): void {
    this._events.off('authStateChanged', callback);
  }

  // ============================================
  // Public API
  // ============================================

  get user(): User | null {
    return this._user;
  }

  get authPending(): AuthPending | null {
    return this._authPending;
  }

  get isAuthInProgress(): boolean {
    return this._authInProgress;
  }

  get devFakeTier(): UserTier | 'out' | null {
    return this._devFakeTier;
  }

  setDevFakeTier(tier: UserTier | 'out' | null): void {
    this._devFakeTier = tier;
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    if (this._devFakeTier !== null) {
      return this._devFakeTier !== 'out';
    }
    const token = await this.getAccessToken();
    return Boolean(token);
  }

  /**
   * Check if user has Pro tier
   */
  isPro(): boolean {
    if (this._devFakeTier !== null) {
      return this._devFakeTier === 'pro' || this._devFakeTier === 'team';
    }
    return this._user?.tier === 'pro' || this._user?.tier === 'team';
  }

  /**
   * Get current user tier
   */
  getTier(): UserTier {
    if (this._devFakeTier !== null && this._devFakeTier !== 'out') {
      return this._devFakeTier;
    }
    return this._user?.tier || 'free';
  }

  /**
   * Start sign-in flow (opens activate page in browser)
   */
  async signIn(): Promise<void> {
    if (CONFIG.DEV_MODE) {
      // In dev mode, just toggle auth state
      this._devFakeTier = this._devFakeTier === 'out' ? 'pro' : 'out';
      this._events.emit('authStateChanged');
      return;
    }

    // Open the activate page - user will enter email and receive magic link
    const deviceName = encodeURIComponent(this.getDeviceName());
    const apiUrl = getApiUrl();
    const activateUrl = apiUrl.replace('api.', '').replace(':3000', ':8081') + `/activate?device=${deviceName}`;
    vscode.env.openExternal(vscode.Uri.parse(activateUrl));
    vscode.window.showInformationMessage('Complete sign-in in your browser. Check your email for the magic link.');
  }

  /**
   * Handle magic link authentication (called from URI handler)
   */
  async handleMagicLink(token: string): Promise<void> {
    if (this._authInProgress) {
      return;
    }

    this._authInProgress = true;
    this._events.emit('authStateChanged');

    const apiUrl = getApiUrl();

    try {
      const response = await requestJson<{
        accessToken?: string;
        refreshToken?: string;
        user?: { id: string; email: string; tier: UserTier };
        error?: { code?: string; message?: string };
      }>(`${apiUrl}/auth/verify-magic-link`, {
        method: 'POST',
        body: { token },
      });

      if (!response.ok || !response.data?.accessToken) {
        const errorMsg = response.data?.error?.message || 'Failed to verify sign-in link';
        throw new Error(errorMsg);
      }

      const { accessToken, refreshToken, user } = response.data;

      await this.storeAuthTokens({
        accessToken,
        refreshToken: refreshToken || '',
      });

      if (user) {
        this._user = {
          id: user.id,
          email: user.email,
          tier: user.tier,
        };
      }

      this._authInProgress = false;
      this._events.emit('authStateChanged');
      vscode.window.showInformationMessage(`Signed in to Panel Todo as ${user?.email || 'user'}`);
    } catch (err) {
      this._authInProgress = false;
      this._events.emit('authStateChanged');
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    if (CONFIG.DEV_MODE) {
      this._devFakeTier = 'out';
      this._events.emit('authStateChanged');
      return;
    }

    this.cancelAuthFlow();
    await this.clearAuthTokens();
    this._user = null;
    this._events.emit('authStateChanged');
    vscode.window.showInformationMessage('Signed out of Panel Todo');
  }

  /**
   * Cancel ongoing auth flow
   */
  cancelAuthFlow(): void {
    if (this._authCancel) {
      this._authCancel.canceled = true;
      // Don't nullify _authCancel - let polling loop check and clean up naturally
      // This avoids a race condition where the loop checks after we set null
    }
    this._authInProgress = false;
    this._authPending = null;
    this._events.emit('authStateChanged');
  }

  /**
   * Copy user code to clipboard
   */
  async copyUserCode(): Promise<void> {
    if (this._authPending?.userCode) {
      await vscode.env.clipboard.writeText(this._authPending.userCode);
    }
  }

  /**
   * Open verification URI
   */
  openVerificationUri(): void {
    if (this._authPending?.verificationUri) {
      vscode.env.openExternal(vscode.Uri.parse(this._authPending.verificationUri));
    }
  }

  // ============================================
  // Token Management
  // ============================================

  async getAccessToken(): Promise<string | undefined> {
    return this.context.secrets.get(STORAGE_KEYS.ACCESS_TOKEN);
  }

  async getRefreshToken(): Promise<string | undefined> {
    return this.context.secrets.get(STORAGE_KEYS.REFRESH_TOKEN);
  }

  private async storeAuthTokens(tokens: AuthTokens): Promise<void> {
    if (tokens.accessToken) {
      await this.context.secrets.store(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
    }
    if (tokens.refreshToken) {
      await this.context.secrets.store(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
    }
  }

  async clearAuthTokens(): Promise<void> {
    await this.context.secrets.delete(STORAGE_KEYS.ACCESS_TOKEN);
    await this.context.secrets.delete(STORAGE_KEYS.REFRESH_TOKEN);
  }

  // ============================================
  // User Info
  // ============================================

  /**
   * Fetch user info from API
   */
  async fetchUserInfo(): Promise<User | null> {
    const apiUrl = getApiUrl();
    const headers = await getApiHeaders(this.context);

    console.log('[AuthService] fetchUserInfo: calling', `${apiUrl}/auth/me`);

    try {
      // Backend returns user directly: { id, email, tier, created_at }
      // NOT wrapped: { user: { ... } }
      const response = await requestJson<{ id?: string; email?: string; tier?: UserTier; user?: User }>(`${apiUrl}/auth/me`, {
        headers,
      });

      console.log('[AuthService] fetchUserInfo response:', {
        ok: response.ok,
        status: response.status,
        hasId: !!response.data?.id,
        hasUser: !!response.data?.user,
      });

      // Handle both formats: direct user properties OR wrapped in { user: ... }
      const userData = response.data?.user || (response.data?.id ? response.data : null);

      if (response.ok && userData?.id && userData?.email) {
        this._user = {
          id: userData.id,
          email: userData.email,
          tier: userData.tier || 'free',
        };
        return this._user;
      }

      // Token might be expired, try refresh
      if (response.status === 401) {
        console.log('[AuthService] Got 401, attempting token refresh...');
        const refreshed = await this.refreshAccessToken();
        console.log('[AuthService] Token refresh result:', refreshed);
        if (refreshed) {
          return this.fetchUserInfo();
        }
      }

      return null;
    } catch (err) {
      console.error('[AuthService] fetchUserInfo network error:', err);
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = await this.getRefreshToken();
    console.log('[AuthService] refreshAccessToken: hasRefreshToken =', !!refreshToken);

    if (!refreshToken) {
      return false;
    }

    const apiUrl = getApiUrl();

    try {
      const response = await requestJson<{
        accessToken?: string;
        access_token?: string;
        refreshToken?: string;
        refresh_token?: string;
      }>(`${apiUrl}/auth/refresh`, {
        method: 'POST',
        body: { refreshToken },
      });

      console.log('[AuthService] refresh response:', {
        ok: response.ok,
        status: response.status,
        hasAccessToken: !!(response.data?.accessToken || response.data?.access_token),
        hasRefreshToken: !!(response.data?.refreshToken || response.data?.refresh_token),
      });

      const newAccessToken = response.data?.accessToken || response.data?.access_token;
      const newRefreshToken = response.data?.refreshToken || response.data?.refresh_token;

      if (response.ok && newAccessToken) {
        // Store new access token
        await this.context.secrets.store(STORAGE_KEYS.ACCESS_TOKEN, newAccessToken);

        // CRITICAL: Store new refresh token (backend uses rotation)
        if (newRefreshToken) {
          await this.context.secrets.store(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
        }
        return true;
      }

      // Only clear tokens if refresh token is explicitly invalid (401/400)
      // Don't clear on server errors (5xx) - could be transient
      if (response.status === 401 || response.status === 400) {
        console.log('[AuthService] Refresh token invalid (status', response.status, ') - clearing tokens');
        await this.clearAuthTokens();
      }
      return false;
    } catch (err) {
      // Network error - don't clear tokens, could be transient
      console.error('[AuthService] refreshAccessToken network error:', err);
      return false;
    }
  }

  // ============================================
  // Device Code Flow
  // ============================================

  private async startDeviceCodeFlow(): Promise<void> {
    if (this._authInProgress) {
      vscode.window.showInformationMessage('Sign-in already in progress');
      return;
    }

    this._authInProgress = true;
    this._authPending = null;

    const apiUrl = getApiUrl();
    const deviceName = this.getDeviceName();

    let response;
    try {
      response = await requestJson<DeviceCodeResponse>(`${apiUrl}/auth/device-code`, {
        method: 'POST',
        body: { deviceName },
      });
    } catch (err) {
      await this.handleAuthError('Failed to reach auth server');
      return;
    }

    if (!response.ok || !response.data) {
      await this.handleAuthError('Failed to start device login');
      return;
    }

    const payload = response.data;
    const deviceCode = payload.deviceCode;
    const userCode = payload.userCode;
    const verificationUri = payload.verificationUri;
    const expiresIn = payload.expiresIn || 900;
    const intervalSeconds = payload.interval || 5;

    if (!deviceCode || !userCode || !verificationUri) {
      await this.handleAuthError('Auth server returned an invalid response');
      return;
    }

    this._authPending = {
      userCode,
      verificationUri,
      expiresAt: Date.now() + expiresIn * 1000,
    };

    // Notify webview of pending auth state
    this._events.emit('authStateChanged');

    const selection = await vscode.window.showInformationMessage(
      `Enter code ${userCode} to link Panel Todo.`,
      'Open Verification Page',
      'Copy Code'
    );

    if (selection === 'Open Verification Page') {
      vscode.env.openExternal(vscode.Uri.parse(verificationUri));
    } else if (selection === 'Copy Code') {
      await vscode.env.clipboard.writeText(userCode);
    }

    const cancelToken: CancelToken = { canceled: false };
    this._authCancel = cancelToken;

    await this.pollForToken({
      deviceCode,
      intervalSeconds,
      expiresAt: this._authPending.expiresAt,
      cancelToken,
    });
  }

  private async pollForToken(params: {
    deviceCode: string;
    intervalSeconds: number;
    expiresAt: number;
    cancelToken: CancelToken;
  }): Promise<void> {
    const { deviceCode, expiresAt, cancelToken } = params;
    const apiUrl = getApiUrl();
    // Use 2 second polling for better UX (faster than RFC 8628 default of 5s)
    let intervalMs = 2000;

    while (!cancelToken.canceled && Date.now() < expiresAt) {
      let response;

      try {
        response = await requestJson<{
          accessToken?: string;
          access_token?: string;
          refreshToken?: string;
          refresh_token?: string;
          error?: { code?: string } | string;
        }>(`${apiUrl}/auth/token`, {
          method: 'POST',
          body: { deviceCode },
        });
      } catch (err) {
        console.error('Poll error:', err);
        await this.handleAuthError('Failed to poll auth server. Check your internet connection.');
        return;
      }

      const data = response.data || {};
      console.log('Poll response:', JSON.stringify(data));

      const accessToken = data.accessToken || data.access_token;
      const refreshToken = data.refreshToken || data.refresh_token;

      if (accessToken) {
        console.log('Got access token, signing in...');
        await this.storeAuthTokens({
          accessToken,
          refreshToken: refreshToken || '',
        });
        this._authPending = null;
        this._authInProgress = false;
        this._authCancel = null;
        await this.fetchUserInfo();
        this._events.emit('authStateChanged');
        vscode.window.showInformationMessage('Panel Todo connected');
        return;
      }

      const errorCode =
        typeof data.error === 'object' ? data.error?.code : data.error;

      if (errorCode === 'AUTHORIZATION_PENDING' || errorCode === 'authorization_pending') {
        await delay(intervalMs);
        continue;
      }

      if (errorCode === 'SLOW_DOWN' || errorCode === 'slow_down') {
        intervalMs += 1000;
        await delay(intervalMs);
        continue;
      }

      if (errorCode) {
        await this.handleAuthError(this.getFriendlyErrorMessage(errorCode));
        return;
      }

      if (!response.ok) {
        await this.handleAuthError('Failed to complete device login');
        return;
      }

      await delay(intervalMs);
    }

    if (!cancelToken.canceled) {
      await this.handleAuthError('Device code expired');
    }
  }

  private async handleAuthError(message: string): Promise<void> {
    this._authPending = null;
    this._authInProgress = false;
    this._authCancel = null;
    this._events.emit('authStateChanged');
    vscode.window.showErrorMessage(message);
  }

  // ============================================
  // Helpers
  // ============================================

  private getFriendlyErrorMessage(errorCode: string): string {
    const messages: Record<string, string> = {
      'INVALID_CODE': 'Invalid device code. Please try signing in again.',
      'EXPIRED_CODE': 'Device code expired. Please try signing in again.',
      'NO_SUBSCRIPTION': 'No Pro subscription found for this email. Subscribe at panel-todo.com',
      'USER_NOT_FOUND': 'Account not found. Please subscribe first at panel-todo.com',
      'INVALID_REFRESH_TOKEN': 'Session expired. Please sign in again.',
      'STRIPE_ERROR': 'Could not verify subscription. Please try again.',
    };
    return messages[errorCode] || `Authentication failed: ${errorCode}`;
  }

  private getDeviceName(): string {
    const app = vscode.env.appName || 'VS Code';
    return `${app} (${process.platform})`;
  }

  // ============================================
  // MCP Config Setup
  // ============================================

  /**
   * Set up MCP config file with API token for seamless MCP integration.
   * Creates ~/.panel-todo/config.json with API token and project ID.
   * This allows Claude Code and other MCP clients to authenticate automatically.
   */
  async setupMcpConfig(): Promise<void> {
    if (!this._apiService || !this._storageService) {
      console.log('MCP config setup skipped: services not available');
      return;
    }

    // Skip in dev mode
    if (CONFIG.DEV_MODE) {
      console.log('MCP config setup skipped: dev mode');
      return;
    }

    // Only setup for Pro users
    if (!this.isPro()) {
      console.log('MCP config setup skipped: not Pro tier');
      return;
    }

    try {
      const configDir = join(homedir(), '.panel-todo');
      const configFile = join(configDir, 'config.json');

      // Check if config already exists with a valid token
      if (existsSync(configFile)) {
        try {
          const existingConfig = JSON.parse(readFileSync(configFile, 'utf-8'));
          if (existingConfig.token && existingConfig.token.startsWith('pt_')) {
            console.log('MCP config already exists with valid token');
            // Update project ID if changed
            const currentProjectId = this._storageService.getProjectId();
            if (currentProjectId && existingConfig.projectId !== currentProjectId) {
              existingConfig.projectId = currentProjectId;
              writeFileSync(configFile, JSON.stringify(existingConfig, null, 2));
              console.log('Updated MCP config with new project ID');
            }
            return;
          }
        } catch (parseErr) {
          // Config file is corrupted, recreate it
          console.log('Existing MCP config invalid, recreating');
        }
      }

      // Create API token for MCP
      const token = await this._apiService.createApiToken('VS Code MCP');
      if (!token) {
        console.error('Failed to create API token for MCP');
        return;
      }

      // Get current project ID
      const projectId = this._storageService.getProjectId();

      // Create config directory if it doesn't exist
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }

      // Write config file
      const config = {
        projectId: projectId || null,
        token,
        apiUrl: getApiUrl(),
        devMode: false,
      };

      writeFileSync(configFile, JSON.stringify(config, null, 2));

      // Set file permissions to user-only read/write (0600)
      try {
        chmodSync(configFile, 0o600);
      } catch (chmodErr) {
        // chmod may fail on Windows, that's OK
        console.log('Could not set file permissions (Windows?)');
      }

      console.log('MCP config created at', configFile);
      vscode.window.showInformationMessage(
        'MCP integration configured! Claude Code can now access your Panel Todo.'
      );
    } catch (err) {
      console.error('Failed to setup MCP config:', err);
      // Non-blocking - don't show error to user
    }
  }
}
