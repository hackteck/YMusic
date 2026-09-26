import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import fs from 'node:fs';
import { URL } from 'node:url';

const HTTP_PORT = Number(process.env.PROXY_HTTP_PORT) || 8080;
const HTTPS_PORT = Number(process.env.PROXY_HTTPS_PORT) || 8443;
const SSL_CERT = process.env.SSL_CERT;
const SSL_KEY = process.env.SSL_KEY;

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'origin',
  'referer',
]);

const UPGRADE_DROP = new Set([
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'origin',
  'referer',
]);

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': '*',
  'access-control-max-age': '86400',
};

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 1024 });
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 1024,
  rejectUnauthorized: false,
});

function parseTarget(reqUrl: string): URL | null {
  const raw = reqUrl.startsWith('/') ? reqUrl.slice(1) : reqUrl;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:' && u.protocol !== 'ws:' && u.protocol !== 'wss:') {
      return null;
    }
    return u;
  } catch {
    return null;
  }
}

function getHttpOrigin(target: URL): string {
  const protocol = target.protocol === 'wss:' ? 'https:' : 
                   target.protocol === 'ws:' ? 'http:' : target.protocol;
  const port = target.port;
  const defaultPort = protocol === 'https:' ? '443' : '80';
  const portSuffix = port && port !== defaultPort ? `:${port}` : '';
  return `${protocol}//${target.hostname}${portSuffix}`;
}

function copyHeaders(
  src: http.IncomingHttpHeaders,
  drop: Set<string>,
): http.OutgoingHttpHeaders {
  const out: http.OutgoingHttpHeaders = {};
  for (const k in src) {
    if (drop.has(k.toLowerCase())) continue;
    out[k] = src[k];
  }
  return out;
}

function buildResponseLine(status: number | undefined, message: string | undefined): string {
  return `HTTP/1.1 ${status ?? 502} ${message ?? ''}`;
}

function appendHeaders(lines: string[], headers: http.IncomingHttpHeaders, skipCors: boolean): void {
  for (const k in headers) {
    const lk = k.toLowerCase();
    if (HOP_BY_HOP.has(lk)) continue;
    if (skipCors && lk.startsWith('access-control-')) continue;
    const v = headers[k];
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) lines.push(`${k}: ${v[i]}`);
    } else if (v !== undefined) {
      lines.push(`${k}: ${v}`);
    }
  }
}

function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const target = parseTarget(req.url || '');
  if (!target) {
    res.writeHead(400, { 'content-type': 'text/plain', ...CORS_HEADERS });
    res.end('Usage: /<absolute-url>  e.g.  /https://example.com/path');
    return;
  }

  const isTls = target.protocol === 'https:';
  const lib = isTls ? https : http;
  const agent = isTls ? httpsAgent : httpAgent;

  const headers = copyHeaders(req.headers, HOP_BY_HOP);
  headers.host = target.host;
  headers.origin = getHttpOrigin(target);

  const proxyReq = lib.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (isTls ? 443 : 80),
      method: req.method,
      path: (target.pathname || '/') + (target.search || ''),
      headers,
      agent,
      setHost: false,
    },
    proxyRes => {
      const outHeaders: http.OutgoingHttpHeaders = {};
      for (const k in proxyRes.headers) {
        const lk = k.toLowerCase();
        if (HOP_BY_HOP.has(lk)) continue;
        if (lk.startsWith('access-control-')) continue;
        outHeaders[k] = proxyRes.headers[k];
      }
      Object.assign(outHeaders, CORS_HEADERS);
      res.writeHead(proxyRes.statusCode || 502, proxyRes.statusMessage, outHeaders);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', err => {
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/plain', ...CORS_HEADERS });
    }
    res.end('Bad gateway: ' + err.message);
  });

  req.on('aborted', () => proxyReq.destroy());
  req.pipe(proxyReq);
}

function handleUpgrade(req: http.IncomingMessage, clientSocket: net.Socket, head: Buffer): void {
  const target = parseTarget(req.url || '');
  if (!target) {
    clientSocket.destroy();
    return;
  }

  const isTls = target.protocol === 'wss:' || target.protocol === 'https:';
  const lib = isTls ? https : http;

  const headers = copyHeaders(req.headers, UPGRADE_DROP);
  headers.host = target.host;
  headers.origin = getHttpOrigin(target);

  clientSocket.setNoDelay(true);
  clientSocket.setKeepAlive(true, 30_000);

  const proxyReq = lib.request({
    method: req.method,
    hostname: target.hostname,
    port: target.port || (isTls ? 443 : 80),
    path: (target.pathname || '/') + (target.search || ''),
    headers,
    rejectUnauthorized: false,
    setHost: false,
    agent: false,
  });

  proxyReq.on('upgrade', (proxyRes, upstreamSocket, upstreamHead) => {
    upstreamSocket.setNoDelay(true);
    upstreamSocket.setKeepAlive(true, 30_000);

    const lines = [buildResponseLine(proxyRes.statusCode, proxyRes.statusMessage)];
    appendHeaders(lines, proxyRes.headers, false);
    lines.push('', '');
    clientSocket.write(lines.join('\r\n'));

    if (upstreamHead && upstreamHead.length) clientSocket.write(upstreamHead);
    if (head && head.length) upstreamSocket.write(head);

    upstreamSocket.pipe(clientSocket);
    clientSocket.pipe(upstreamSocket);

    const cleanup = () => {
      upstreamSocket.destroy();
      clientSocket.destroy();
    };
    upstreamSocket.on('error', cleanup);
    clientSocket.on('error', cleanup);
    upstreamSocket.on('end', () => clientSocket.end());
    clientSocket.on('end', () => upstreamSocket.end());
  });

  proxyReq.on('response', proxyRes => {
    const lines = [buildResponseLine(proxyRes.statusCode, proxyRes.statusMessage)];
    appendHeaders(lines, proxyRes.headers, false);
    lines.push('', '');
    clientSocket.write(lines.join('\r\n'));
    proxyRes.pipe(clientSocket);
  });

  proxyReq.on('error', () => clientSocket.destroy());
  proxyReq.end();
}

function attach(server: http.Server | https.Server): void {
  server.on('request', handleRequest);
  server.on('upgrade', handleUpgrade);
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = 0;
}

const httpServer = http.createServer();
attach(httpServer);
httpServer.listen(HTTP_PORT, () => {
  console.log(`HTTP/WS proxy listening on http://localhost:${HTTP_PORT}`);
});

if (SSL_CERT && SSL_KEY && fs.existsSync(SSL_CERT) && fs.existsSync(SSL_KEY)) {
  const httpsServer = https.createServer({
    cert: fs.readFileSync(SSL_CERT),
    key: fs.readFileSync(SSL_KEY),
  });
  attach(httpsServer);
  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`HTTPS/WSS proxy listening on https://localhost:${HTTPS_PORT}`);
  });
} else {
  console.log('HTTPS disabled. To enable, set SSL_CERT and SSL_KEY env vars.');
  console.log('  Generate self-signed:  openssl req -x509 -newkey rsa:2048 -nodes \\');
  console.log('    -keyout key.pem -out cert.pem -days 365 -subj "/CN=localhost"');
}

process.on('uncaughtException', err => console.error('uncaughtException:', err));
process.on('unhandledRejection', err => console.error('unhandledRejection:', err));