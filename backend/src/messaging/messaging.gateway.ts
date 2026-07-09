import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagingService } from './messaging.service';
import { Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

const ALLOWED_ORIGIN = process.env['CORS_ORIGIN'] ?? 'http://localhost:3000';

@WebSocketGateway({
  cors: {
    origin: ALLOWED_ORIGIN,
    credentials: true,
  },
  namespace: 'chat',
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagingGateway.name);

  // Track authenticated users: socketId -> verified userId
  private activeUsers = new Map<string, string>();

  constructor(
    private readonly messagingService: MessagingService,
    private readonly authService: AuthService,
  ) {}

  async handleConnection(client: Socket) {
    // Authenticate from handshake token — never trust client-supplied userId in messages
    const token =
      (client.handshake.auth as Record<string, string | undefined>)['token'] ??
      (client.handshake.headers['authorization'] as string | undefined)?.replace(/^Bearer\s+/i, '');

    if (!token) {
      this.logger.warn(`WebSocket rejected: no token from ${client.id}`);
      client.emit('error', { message: 'Authentication required' });
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.authService.verifyToken(token);
      this.activeUsers.set(client.id, payload.sub);
      this.logger.log(`Client connected: ${client.id} (User: ${payload.sub})`);
    } catch {
      this.logger.warn(`WebSocket rejected: invalid token from ${client.id}`);
      client.emit('error', { message: 'Invalid or expired session' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.activeUsers.get(client.id);
    if (userId) {
      this.activeUsers.delete(client.id);
      this.server.emit('presence_update', { userId, status: 'offline' });
      this.logger.log(`Client disconnected: ${client.id} (User: ${userId})`);
    } else {
      this.logger.log(`Client disconnected: ${client.id}`);
    }
  }

  private getAuthenticatedUserId(client: Socket): string | null {
    return this.activeUsers.get(client.id) ?? null;
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = this.getAuthenticatedUserId(client);
    if (!userId) { client.disconnect(true); return; }

    this.logger.log(`User ${userId} joining conversation room: ${data.conversationId}`);
    client.join(data.conversationId);

    // Fetch and send message history (also marks as read via getMessages)
    const messages = await this.messagingService.getMessages(data.conversationId, userId);
    client.emit('message_history', messages);

    // Notify room of presence/read update
    client.to(data.conversationId).emit('user_joined', { userId });
    this.server.emit('presence_update', { userId, status: 'online' });
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: {
      conversationId: string;
      text: string;
      attachmentUrl?: string;
      voiceNoteDuration?: number;
    },
    @ConnectedSocket() client: Socket
  ) {
    const userId = this.getAuthenticatedUserId(client);
    if (!userId) { client.disconnect(true); return; }

    this.logger.log(`Message received from ${userId} in room ${data.conversationId}`);

    const savedMsg = await this.messagingService.sendMessage(
      data.conversationId,
      userId,
      data.text,
      data.attachmentUrl,
      data.voiceNoteDuration,
    );

    const payload = {
      ...savedMsg,
      voiceNoteDuration: data.voiceNoteDuration ?? null,
    };

    this.server.to(data.conversationId).emit('new_message', payload);
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { conversationId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket
  ) {
    const userId = this.getAuthenticatedUserId(client);
    if (!userId) { client.disconnect(true); return; }

    client.to(data.conversationId).emit('user_typing', {
      userId,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('read_receipt')
  async handleReadReceipt(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = this.getAuthenticatedUserId(client);
    if (!userId) { client.disconnect(true); return; }

    this.logger.log(`Read receipt from ${userId} in room ${data.conversationId}`);

    await this.messagingService.getMessages(data.conversationId, userId);
    this.server.to(data.conversationId).emit('messages_read', {
      conversationId: data.conversationId,
      userId,
    });
  }
}
