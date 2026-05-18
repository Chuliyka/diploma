import { mkdirSync } from 'fs';
import { join, resolve } from 'path';

export const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? resolve(process.env.UPLOADS_DIR)
  : resolve(join(__dirname, '..', 'uploads'));

export function ensureUploadsDir() {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}
