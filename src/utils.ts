import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { ApiResponse, RequestOptions } from './types';

/**
 * Generate a cryptographic nonce for CSP
 */
export function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Delay for a specified number of milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make a JSON HTTP request (uses fetch if available, falls back to Node.js http)
 */
export async function requestJson<T = unknown>(
  url: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', headers = {}, body } = options;

  // Use fetch if available (VS Code 1.80+ has it)
  if (typeof fetch === 'function') {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data: T | null = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text as unknown as T;
      }
    }

    return { ok: response.ok, status: response.status, data: data ?? undefined };
  }

  // Fallback to Node.js http/https
  return requestJsonNode<T>(url, { method, headers, body });
}

/**
 * Node.js http/https implementation for requestJson
 */
function requestJsonNode<T>(
  urlString: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', headers = {}, body } = options;

  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const isHttps = url.protocol === 'https:';
    const payload = body ? JSON.stringify(body) : null;
    const requestFn = isHttps ? https.request : http.request;

    const request = requestFn(
      {
        method,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        headers: {
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json' } : {}),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          let parsed: T | null = null;
          if (data) {
            try {
              parsed = JSON.parse(data);
            } catch {
              parsed = data as unknown as T;
            }
          }
          resolve({
            ok: (response.statusCode ?? 0) >= 200 && (response.statusCode ?? 0) < 300,
            status: response.statusCode ?? 0,
            data: parsed ?? undefined,
          });
        });
      }
    );

    request.on('error', reject);

    if (payload) {
      request.write(payload);
    }

    request.end();
  });
}

/**
 * Format todos as a prompt block for AI assistants
 */
export function formatTodosAsPrompt(todos: { text: string }[]): string {
  const items = todos.map((todo) => `- [ ] ${todo.text}`).join('\n');
  return `## Current Tasks\n\n${items}\n`;
}
