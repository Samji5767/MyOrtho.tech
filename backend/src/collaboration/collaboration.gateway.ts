import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

@WebSocketGateway({ namespace: 'collaboration', cors: true })
export class CollaborationGateway {
  private readonly logger = new Logger(CollaborationGateway.name);

  @WebSocketServer()
  server: Server;

  // Active tooth locks record (CaseID -> ToothID -> UserID)
  private activeLocks: Map<string, Map<number, string>> = new Map();

  @SubscribeMessage('join_case')
  handleJoinCase(
    @MessageBody() data: { caseId: string; userId: string },
    @ConnectedSocket() client: Socket
  ): void {
    client.join(data.caseId);
    this.logger.log(`Client ${data.userId} joined case workspace channel: ${data.caseId}`);
  }

  @SubscribeMessage('update_tooth_transform')
  handleUpdateTransform(
    @MessageBody() data: { 
      caseId: string; 
      toothId: number; 
      displacement: { translation: [number, number, number]; rotation: [number, number, number] } 
    },
    @ConnectedSocket() client: Socket
  ): void {
    // Broadcast real-time movements coordinate updates to all other clients in same case
    client.to(data.caseId).emit('tooth_transform_updated', {
      toothId: data.toothId,
      displacement: data.displacement
    });
  }

  @SubscribeMessage('lock_tooth')
  handleLockTooth(
    @MessageBody() data: { caseId: string; toothId: number; userId: string },
    @ConnectedSocket() client: Socket
  ): void {
    if (!this.activeLocks.has(data.caseId)) {
      this.activeLocks.set(data.caseId, new Map());
    }

    const caseLocks = this.activeLocks.get(data.caseId)!;
    caseLocks.set(data.toothId, data.userId);

    // Notify other editors that the tooth is locked
    client.to(data.caseId).emit('tooth_locked', {
      toothId: data.toothId,
      lockedBy: data.userId
    });
  }

  @SubscribeMessage('unlock_tooth')
  handleUnlockTooth(
    @MessageBody() data: { caseId: string; toothId: number },
    @ConnectedSocket() client: Socket
  ): void {
    const caseLocks = this.activeLocks.get(data.caseId);
    if (caseLocks) {
      caseLocks.delete(data.toothId);
    }

    // Broadcast unlock trigger
    client.to(data.caseId).emit('tooth_unlocked', {
      toothId: data.toothId
    });
  }

  @SubscribeMessage('cursor_move')
  handleCursorMove(
    @MessageBody() data: { caseId: string; userId: string; position: { x: number; y: number } },
    @ConnectedSocket() client: Socket
  ): void {
    client.to(data.caseId).emit('cursor_moved', {
      userId: data.userId,
      position: data.position
    });
  }

  @SubscribeMessage('add_3d_comment')
  handleAdd3DComment(
    @MessageBody() data: { 
      caseId: string; 
      authorId: string; 
      authorName: string;
      fdiTooth?: number;
      coords: { x: number; y: number; z: number };
      text: string;
    },
    @ConnectedSocket() client: Socket
  ): void {
    const commentId = `comm-${randomUUID()}`;
    client.to(data.caseId).emit('comment_3d_added', {
      id: commentId,
      authorId: data.authorId,
      authorName: data.authorName,
      fdiTooth: data.fdiTooth,
      coords: data.coords,
      text: data.text,
      createdAt: new Date().toISOString()
    });
  }

  @SubscribeMessage('compare_versions')
  handleCompareVersions(
    @MessageBody() data: { caseId: string; stageIdA: string; stageIdB: string },
    @ConnectedSocket() client: Socket
  ): void {
    client.to(data.caseId).emit('version_compared', {
      stageIdA: data.stageIdA,
      stageIdB: data.stageIdB
    });
  }
}
