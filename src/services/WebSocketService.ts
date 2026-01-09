import * as vscode from 'vscode';
import WebSocket from 'ws';
import { WebSocketEvent, WebSocketEventType, CONFIG, STORAGE_KEYS } from '../types';

type EventHandler = (event: WebSocketEvent) => void;

/**
 * WebSocketService handles real-time sync via WebSocket connection
 */
export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private eventHandlers: EventHandler[] = [];
  private _isConnected = false;

  constructor(private context: vscode.ExtensionContext) {}

  // ============================================
  // Public API
  // ============================================

  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    this.disconnect();

    const apiUrl = this.getApiUrl();
    const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws';

    const headers = await this.getHeaders();

    try {
      this.ws = new WebSocket(wsUrl, { headers });

      this.ws.on('open', () => {
        console.log('WebSocket connected for real-time sync');
        this._isConnected = true;
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const event = JSON.parse(data.toString()) as WebSocketEvent;
          this.handleEvent(event);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      });

      this.ws.on('close', () => {
        console.log('WebSocket disconnected');
        this._isConnected = false;
        this.ws = null;
        this.scheduleReconnect();
      });

      this.ws.on('error', (err: Error) => {
        console.error('WebSocket error:', err.message);
      });
    } catch (err) {
      console.error('Failed to connect WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this._isConnected = false;
  }

  /**
   * Register an event handler
   */
  onEvent(handler: EventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Remove an event handler
   */
  offEvent(handler: EventHandler): void {
    const index = this.eventHandlers.indexOf(handler);
    if (index !== -1) {
      this.eventHandlers.splice(index, 1);
    }
  }

  /**
   * Clear all event handlers
   */
  clearHandlers(): void {
    this.eventHandlers = [];
  }

  // ============================================
  // Private Methods
  // ============================================

  private handleEvent(event: WebSocketEvent): void {
    console.log('WebSocket event received:', event.type);

    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (err) {
        console.error('Error in WebSocket event handler:', err);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((err) => {
        console.error('Failed to reconnect WebSocket:', err);
      });
    }, 5000);
  }

  private getApiUrl(): string {
    if (CONFIG.DEV_MODE) {
      return CONFIG.DEV_API_URL;
    }
    const config = vscode.workspace.getConfiguration('panelTodo');
    const baseUrl = config.get<string>(CONFIG.API_BASE_URL_SETTING, CONFIG.DEFAULT_API_BASE_URL);
    return String(baseUrl).replace(/\/+$/, '');
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    if (CONFIG.DEV_MODE) {
      headers['X-Dev-User'] = CONFIG.DEV_FAKE_USER_ID;
    } else {
      // Use secrets API for secure token storage
      const token = await this.context.secrets.get(STORAGE_KEYS.ACCESS_TOKEN);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }
}
