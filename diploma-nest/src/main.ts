import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { AppModule } from './app.module';

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
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(__dirname, '..', '..', 'uploads'), { prefix: '/uploads' });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
