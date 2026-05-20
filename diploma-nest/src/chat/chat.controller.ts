import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { CreateConversationDto, SendMessageDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('conversations')
  findConversations(@Req() req: any) {
    return this.chatService.findUserConversations(req.user.id);
  }

  @Post('conversations')
  createConversation(@Req() req: any, @Body() dto: CreateConversationDto) {
    return this.chatService.getOrCreateDirectConversation(req.user.id, dto.participantId);
  }

  @Get('conversations/:conversationId/messages')
  findMessages(
    @Req() req: any,
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Query('take') take?: string,
    @Query('cursorId') cursorId?: string,
  ) {
    return this.chatService.findMessages(
      req.user.id,
      conversationId,
      take ? Number(take) : undefined,
      cursorId ? Number(cursorId) : undefined,
    );
  }

  @Post('messages')
  async sendMessage(@Req() req: any, @Body() dto: SendMessageDto) {
    const message = await this.chatService.sendMessage(req.user.id, dto);
    await this.chatGateway.broadcastNewMessage(message);
    return message;
  }

  @Patch('conversations/:conversationId/read')
  markAsRead(@Req() req: any, @Param('conversationId', ParseIntPipe) conversationId: number) {
    return this.chatService.markAsRead(req.user.id, conversationId);
  }
}
