import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const database = fileURLToPath(new URL('../prisma/test.db', import.meta.url));
fs.closeSync(fs.openSync(database, 'a'));
