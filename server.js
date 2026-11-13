const http = require('http');
const fs = require('fs');
const path = require('path');
const webhookHandler = require('./api/webhook');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const safeUrl = req.url.split('?')[0];

  // Route /api/webhook to the same handler used on Vercel
  if (safeUrl === '/api/webhook') {
    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk;
    });
    req.on('end', async () => {
      req.body = rawBody;
      const wrappedRes = {
        statusCode: 200,
        headers: {},
        setHeader(k, v) {
          res.setHeader(k, v);
        },
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(obj) {
          res.writeHead(this.statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(obj));
        },
        end(data) {
          res.writeHead(this.statusCode);
          res.end(data);
        },
      };
      await webhookHandler(req, wrappedRes);
    });
    return;
  }

  const relPath = safeUrl === '/' ? '/index.html' : safeUrl;
  const filePath = path.join(ROOT, relPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      fs.readFile(path.join(ROOT, 'index.html'), (errFallback, fallbackContent) => {
        if (errFallback) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fallbackContent);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Azusa Network local server running at http://localhost:${PORT}`);
});
