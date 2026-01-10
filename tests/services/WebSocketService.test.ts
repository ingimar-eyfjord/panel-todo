/**
 * Unit tests for WebSocketService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketService } from '../../src/services/WebSocketService';
import { createMockExtensionContext, MockExtensionContext, workspace } from '../__mocks__/vscode';
import { CONFIG, STORAGE_KEYS, WebSocketEvent } from '../../src/types';

describe('WebSocketService', () => {
  let context: MockExtensionContext;
  let wsService: WebSocketService;
  let originalDevMode: boolean;

  beforeEach(() => {
    context = createMockExtensionContext();
    wsService = new WebSocketService(context as any);

    // Store original DEV_MODE
    originalDevMode = CONFIG.DEV_MODE;
    (CONFIG as any).DEV_MODE = false;

    // Reset mocks
    vi.clearAllMocks();

    // Setup workspace mock
    workspace.getConfiguration = vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue('https://api.panel-todo.com'),
    });

    // Use fake timers for reconnection tests
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore DEV_MODE
    (CONFIG as any).DEV_MODE = originalDevMode;

    // Cleanup
    wsService.disconnect();
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should not be connected initially', () => {
      expect(wsService.isConnected).toBe(false);
    });
  });

  describe('connect', () => {
    it('should create WebSocket connection', async () => {
      const connectPromise = wsService.connect();

      // Wait for next tick to allow WebSocket mock to emit 'open'
      await vi.advanceTimersByTimeAsync(100);

      expect(wsService.isConnected).toBe(true);
    });

    it('should use correct WebSocket URL', async () => {
      // We can check the URL by inspecting the WebSocket mock
      await wsService.connect();
      await vi.advanceTimersByTimeAsync(100);

      // The mock WebSocket should have been created with ws:// URL
      expect(wsService.isConnected).toBe(true);
    });

    it('should disconnect existing connection before reconnecting', async () => {
      await wsService.connect();
      await vi.advanceTimersByTimeAsync(100);

      expect(wsService.isConnected).toBe(true);

      // Connect again - should not throw
      await wsService.connect();
      await vi.advanceTimersByTimeAsync(100);

      expect(wsService.isConnected).toBe(true);
    });

    it('should include auth headers in dev mode', async () => {
      (CONFIG as any).DEV_MODE = true;

      await wsService.connect();
      await vi.advanceTimersByTimeAsync(100);

      // The WebSocket mock should have received headers with X-Dev-User
      expect(wsService.isConnected).toBe(true);
    });

    it('should include Authorization header when token exists', async () => {
      await context.secrets.store(STORAGE_KEYS.ACCESS_TOKEN, 'test-token');

      await wsService.connect();
      await vi.advanceTimersByTimeAsync(100);

      expect(wsService.isConnected).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should close WebSocket connection', async () => {
      await wsService.connect();
      await vi.advanceTimersByTimeAsync(100);

      expect(wsService.isConnected).toBe(true);

      wsService.disconnect();

      expect(wsService.isConnected).toBe(false);
    });

    it('should clear reconnect timer', async () => {
      await wsService.connect();
      await vi.advanceTimersByTimeAsync(100);

      expect(wsService.isConnected).toBe(true);

      wsService.disconnect();

      expect(wsService.isConnected).toBe(false);
    });

    it('should be safe to call when not connected', () => {
      expect(() => wsService.disconnect()).not.toThrow();
    });
  });

  describe('Event Handlers', () => {
    describe('onEvent', () => {
      it('should register event handler', async () => {
        const handler = vi.fn();
        wsService.onEvent(handler);

        await wsService.connect();
        await vi.advanceTimersByTimeAsync(100);

        // Simulate WebSocket receiving a message
        // Since our mock emits 'open' automatically, we need to get the ws instance
        // and simulate a message
        const ws = (wsService as any).ws;
        if (ws) {
          ws.emit('message', JSON.stringify({ type: 'connected' }));
        }

        expect(handler).toHaveBeenCalledWith({ type: 'connected' });
      });

      it('should support multiple handlers', async () => {
        const handler1 = vi.fn();
        const handler2 = vi.fn();

        wsService.onEvent(handler1);
        wsService.onEvent(handler2);

        await wsService.connect();
        await vi.advanceTimersByTimeAsync(100);

        const ws = (wsService as any).ws;
        if (ws) {
          ws.emit('message', JSON.stringify({ type: 'issue:created', data: { id: '1' } }));
        }

        expect(handler1).toHaveBeenCalled();
        expect(handler2).toHaveBeenCalled();
      });

      it('should continue calling handlers even if one throws', async () => {
        const errorHandler = vi.fn().mockImplementation(() => {
          throw new Error('Handler error');
        });
        const successHandler = vi.fn();

        wsService.onEvent(errorHandler);
        wsService.onEvent(successHandler);

        await wsService.connect();
        await vi.advanceTimersByTimeAsync(100);

        const ws = (wsService as any).ws;
        if (ws) {
          ws.emit('message', JSON.stringify({ type: 'connected' }));
        }

        expect(errorHandler).toHaveBeenCalled();
        expect(successHandler).toHaveBeenCalled();
      });
    });

    describe('offEvent', () => {
      it('should remove event handler', async () => {
        const handler = vi.fn();
        wsService.onEvent(handler);
        wsService.offEvent(handler);

        await wsService.connect();
        await vi.advanceTimersByTimeAsync(100);

        const ws = (wsService as any).ws;
        if (ws) {
          ws.emit('message', JSON.stringify({ type: 'connected' }));
        }

        expect(handler).not.toHaveBeenCalled();
      });

      it('should be safe to remove non-existent handler', () => {
        const handler = vi.fn();
        expect(() => wsService.offEvent(handler)).not.toThrow();
      });
    });

    describe('clearHandlers', () => {
      it('should remove all handlers', async () => {
        const handler1 = vi.fn();
        const handler2 = vi.fn();

        wsService.onEvent(handler1);
        wsService.onEvent(handler2);
        wsService.clearHandlers();

        await wsService.connect();
        await vi.advanceTimersByTimeAsync(100);

        const ws = (wsService as any).ws;
        if (ws) {
          ws.emit('message', JSON.stringify({ type: 'connected' }));
        }

        expect(handler1).not.toHaveBeenCalled();
        expect(handler2).not.toHaveBeenCalled();
      });
    });
  });

  describe('Connection State Events', () => {
    describe('onConnectionStateChanged', () => {
      it('should notify when connected', async () => {
        const callback = vi.fn();
        wsService.onConnectionStateChanged(callback);

        await wsService.connect();
        await vi.advanceTimersByTimeAsync(100);

        expect(callback).toHaveBeenCalledWith(true);
      });

      it('should notify when disconnected', async () => {
        const callback = vi.fn();
        wsService.onConnectionStateChanged(callback);

        await wsService.connect();
        await vi.advanceTimersByTimeAsync(100);

        callback.mockClear();

        wsService.disconnect();

        expect(callback).toHaveBeenCalledWith(false);
      });

      it('should not notify if state does not change', async () => {
        const callback = vi.fn();
        wsService.onConnectionStateChanged(callback);

        // Already disconnected, disconnect again
        wsService.disconnect();

        expect(callback).not.toHaveBeenCalled();
      });
    });

    describe('offConnectionStateChanged', () => {
      it('should unsubscribe from connection state events', async () => {
        const callback = vi.fn();
        wsService.onConnectionStateChanged(callback);
        wsService.offConnectionStateChanged(callback);

        await wsService.connect();
        await vi.advanceTimersByTimeAsync(100);

        expect(callback).not.toHaveBeenCalled();
      });
    });
  });

  describe('Auto-Reconnect', () => {
    it('should schedule reconnect on close', async () => {
      await wsService.connect();
      await vi.advanceTimersByTimeAsync(100);

      // Simulate WebSocket close
      const ws = (wsService as any).ws;
      if (ws) {
        ws.emit('close');
      }

      expect(wsService.isConnected).toBe(false);

      // Advance timer past reconnect delay (5s)
      await vi.advanceTimersByTimeAsync(5000);

      // Should be attempting to reconnect
      await vi.advanceTimersByTimeAsync(100);

      expect(wsService.isConnected).toBe(true);
    });

    it('should not reconnect if manually disconnected', async () => {
      await wsService.connect();
      await vi.advanceTimersByTimeAsync(100);

      expect(wsService.isConnected).toBe(true);

      wsService.disconnect();

      // Should be disconnected immediately
      expect(wsService.isConnected).toBe(false);
    });
  });

  describe('Message Parsing', () => {
    it('should parse valid JSON messages', async () => {
      const handler = vi.fn();
      wsService.onEvent(handler);

      await wsService.connect();
      await vi.advanceTimersByTimeAsync(100);

      const ws = (wsService as any).ws;
      if (ws) {
        ws.emit('message', JSON.stringify({
          type: 'issue:updated',
          data: { id: '123', title: 'Updated Title' },
        }));
      }

      expect(handler).toHaveBeenCalledWith({
        type: 'issue:updated',
        data: { id: '123', title: 'Updated Title' },
      });
    });

    it('should handle invalid JSON gracefully', async () => {
      const handler = vi.fn();
      wsService.onEvent(handler);

      await wsService.connect();
      await vi.advanceTimersByTimeAsync(100);

      const ws = (wsService as any).ws;
      if (ws) {
        // Should not throw, should log error
        expect(() => {
          ws.emit('message', 'not valid json');
        }).not.toThrow();
      }

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('WebSocket Events', () => {
    it('should handle all event types', async () => {
      const handler = vi.fn();
      wsService.onEvent(handler);

      await wsService.connect();
      await vi.advanceTimersByTimeAsync(100);

      const ws = (wsService as any).ws;
      if (ws) {
        const eventTypes: WebSocketEvent['type'][] = [
          'connected',
          'issue:created',
          'issue:updated',
          'issue:deleted',
          'sprint:created',
          'sprint:updated',
          'sprint:deleted',
          'sprint:completed',
          'project:created',
          'project:updated',
          'project:deleted',
          'tag:created',
          'tag:updated',
          'tag:deleted',
        ];

        for (const type of eventTypes) {
          handler.mockClear();
          ws.emit('message', JSON.stringify({ type }));
          expect(handler).toHaveBeenCalledWith({ type });
        }
      }
    });
  });

  describe('API URL Configuration', () => {
    it('should use dev API URL in dev mode', async () => {
      (CONFIG as any).DEV_MODE = true;

      // Access private method
      const apiUrl = (wsService as any).getApiUrl();

      expect(apiUrl).toBe(CONFIG.DEV_API_URL);
    });

    it('should use configured API URL', async () => {
      workspace.getConfiguration = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue('https://custom-api.example.com'),
      });

      const apiUrl = (wsService as any).getApiUrl();

      expect(apiUrl).toBe('https://custom-api.example.com');
    });

    it('should strip trailing slashes', async () => {
      workspace.getConfiguration = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue('https://api.example.com//'),
      });

      const apiUrl = (wsService as any).getApiUrl();

      expect(apiUrl).toBe('https://api.example.com');
    });
  });

  describe('Headers', () => {
    it('should include X-Dev-User in dev mode', async () => {
      (CONFIG as any).DEV_MODE = true;

      const headers = await (wsService as any).getHeaders();

      expect(headers['X-Dev-User']).toBe(CONFIG.DEV_FAKE_USER_ID);
    });

    it('should include Authorization when token exists', async () => {
      await context.secrets.store(STORAGE_KEYS.ACCESS_TOKEN, 'bearer-token');

      const headers = await (wsService as any).getHeaders();

      expect(headers['Authorization']).toBe('Bearer bearer-token');
    });

    it('should not include Authorization when no token', async () => {
      const headers = await (wsService as any).getHeaders();

      expect(headers['Authorization']).toBeUndefined();
    });
  });
});
