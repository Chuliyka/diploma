import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FriendshipStatus } from '../../generated/prisma/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findFriends(userId: number) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      orderBy: { updatedAt: 'desc' },
      include: this.friendshipInclude(),
    });

    return friendships.map((friendship) => this.toFriendshipResponse(friendship, userId));
  }

  async findIncomingRequests(userId: number) {
    const requests = await this.prisma.friendship.findMany({
      where: { addresseeId: userId, status: FriendshipStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      include: this.friendshipInclude(),
    });

    return requests.map((friendship) => this.toFriendshipResponse(friendship, userId));
  }

  async findOutgoingRequests(userId: number) {
    const requests = await this.prisma.friendship.findMany({
      where: { requesterId: userId, status: FriendshipStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      include: this.friendshipInclude(),
    });

    return requests.map((friendship) => this.toFriendshipResponse(friendship, userId));
  }

  async sendRequest(requesterId: number, addresseeId: number) {
    this.assertValidId(addresseeId, 'addresseeId');
    if (requesterId === addresseeId) {
      throw new BadRequestException('You cannot send a friend request to yourself.');
    }

    const addressee = await this.prisma.user.findUnique({ where: { id: addresseeId } });
    if (!addressee) {
      throw new NotFoundException(`User with id ${addresseeId} not found.`);
    }

    const pairKey = this.getPairKey(requesterId, addresseeId);
    const existing = await this.prisma.friendship.findUnique({ where: { pairKey } });

    if (existing?.status === FriendshipStatus.ACCEPTED) {
      throw new BadRequestException('You are already friends.');
    }

    if (existing?.status === FriendshipStatus.PENDING) {
      throw new BadRequestException('Friend request is already pending.');
    }

    const friendship = existing
      ? await this.prisma.friendship.update({
          where: { id: existing.id },
          data: {
            requesterId,
            addresseeId,
            status: FriendshipStatus.PENDING,
            respondedAt: null,
          },
          include: this.friendshipInclude(),
        })
      : await this.prisma.friendship.create({
          data: {
            pairKey,
            requesterId,
            addresseeId,
          },
          include: this.friendshipInclude(),
        });

    await this.notificationsService.createFriendRequestNotification({
      recipientId: addresseeId,
      actorId: requesterId,
      friendshipId: friendship.id,
      actorName: friendship.requester?.name,
    });

    return this.toFriendshipResponse(friendship, requesterId);
  }

  async acceptRequest(userId: number, friendshipId: number) {
    this.assertValidId(friendshipId, 'friendshipId');
    const friendship = await this.findFriendshipOrThrow(friendshipId);

    if (friendship.addresseeId !== userId) {
      throw new ForbiddenException('Only the request recipient can accept this friend request.');
    }

    if (friendship.status !== FriendshipStatus.PENDING) {
      throw new BadRequestException('Only pending friend requests can be accepted.');
    }

    const updated = await this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: FriendshipStatus.ACCEPTED, respondedAt: new Date() },
      include: this.friendshipInclude(),
    });

    await this.notificationsService.createFriendRequestAcceptedNotification({
      recipientId: updated.requesterId,
      actorId: userId,
      friendshipId: updated.id,
      actorName: updated.addressee?.name,
    });

    return this.toFriendshipResponse(updated, userId);
  }

  async declineRequest(userId: number, friendshipId: number) {
    this.assertValidId(friendshipId, 'friendshipId');
    const friendship = await this.findFriendshipOrThrow(friendshipId);

    if (friendship.addresseeId !== userId) {
      throw new ForbiddenException('Only the request recipient can decline this friend request.');
    }

    if (friendship.status !== FriendshipStatus.PENDING) {
      throw new BadRequestException('Only pending friend requests can be declined.');
    }

    const updated = await this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: FriendshipStatus.DECLINED, respondedAt: new Date() },
      include: this.friendshipInclude(),
    });

    return this.toFriendshipResponse(updated, userId);
  }

  async removeFriendship(userId: number, friendshipId: number) {
    this.assertValidId(friendshipId, 'friendshipId');
    const friendship = await this.findFriendshipOrThrow(friendshipId);

    if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
      throw new ForbiddenException('You are not a participant of this friendship.');
    }

    await this.prisma.friendship.delete({ where: { id: friendshipId } });
    return { success: true };
  }

  private async findFriendshipOrThrow(friendshipId: number) {
    const friendship = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!friendship) {
      throw new NotFoundException('Friendship not found.');
    }

    return friendship;
  }

  private toFriendshipResponse(friendship: any, currentUserId: number) {
    const friend = friendship.requesterId === currentUserId ? friendship.addressee : friendship.requester;

    return {
      id: friendship.id,
      status: friendship.status,
      requesterId: friendship.requesterId,
      addresseeId: friendship.addresseeId,
      createdAt: friendship.createdAt,
      updatedAt: friendship.updatedAt,
      respondedAt: friendship.respondedAt,
      friend,
      requester: friendship.requester,
      addressee: friendship.addressee,
    };
  }

  private friendshipInclude() {
    return {
      requester: { select: this.userSelect() },
      addressee: { select: this.userSelect() },
    };
  }

  private userSelect() {
    return {
      id: true,
      name: true,
      photoUrl: true,
      status: true,
      isOnline: true,
      lastSeenAt: true,
    };
  }

  private getPairKey(firstUserId: number, secondUserId: number) {
    const [firstId, secondId] = [firstUserId, secondUserId].sort((a, b) => a - b);
    return `${firstId}:${secondId}`;
  }

  private assertValidId(value: number, fieldName: string) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(`${fieldName} must be a positive integer.`);
    }
  }
}
