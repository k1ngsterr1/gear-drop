import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { StoreModule } from './store.module.js';

const app = await NestFactory.create(StoreModule);
app.enableShutdownHooks();
await app.listen(Number(process.env.PORT ?? 4000), process.env.HOST ?? '127.0.0.1');
