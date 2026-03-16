import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AiVoiceService } from './ai-voice/ai-voice.service';
import { setupConversationRelayWebSocket } from './ai-voice/conversation-relay.handler';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.CLIENT_URL || 'http://localhost:3001',
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
