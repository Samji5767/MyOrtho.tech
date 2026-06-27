import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagingService } from './messaging.service';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'chat',
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagingGateway.name);
  
  // Track online users mapping: socketId -> userId
  private activeUsers = new Map<string, string>();

  constructor(private readonly messagingService: MessagingService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
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

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: { conversationId: string; userId: string },
    @ConnectedSocket() client: Socket
  ) {
    this.logger.log(`User ${data.userId} joining conversation room: ${data.conversationId}`);
    client.join(data.conversationId);
    this.activeUsers.set(client.id, data.userId);

    // Fetch and send message history (also marks as read via getMessages)
    const messages = await this.messagingService.getMessages(data.conversationId, data.userId);
    client.emit('message_history', messages);
    
    // Notify room of presence/read update
    client.to(data.conversationId).emit('user_joined', { userId: data.userId });
    this.server.emit('presence_update', { userId: data.userId, status: 'online' });
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: { 
      conversationId: string; 
      senderId: string; 
      text: string; 
      attachmentUrl?: string;
      voiceNoteDuration?: number; // Optional voice note metadata
    },
    @ConnectedSocket() client: Socket
  ) {
    this.logger.log(`Message received from ${data.senderId} in room ${data.conversationId}: ${data.text}`);
    
    const savedMsg = await this.messagingService.sendMessage(
      data.conversationId,
      data.senderId,
      data.text,
    );

    // If voice note metadata exists, append to the broadcast payload
    const payload = {
      ...savedMsg,
      voiceNoteDuration: data.voiceNoteDuration || null
    };

    // Broadcast to the room
    this.server.to(data.conversationId).emit('new_message', payload);
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody() data: { conversationId: string; userId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket
  ) {
    client.to(data.conversationId).emit('user_typing', {
      userId: data.userId,
      isTyping: data.isTyping
    });
  }

  @SubscribeMessage('read_receipt')
  async handleReadReceipt(
    @MessageBody() data: { conversationId: string; userId: string },
    @ConnectedSocket() client: Socket
  ) {
    this.logger.log(`Read receipt from ${data.userId} in room ${data.conversationId}`);
    
    await this.messagingService.getMessages(data.conversationId, data.userId);
    this.server.to(data.conversationId).emit('messages_read', {
      conversationId: data.conversationId,
      userId: data.userId,
    });
  }
}
