// Simple HTTP server that starts after a short delay for readiness tests
import http from 'http';

const port = parseInt(process.argv[2] || process.env.PORT || '34567', 10);
const delay = parseInt(process.env.START_DELAY || '300', 10);

console.log(`Delaying server start by ${delay}ms on port ${port}`);
setTimeout(() => {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    res.end('ok');
  });
  server.listen(port, () => {
    console.log(`Server listening on ${port}`);
  });
}, delay);
