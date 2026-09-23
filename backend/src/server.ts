import 'dotenv/config';
import { app } from './app.js';
import { prisma } from './db.js';

const port = Number(process.env.PORT ?? 3001);

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`StudyFlow API ready at http://127.0.0.1:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
