import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { AppModule } from './app.module';
import { ensureUploadsDir, UPLOADS_DIR } from './paths';

const envCandidates = [
  resolve(process.cwd(), '.env'),
  resolve(__dirname, '..', '.env'),
  resolve(__dirname, '..', '..', '.env'),
];

const envPath = envCandidates.find((candidate) => existsSync(candidate));
const dotenvResult = config({ path: envPath, override: true });

if (dotenvResult.error) {
  throw dotenvResult.error;
}

async function bootstrap() {
  ensureUploadsDir();
  console.log('[Server] Uploads directory:', UPLOADS_DIR);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(UPLOADS_DIR, { prefix: '/uploads' });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
