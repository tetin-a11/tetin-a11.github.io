import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './build.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.xml':'application/xml; charset=utf-8', '.txt':'text/plain; charset=utf-8' };
const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
    if (!(await stat(file)).isFile()) file = path.join(file, 'index.html');
    if (!path.resolve(file).startsWith(root)) throw new Error('Invalid path');
    res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'});
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); res.end('404 Not Found');
  }
});
server.listen(4173, () => console.log('AI GAME LAB. → http://localhost:4173'));
