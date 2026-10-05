/**
 * 只为本机装脚本用的极小静态服务器。
 *
 *   node serve.mjs [port]
 *
 * 起它的唯一目的：让篡改猴能通过 http 地址拦截 .user.js 弹出安装页
 * （file:// 需要额外开"允许访问文件网址"，http 不用）。
 * 装完就可以关掉。
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || 8787);
const HOST = '127.0.0.1';

const MIME = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

const server = createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400).end('bad url');
    return;
  }
  if (pathname === '/') pathname = '/dist/vgen-chinese.user.js';

  /* 防目录穿越 */
  const rel = normalize(pathname).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  const full = join(ROOT, rel);

  if (!full.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  try {
    const s = await stat(full);
    if (s.isDirectory()) {
      res.writeHead(404).end('not a file');
      return;
    }
    const body = await readFile(full);
    res.writeHead(200, {
      'Content-Type': MIME[extname(full).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-store'
    });
    res.end(body);
    console.log(new Date().toISOString().slice(11, 19) + '  200  ' + rel + '  (' + body.length + ' B)');
  } catch {
    res.writeHead(404).end('not found');
    console.log(new Date().toISOString().slice(11, 19) + '  404  ' + rel);
  }
});

server.listen(PORT, HOST, () => {
  console.log('静态服务器已启动');
  console.log('  安装脚本: http://' + HOST + ':' + PORT + '/dist/vgen-chinese.user.js');
  console.log('  测试页面: http://' + HOST + ':' + PORT + '/test/fixture.html');
  console.log('  根目录  : ' + ROOT);
});
