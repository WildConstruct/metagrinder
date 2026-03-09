const fs = require('fs');
const http = require('http');
const path = require('path');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const ROOT = path.resolve(__dirname, '..', '..', '..');

const ROUTES = new Map([
  ['/', path.join(ROOT, 'tools', 'research-brief-lab', 'index.html')],
  ['/index.html', path.join(ROOT, 'tools', 'research-brief-lab', 'index.html')],
  ['/app.js', path.join(ROOT, 'tools', 'research-brief-lab', 'app.js')],
  ['/styles.css', path.join(ROOT, 'tools', 'research-brief-lab', 'styles.css')],
  [
    '/packages/core/scripts/lib/research-brief-preparser.js',
    path.join(ROOT, 'packages', 'core', 'scripts', 'lib', 'research-brief-preparser.js')
  ],
  ['/spaghettiwestern.md', path.join(ROOT, 'spaghettiwestern.md')]
]);

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function respond(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const requestPath = req.url === '/favicon.ico' ? '/index.html' : req.url;
  const filePath = ROUTES.get(requestPath);

  if (!filePath) {
    respond(res, 404, 'Not found');
    return;
  }

  try {
    const body = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    respond(res, 200, body, MIME_TYPES[ext] || 'application/octet-stream');
  } catch (error) {
    respond(res, 500, error.message);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Metagrinder research brief lab running at http://${HOST}:${PORT}`);
});
