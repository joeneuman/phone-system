import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CallsService } from './calls/calls.service';
import { MessagesService } from './messages/messages.service';
import { VoicemailService } from './voicemail/voicemail.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/phone',
})
export class PhoneGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private callsService: CallsService,
    private messagesService: MessagesService,
    private voicemailService: VoicemailService,
  ) {}

  afterInit() {
    const broadcast = (event: string, data: any) => {
      this.server.emit(event, data);
    };

    this.callsService.setEventCallback(broadcast);
    this.messagesService.setEventCallback(broadcast);
    this.voicemailService.setEventCallback(broadcast);

    console.log('Phone WebSocket gateway initialized');
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }
}
