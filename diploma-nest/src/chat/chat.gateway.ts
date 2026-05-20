import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto';

type AuthenticatedSocket = Socket & { userId?: number };

@WebSocketGateway({ cors: { origin: '*' }, namespace: 'chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const userId = await this.authenticate(client);
      client.userId = userId;
      client.join(this.userRoom(userId));
      this.logger.log(`Socket connected | socketId=${client.id} | userId=${userId}`);
    } catch (error) {
      this.logger.warn(`Socket rejected | socketId=${client.id} | error=${error instanceof Error ? error.message : 'unknown'}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.logger.log(`Socket disconnected | socketId=${client.id} | userId=${client.userId}`);
    }
  }

  @SubscribeMessage('conversation:join')
  async joinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: number },
  ) {
    const userId = this.requireUser(client);
    const conversation = await this.chatService.findConversationForUser(userId, Number(body.conversationId));
    client.join(this.conversationRoom(conversation.id));
    return { event: 'conversation:joined', data: { conversationId: conversation.id } };
  }

  @SubscribeMessage('message:send')
  async sendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: SendMessageDto,
  ) {
    const userId = this.requireUser(client);
    const message = await this.chatService.sendMessage(userId, body);
    await this.broadcastNewMessage(message);
    return { event: 'message:sent', data: message };
  }

  async broadcastNewMessage(message: { conversationId: number; senderId: number }) {
    const conversation = await this.chatService.findConversationForUser(
      message.senderId,
      message.conversationId,
    );
    const participantIds = conversation.participants.map((participant) => participant.userId);

    participantIds.forEach((participantId) => {
      this.server.to(this.userRoom(participantId)).emit('message:new', message);
    });
  }

  @SubscribeMessage('conversation:read')
  async markAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: number },
  ) {
    const userId = this.requireUser(client);
    const result = await this.chatService.markAsRead(userId, Number(body.conversationId));
    this.server.to(this.conversationRoom(Number(body.conversationId))).emit('conversation:read', {
      conversationId: Number(body.conversationId),
      userId,
      readAt: result.readAt,
    });
    return { event: 'conversation:read', data: result };
  }

  private async authenticate(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    const payload = await this.jwtService.verifyAsync<{ sub: number }>(token, {
      secret: process.env.JWT_ACCESS_SECRET ?? 'fallback_secret',
    });

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user.id;
  }

  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string') return authToken;

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }

    return undefined;
  }

  private requireUser(client: AuthenticatedSocket) {
    if (!client.userId) {
      throw new UnauthorizedException('Socket is not authenticated');
    }

    return client.userId;
  }

  private userRoom(userId: number) {
    return `user:${userId}`;
  }

  private conversationRoom(conversationId: number) {
    return `conversation:${conversationId}`;
  }
}
