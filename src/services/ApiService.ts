import * as vscode from 'vscode';
import { ApiResponse, RequestOptions, ApiToken, ApiTokenCreateResponse, ApiTokensListResponse } from '../types';
import { requestJson, getApiUrl, getApiHeaders } from '../utils';

/**
 * ApiService handles all HTTP communication with the Panel Todo API
 */
export class ApiService {
  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Make an authenticated API request
   */
  async request<T = unknown>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const url = `${getApiUrl()}${endpoint}`;
    const headers = await getApiHeaders(this.context);

    return requestJson<T>(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });
  }

  /**
   * GET request
   */
  async get<T = unknown>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T = unknown>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body });
  }

  /**
   * PATCH request
   */
  async patch<T = unknown>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PATCH', body });
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // ============================================
  // API Token Methods (for MCP integration)
  // ============================================

  /**
   * Create a new API token for MCP authentication
   * @returns The token string (only returned once at creation)
   */
  async createApiToken(name: string): Promise<string | null> {
    const response = await this.post<ApiTokenCreateResponse>('/auth/api-tokens', { name });
    console.log('[Panel Todo] createApiToken response:', { ok: response.ok, status: response.status, data: response.data });
    return response.ok && response.data?.token ? response.data.token : null;
  }

  /**
   * List all API tokens for the current user
   */
  async listApiTokens(): Promise<ApiToken[]> {
    const response = await this.get<ApiTokensListResponse>('/auth/api-tokens');
    if (!response.ok || !response.data?.tokens) {
      return [];
    }
    return response.data.tokens.map((t) => ({
      id: t.id,
      name: t.name,
      createdAt: t.created_at,
      lastUsedAt: t.last_used_at,
    }));
  }

  /**
   * Revoke (delete) an API token
   */
  async revokeApiToken(tokenId: string): Promise<boolean> {
    const response = await this.delete(`/auth/api-tokens/${tokenId}`);
    return response.ok;
  }
}
