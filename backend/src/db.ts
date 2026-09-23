import 'dotenv/config';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config({ path: '.env.vault', override: false, quiet: true });
export const prisma = new PrismaClient();
