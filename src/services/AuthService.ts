import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { User, DeviceCodeResponse, AuthTokens, CONFIG, STORAGE_KEYS, UserTier } from '../types';
import { requestJson, delay, getApiUrl, getApiHeaders } from '../utils';

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

  constructor(private context: vscode.ExtensionContext) {}

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
   * Start sign-in flow
   */
  async signIn(): Promise<void> {
    if (CONFIG.DEV_MODE) {
      // In dev mode, just toggle auth state
      this._devFakeTier = this._devFakeTier === 'out' ? 'pro' : 'out';
      return;
    }
    await this.startDeviceCodeFlow();
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    if (CONFIG.DEV_MODE) {
      this._devFakeTier = 'out';
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

  private async clearAuthTokens(): Promise<void> {
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

    try {
      const response = await requestJson<{ user?: User }>(`${apiUrl}/auth/me`, {
        headers,
      });

      if (response.ok && response.data?.user) {
        this._user = response.data.user;
        return this._user;
      }

      // Token might be expired, try refresh
      if (response.status === 401) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          return this.fetchUserInfo();
        }
      }

      return null;
    } catch (err) {
      console.error('Error fetching user info:', err);
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) {
      return false;
    }

    const apiUrl = getApiUrl();

    try {
      const response = await requestJson<{ accessToken?: string; access_token?: string }>(
        `${apiUrl}/auth/refresh`,
        {
          method: 'POST',
          body: { refreshToken },
        }
      );

      const accessToken = response.data?.accessToken || response.data?.access_token;
      if (response.ok && accessToken) {
        await this.context.secrets.store(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
        return true;
      }

      // Refresh failed, clear tokens
      await this.clearAuthTokens();
      return false;
    } catch (err) {
      console.error('Error refreshing token:', err);
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
      'NO_SUBSCRIPTION': 'No Pro subscription found for this email. Subscribe at paneltodo.com',
      'USER_NOT_FOUND': 'Account not found. Please subscribe first at paneltodo.com',
      'INVALID_REFRESH_TOKEN': 'Session expired. Please sign in again.',
      'STRIPE_ERROR': 'Could not verify subscription. Please try again.',
    };
    return messages[errorCode] || `Authentication failed: ${errorCode}`;
  }

  private getDeviceName(): string {
    const app = vscode.env.appName || 'VS Code';
    return `${app} (${process.platform})`;
  }
}
