import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

class RefreshDto { refreshToken: string; }

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    if (!dto.refreshToken) throw new UnauthorizedException('No refresh token');
    let payload: { sub: number };
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Refresh token expired or invalid');
    }
    return this.authService.refreshTokens(payload.sub, dto.refreshToken);
  }

  @Post('logout')
  async logout(@Body() body: { userId: number }) {
    return this.authService.logout(body.userId);
  }
}
