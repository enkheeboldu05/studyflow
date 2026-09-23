import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const database = fileURLToPath(new URL('../prisma/studyflow.db', import.meta.url));
fs.closeSync(fs.openSync(database, 'a'));
