import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFriendRequestDto } from './dto';
import { FriendsService } from './friends.service';

@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  findFriends(@Req() req: any) {
    return this.friendsService.findFriends(req.user.id);
  }

  @Get('requests/incoming')
  findIncomingRequests(@Req() req: any) {
    return this.friendsService.findIncomingRequests(req.user.id);
  }

  @Get('requests/outgoing')
  findOutgoingRequests(@Req() req: any) {
    return this.friendsService.findOutgoingRequests(req.user.id);
  }

  @Post('requests')
  sendRequest(@Req() req: any, @Body() dto: CreateFriendRequestDto) {
    return this.friendsService.sendRequest(req.user.id, dto.addresseeId);
  }

  @Patch('requests/:friendshipId/accept')
  acceptRequest(@Req() req: any, @Param('friendshipId', ParseIntPipe) friendshipId: number) {
    return this.friendsService.acceptRequest(req.user.id, friendshipId);
  }

  @Patch('requests/:friendshipId/decline')
  declineRequest(@Req() req: any, @Param('friendshipId', ParseIntPipe) friendshipId: number) {
    return this.friendsService.declineRequest(req.user.id, friendshipId);
  }

  @Delete(':friendshipId')
  removeFriendship(@Req() req: any, @Param('friendshipId', ParseIntPipe) friendshipId: number) {
    return this.friendsService.removeFriendship(req.user.id, friendshipId);
  }
}
