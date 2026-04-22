import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async generateTokens(userId: number) {
    const payload = { sub: userId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '30d',
      }),
    ]);

    // Store hashed refresh token
    const hashed = createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken: hashed },
    });

    console.log(`[AuthService] Tokens generated for userId: ${userId}`);
    return { accessToken, refreshToken };
  }

  async refreshTokens(userId: number, refreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.hashedRefreshToken) throw new UnauthorizedException('No active session');

    const hashed = createHash('sha256').update(refreshToken).digest('hex');
    if (hashed !== user.hashedRefreshToken) throw new UnauthorizedException('Invalid refresh token');

    console.log(`[AuthService] Refreshing tokens for userId: ${userId}`);
    return this.generateTokens(userId);
  }

  async logout(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken: null },
    });
    console.log(`[AuthService] Logged out userId: ${userId}`);
  }
}
