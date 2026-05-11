import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

type AuthenticatedSocket = Socket & { userId?: number };

@WebSocketGateway({ cors: { origin: '*' }, namespace: 'notifications' })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const userId = await this.authenticate(client);
      client.userId = userId;
      client.join(this.userRoom(userId));
      this.logger.log(`Notifications socket connected | socketId=${client.id} | userId=${userId}`);
    } catch (error) {
      this.logger.warn(
        `Notifications socket rejected | socketId=${client.id} | error=${error instanceof Error ? error.message : 'unknown'}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.logger.log(`Notifications socket disconnected | socketId=${client.id} | userId=${client.userId}`);
    }
  }

  emitNotificationToUser(userId: number, notification: unknown) {
    this.server.to(this.userRoom(userId)).emit('notification:new', notification);
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

  private userRoom(userId: number) {
    return `user:${userId}`;
  }
}