/**
 * Minimal GET + JSON for Argo CD HTTPS (including optional TLS verification skip for in-cluster dev).
 */

import * as https from 'node:https';
import { URL } from 'node:url';

export interface JsonGetOptions {
  headers: Record<string, string>;
  timeoutMs: number;
  /** When true on https URLs, certificate verification is skipped (not for production). */
  tlsInsecure: boolean;
}

function parseJsonBody(body: string): unknown {
  if (!body) {
    return null;
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

function httpsGetInsecure(
  url: URL,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers,
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode ?? 0, json: parseJsonBody(body) });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Request timeout'));
    });
    req.end();
  });
}

/**
 * GET returning raw response body text and HTTP status (for passthrough stdout).
 */
export async function textGet(
  urlString: string,
  options: JsonGetOptions
): Promise<{ status: number; body: string }> {
  const url = new URL(urlString);
  if (url.protocol === 'http:') {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), options.timeoutMs);
    try {
      const res = await fetch(urlString, {
        method: 'GET',
        headers: options.headers,
        signal: ac.signal,
      });
      const body = await res.text();
      return { status: res.status, body };
    } finally {
      clearTimeout(t);
    }
  }

  if (url.protocol === 'https:') {
    if (options.tlsInsecure) {
      return new Promise((resolve, reject) => {
        const req = https.request(
          {
            hostname: url.hostname,
            port: url.port || 443,
            path: `${url.pathname}${url.search}`,
            method: 'GET',
            headers: options.headers,
            rejectUnauthorized: false,
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (c) => chunks.push(c as Buffer));
            res.on('end', () => {
              resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') });
            });
          }
        );
        req.on('error', reject);
        req.setTimeout(options.timeoutMs, () => {
          req.destroy(new Error('Request timeout'));
        });
        req.end();
      });
    }
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), options.timeoutMs);
    try {
      const res = await fetch(urlString, {
        method: 'GET',
        headers: options.headers,
        signal: ac.signal,
      });
      const body = await res.text();
      return { status: res.status, body };
    } finally {
      clearTimeout(t);
    }
  }

  throw new Error(`Unsupported URL protocol: ${url.protocol}`);
}

/**
 * GET returning parsed JSON (or null body) and HTTP status.
 */
export async function jsonGet(urlString: string, options: JsonGetOptions): Promise<{ status: number; json: unknown }> {
  const url = new URL(urlString);
  if (url.protocol === 'http:') {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), options.timeoutMs);
    try {
      const res = await fetch(urlString, {
        method: 'GET',
        headers: options.headers,
        signal: ac.signal,
      });
      const body = await res.text();
      return { status: res.status, json: parseJsonBody(body) };
    } finally {
      clearTimeout(t);
    }
  }

  if (url.protocol === 'https:') {
    if (options.tlsInsecure) {
      return httpsGetInsecure(url, options.headers, options.timeoutMs);
    }
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), options.timeoutMs);
    try {
      const res = await fetch(urlString, {
        method: 'GET',
        headers: options.headers,
        signal: ac.signal,
      });
      const body = await res.text();
      return { status: res.status, json: parseJsonBody(body) };
    } finally {
      clearTimeout(t);
    }
  }

  throw new Error(`Unsupported URL protocol: ${url.protocol}`);
}
