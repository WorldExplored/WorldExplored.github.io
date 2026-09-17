import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve('out');
const evidence = resolve('docs/qa/close-range');
const port = Number(process.argv[2] ?? 4177);
const mime = { '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon', '.js': 'text/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (request.method === 'POST' && url.pathname === '/__qa-capture') {
    const name = url.searchParams.get('name') ?? '';
    if (!/^[a-z0-9/_-]+$/i.test(name)) { response.writeHead(400).end('invalid capture name'); return; }
    const chunks = [];
    let bytes = 0;
    request.on('data', chunk => { bytes += chunk.length; if (bytes > 32 * 1024 * 1024) request.destroy(); else chunks.push(chunk); });
    request.on('end', () => {
      const file = resolve(evidence, `${name}.${request.headers['content-type'] === 'application/json' ? 'json' : 'png'}`);
      if (!file.startsWith(`${evidence}/`)) { response.writeHead(400).end('invalid capture path'); return; }
      mkdirSync(resolve(file, '..'), { recursive: true });
      writeFileSync(file, Buffer.concat(chunks));
      response.writeHead(204).end();
      console.log(file);
    });
    return;
  }
  const pathname = decodeURIComponent(url.pathname);
  let file = normalize(join(root, pathname));
  if (!file.startsWith(`${root}/`)) { response.writeHead(403).end('forbidden'); return; }
  if (pathname.endsWith('/')) file = join(file, 'index.html');
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, '404.html');
  response.writeHead(existsSync(file) ? 200 : 404, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  if (existsSync(file)) createReadStream(file).pipe(response); else response.end('not found');
}).listen(port, '127.0.0.1', () => console.log(`QA server http://127.0.0.1:${port}`));
