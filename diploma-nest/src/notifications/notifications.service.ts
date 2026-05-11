import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(userId: number) {
    const notifications = await this.prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      include: this.notificationInclude(),
    });

    return notifications.map((notification) => this.toResponse(notification));
  }

  async countUnread(userId: number) {
    const count = await this.prisma.notification.count({
      where: { recipientId: userId, readAt: null },
    });

    return { count };
  }

  async markRead(userId: number, notificationId: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: this.notificationInclude(),
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    if (notification.recipientId !== userId) {
      throw new ForbiddenException('You cannot read this notification.');
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: notification.readAt ?? new Date() },
      include: this.notificationInclude(),
    });

    return this.toResponse(updated);
  }

  async createFriendRequestNotification(params: {
    recipientId: number;
    actorId: number;
    friendshipId: number;
    actorName?: string | null;
  }) {
    const actorName = params.actorName?.trim() || 'Користувач';
    const notification = await this.prisma.notification.create({
      data: {
        recipientId: params.recipientId,
        actorId: params.actorId,
        type: NotificationType.FRIEND_REQUEST,
        title: `${actorName} хоче додати вас у друзі`,
        body: 'Відкрийте заявку, щоб прийняти або відхилити її.',
        metadata: {
          friendshipId: params.friendshipId,
          requesterId: params.actorId,
        },
      },
      include: this.notificationInclude(),
    });

    return this.toResponse(notification);
  }

  private notificationInclude() {
    return {
      actor: {
        select: {
          id: true,
          name: true,
          photoUrl: true,
        },
      },
    };
  }

  private toResponse(notification: any) {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      subtitle: notification.body ?? '',
      body: notification.body,
      createdAt: notification.createdAt,
      read: Boolean(notification.readAt),
      readAt: notification.readAt,
      metadata: notification.metadata ?? {},
      actor: notification.actor,
    };
  }
}