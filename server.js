// Máy chủ tĩnh để ES Modules hoạt động; không có API hay cơ sở dữ liệu backend.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const relative = file.slice(root.length + 1);
    if (!file.startsWith(root + sep) || relative.split(/[\\/]/).some((part) => part.startsWith('.')) || !mime[extname(file)]) {
      response.writeHead(404).end('Not found');
      return;
    }
    const contents = await readFile(file);
    response.writeHead(200, {
      'Content-Type': mime[extname(file)],
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    });
    response.end(request.method === 'HEAD' ? undefined : contents);
  } catch (error) {
    response.writeHead(error instanceof URIError ? 400 : 404).end('Not found');
  }
});
server.on('error', (error) => {
  console.error(`Không khởi động được máy chủ: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Website đã chạy tại http://localhost:${port}. Nhấn Ctrl+C để dừng.`);
});
