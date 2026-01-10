/**
 * Vitest Setup File
 * Configures global mocks and test utilities
 */

import { vi, beforeEach, afterEach } from 'vitest';

// Mock VS Code module
vi.mock('vscode', async () => {
  return await import('./__mocks__/vscode');
});

// Mock WebSocket for WebSocketService tests
vi.mock('ws', () => {
  const EventEmitter = require('events').EventEmitter;

  class MockWebSocket extends EventEmitter {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = MockWebSocket.OPEN;

    constructor(public url: string, public options?: { headers?: Record<string, string> }) {
      super();
      // Simulate connection
      setTimeout(() => {
        this.emit('open');
      }, 0);
    }

    send(data: string): void {
      // Can be spied on
    }

    close(): void {
      this.readyState = MockWebSocket.CLOSED;
      this.emit('close');
    }

    // Test helper to simulate receiving a message
    simulateMessage(data: unknown): void {
      this.emit('message', JSON.stringify(data));
    }

    // Test helper to simulate error
    simulateError(error: Error): void {
      this.emit('error', error);
    }
  }

  return {
    default: MockWebSocket,
    WebSocket: MockWebSocket,
  };
});

// Global fetch mock (for requestJson tests)
const originalFetch = globalThis.fetch;

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();

  // Reset fetch to a mock
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  // Restore original fetch
  globalThis.fetch = originalFetch;
});

// Extend expect with custom matchers if needed
// expect.extend({
//   toBeValidTodo(received) {
//     const pass = received && typeof received.id === 'string' && typeof received.text === 'string';
//     return {
//       message: () => `expected ${received} to be a valid Todo`,
//       pass,
//     };
//   },
// });
