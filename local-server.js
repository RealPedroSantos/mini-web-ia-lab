import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chatHandler from './api/chat.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.post('/api/chat', chatHandler);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'Mini Web AI Lab' });
});

app.listen(port, () => {
  console.log(`Mini Web AI Lab: http://localhost:${port}`);
});
