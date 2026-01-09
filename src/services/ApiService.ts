import * as vscode from 'vscode';
import { ApiResponse, RequestOptions, CONFIG, STORAGE_KEYS } from '../types';
import { requestJson } from '../utils';

/**
 * ApiService handles all HTTP communication with the Panel Todo API
 */
export class ApiService {
  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Get the effective API URL (dev mode or production)
   */
  getApiUrl(): string {
    if (CONFIG.DEV_MODE) {
      return CONFIG.DEV_API_URL;
    }

    const config = vscode.workspace.getConfiguration('panelTodo');
    const baseUrl = config.get<string>(CONFIG.API_BASE_URL_SETTING, CONFIG.DEFAULT_API_BASE_URL);
    return String(baseUrl).replace(/\/+$/, '');
  }

  /**
   * Get API headers with authentication
   */
  async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (CONFIG.DEV_MODE) {
      headers['X-Dev-User'] = CONFIG.DEV_FAKE_USER_ID;
    } else {
      const token = await this.context.secrets.get(STORAGE_KEYS.ACCESS_TOKEN);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * Make an authenticated API request
   */
  async request<T = unknown>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.getApiUrl()}${endpoint}`;
    const headers = await this.getHeaders();

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
}
