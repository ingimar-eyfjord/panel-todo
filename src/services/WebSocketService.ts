import * as vscode from 'vscode';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { WebSocketEvent, WebSocketEventType } from '../types';
import { getApiUrl, getApiHeaders } from '../utils';

type EventHandler = (event: WebSocketEvent) => void;

/**
 * WebSocketService handles real-time sync via WebSocket connection
 */
export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private eventHandlers: EventHandler[] = [];
  private _isConnected = false;
  private _connectionEvents = new EventEmitter();

  constructor(private context: vscode.ExtensionContext) {}

  // ============================================
  // Public API
  // ============================================

  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Subscribe to connection state changes
   */
  onConnectionStateChanged(callback: (connected: boolean) => void): void {
    this._connectionEvents.on('connectionStateChanged', callback);
  }

  /**
   * Unsubscribe from connection state changes
   */
  offConnectionStateChanged(callback: (connected: boolean) => void): void {
    this._connectionEvents.off('connectionStateChanged', callback);
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    this.disconnect();

    const apiUrl = getApiUrl();
    const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws';

    // WebSocket doesn't need Content-Type header
    const headers = await getApiHeaders(this.context, { includeContentType: false });

    try {
      this.ws = new WebSocket(wsUrl, { headers });

      this.ws.on('open', () => {
        console.log('WebSocket connected for real-time sync');
        this.setConnected(true);
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
        this.setConnected(false);
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

    this.setConnected(false);
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

  private setConnected(connected: boolean): void {
    if (this._isConnected !== connected) {
      this._isConnected = connected;
      this._connectionEvents.emit('connectionStateChanged', connected);
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
}
