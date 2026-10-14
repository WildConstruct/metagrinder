import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import type { OperatorWritableKind } from '../schemas/operator-state';
import {
  handleForbiddenWrite,
  handleGetEra,
  handleGetManifest,
  handleHealth,
  handleListRuns,
  handleParseReuse,
  handleReadOperatorState,
  handleWriteOperatorState,
  type HandlerResult,
  type WorkbenchConfig
} from './handler';
import { WriteBoundaryError } from './write-boundary';

const STATIC_DIR = path.join(__dirname, 'static');

function allowedRequest(req: http.IncomingMessage): boolean {
  const host = req.headers.host;
  if (!host) return false;
  let authority: URL;
  try { authority = new URL(`http://${host}`); } catch { return false; }
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(authority.hostname)
    || authority.username || authority.password || authority.pathname !== '/'
    || authority.search || authority.hash
    || Number(authority.port || '80') !== req.socket.localPort) return false;
  const writes = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method ?? 'GET');
  if (!writes) return true;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')) return false;
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== authority.origin) return false;
  const fetchSite = req.headers['sec-fetch-site'];
  return fetchSite === undefined || fetchSite === 'same-origin' || fetchSite === 'none';
}

function send(result: HandlerResult, res: http.ServerResponse): void {
  if ('json' in result) {
    res.writeHead(result.status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(`${JSON.stringify(result.json, null, 2)}\n`);
    return;
  }
  if ('buffer' in result) {
    res.writeHead(result.status, {
      'Content-Type': result.contentType,
      'Cache-Control': 'no-store'
    });
    res.end(result.buffer);
    return;
  }
  res.writeHead(result.status, {
    'Content-Type': result.contentType,
    'Cache-Control': 'no-store'
  });
  res.end(result.text);
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  return 'application/octet-stream';
}

function serveStatic(urlPath: string, res: http.ServerResponse): void {
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
  if (rel.includes('..')) {
    res.writeHead(400);
    res.end('bad path');
    return;
  }
  const filePath = path.join(STATIC_DIR, rel);
  if (!filePath.startsWith(STATIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': contentTypeFor(filePath) });
  res.end(fs.readFileSync(filePath));
}

export function createWorkbenchServer(config: WorkbenchConfig): http.Server {
  return http.createServer(async (req, res) => {
    try {
      if (!allowedRequest(req)) {
        send({ status: 403, json: { error: 'workbench requests must use the local host and same origin' } }, res);
        return;
      }
      const url = new URL(req.url ?? '/', 'http://localhost');
      const method = req.method ?? 'GET';

      if (method === 'GET' && url.pathname === '/api/health') {
        send(handleHealth(), res);
        return;
      }
      if (method === 'GET' && url.pathname === '/api/runs') {
        send(handleListRuns(config), res);
        return;
      }

      const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)(?:\/(.*))?$/);
      if (runMatch) {
        const runId = decodeURIComponent(runMatch[1]!);
        const rest = runMatch[2] ?? '';

        if (method === 'GET' && rest === 'manifest') {
          send(handleGetManifest(config, runId), res);
          return;
        }
        if (method === 'GET' && rest === 'era') {
          const n = Number(url.searchParams.get('samples') ?? '120');
          send(handleGetEra(config, runId, Number.isFinite(n) ? n : 120), res);
          return;
        }
        if (method === 'GET' && rest.startsWith('operator-state/')) {
          const kind = rest.slice('operator-state/'.length) as OperatorWritableKind;
          send(handleReadOperatorState({ config, runId, kind }), res);
          return;
        }
        if (method === 'POST' && rest === 'operator-state') {
          const body = await readBody(req) as { kind?: OperatorWritableKind; data?: unknown };
          if (!body.kind) {
            send({ status: 400, json: { error: 'kind required' } }, res);
            return;
          }
          send(handleWriteOperatorState({
            config,
            runId,
            kind: body.kind,
            body: body.data ?? {},
            now: new Date().toISOString()
          }), res);
          return;
        }
        // Any attempt to write generated artifacts via a generic endpoint
        if (method === 'POST' && rest === 'artifact') {
          const body = await readBody(req) as { path?: string; data?: unknown };
          send(handleForbiddenWrite({
            config,
            runId,
            relativePath: body.path ?? 'extraction.json',
            body: body.data
          }), res);
          return;
        }
      }

      if (method === 'POST' && url.pathname === '/api/parse-reuse') {
        const body = await readBody(req) as {
          hasExistingParse?: boolean;
          forceRerun?: boolean;
          parseStale?: boolean;
        };
        send(handleParseReuse(body), res);
        return;
      }

      if (method === 'GET') {
        serveStatic(url.pathname, res);
        return;
      }

      send({ status: 404, json: { error: 'not found' } }, res);
    } catch (err) {
      send({
        status: err instanceof WriteBoundaryError ? 403 : err instanceof SyntaxError ? 400 : 500,
        json: { error: err instanceof Error ? err.message : String(err) }
      }, res);
    }
  });
}

export function startWorkbenchServer(options: {
  runsRoot: string;
  port?: number;
}): http.Server {
  const port = options.port ?? 5175;
  const server = createWorkbenchServer({ runsRoot: path.resolve(options.runsRoot) });
  server.listen(port, '127.0.0.1', () => {
    const address = server.address();
    const actualPort = address && typeof address !== 'string' ? address.port : port;
    // eslint-disable-next-line no-console
    console.log(`Metagrinder thin workbench on http://127.0.0.1:${actualPort} (runs: ${options.runsRoot})`);
  });
  return server;
}
