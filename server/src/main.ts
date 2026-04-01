import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { AiVoiceService } from './ai-voice/ai-voice.service';
import { setupConversationRelayWebSocket } from './ai-voice/conversation-relay.handler';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Ensure uploads directory exists and serve it statically
  const uploadsPath = join(process.cwd(), 'uploads');
  mkdirSync(uploadsPath, { recursive: true });
  app.useStaticAssets(uploadsPath, { prefix: '/uploads' });

  const allowedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:3001',
    process.env.GIDDYDIGS_URL || 'https://giddydigs.com',
  ];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3200;
  await app.listen(port);

  // Attach ConversationRelay WebSocket handler to the HTTP server
  const httpServer = app.getHttpServer();
  const aiVoiceService = app.get(AiVoiceService);
  setupConversationRelayWebSocket(httpServer, aiVoiceService);

  console.log(`Phone system server running on port ${port}`);
}
bootstrap();
