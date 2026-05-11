import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import Twilio from 'twilio';

const googleClient = new OAuth2Client();

@Injectable()
export class UsersService {
  private static readonly CODE_TTL_MINUTES = 10;
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async googleAuth(idToken: string) {
    const audiences = this.getGoogleAudiences();

    if (!idToken) {
      this.logger.warn('Google auth rejected: idToken is missing in request body');
      throw new UnauthorizedException('Invalid Google token');
    }

    if (audiences.length === 0) {
      this.logger.error('Google auth configuration error: GOOGLE_CLIENT_ID/GOOGLE_IOS_CLIENT_ID are not set');
      throw new UnauthorizedException('Invalid Google token');
    }

    const tokenPreview = `${idToken.slice(0, 12)}...${idToken.slice(-8)}`;
    let payload: any;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: audiences,
      });
      payload = ticket.getPayload();
    } catch (e: any) {
      const decoded = this.decodeGoogleJwtClaims(idToken);
      this.logger.warn(
        `Google auth verify failed | audFromToken=${decoded?.aud ?? 'unknown'} | requiredAudiences=${audiences.join(',')} | iss=${decoded?.iss ?? 'unknown'} | token=${tokenPreview} | error=${e?.message ?? 'unknown'}`,
      );
      throw new UnauthorizedException('Invalid Google token');
    }

    if (!payload?.sub) {
      this.logger.warn(`Google auth rejected: payload has no sub | token=${tokenPreview}`);
      throw new UnauthorizedException('Invalid Google token');
    }

    const { sub: googleId, email, name, picture } = payload;
    this.logger.log(
      `Google auth verified | googleId=${googleId} | email=${email ?? 'n/a'} | aud=${payload.aud ?? 'n/a'}`,
    );

    let user = await this.prisma.user.findUnique({ where: { googleId } });
    const isNewUser = !user;

    if (!user) {
      user = await this.prisma.user.create({
        data: { googleId, name, photoUrl: picture ?? null, isOnline: true } as any,
      });
      this.logger.log(`Google auth user created | userId=${user.id}`);
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { isOnline: true } as any,
      });
      this.logger.log(`Google auth user found | userId=${user.id}`);
    }

    const needsOnboarding = isNewUser || !user.name || !user.birthDate || !user.gender;
    const tokens = await this.authService.generateTokens(user.id);
    return { ...user, interests: [], isNewUser, needsOnboarding, ...tokens };
  }

  create(data: CreateUserDto) {
    if (!data.email && !data.phoneNumber && !data.googleId && !data.appleId) {
      throw new BadRequestException(
        'Provide at least one registration method: email, phoneNumber, googleId, or appleId.',
      );
    }

    return this.prisma.user.create({
      data,
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        interests: {
          include: { interest: true },
        },
      },
    });
  }

  async findByPhone(phoneNumber: string) {
    // Support Google session keys like "google:42"
    if (phoneNumber?.startsWith('google:')) {
      const id = parseInt(phoneNumber.split(':')[1], 10);
      const user = await this.prisma.user.findUnique({
        where: { id },
        include: { interests: { include: { interest: true } } },
      });
      if (!user) throw new NotFoundException(`User with id ${id} not found.`);
      return user;
    }

    this.assertPhoneNumber(phoneNumber);

    const user = await this.prisma.user.findUnique({
      where: { phoneNumber },
      include: {
        interests: {
          include: { interest: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with phone ${phoneNumber} not found.`);
    }

    return user;
  }

  async saveInterests(phoneNumber: string, interestNames: string[]) {
    const user = await this.findUserByKey(phoneNumber);

    // Upsert each interest by name
    const interests = await Promise.all(
      interestNames.map((name) =>
        this.prisma.interest.upsert({
          where: { name },
          update: {},
          create: { name },
        }),
      ),
    );

    // Replace existing interests
    await this.prisma.userInterest.deleteMany({ where: { userId: user.id } });
    await this.prisma.userInterest.createMany({
      data: interests.map((i) => ({ userId: user.id, interestId: i.id })),
    });

    this.logger.log(`Interests saved | userId=${user.id} | count=${interests.length}`);

    return { success: true, saved: interests.map((i) => i.name) };
  }

  async uploadPhoto(phoneNumber: string, filename: string) {
    this.assertPhoneNumber(phoneNumber);

    const user = await this.prisma.user.findUnique({ where: { phoneNumber } });

    if (!user) {
      throw new NotFoundException(`User with phone ${phoneNumber} not found.`);
    }

    const photoUrl = `/uploads/${filename}`;
    console.log(`[UsersService] Photo uploaded — phone: ${phoneNumber} | file: ${filename} | saved path: ${photoUrl}`);

    return this.prisma.user.update({
      where: { phoneNumber },
      data: { photoUrl },
    });
  }

  async updateByPhone(phoneNumber: string, data: UpdateUserDto) {
    const user = await this.findUserByKey(phoneNumber);

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.gender !== undefined && { gender: data.gender }),
        ...(data.birthDate !== undefined && { birthDate: new Date(data.birthDate) }),
        ...(data.about !== undefined && ({ about: data.about } as any)),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
        ...(data.isRegistered !== undefined && { isRegistered: data.isRegistered }),
      },
    });
  }

  async updateStatusByPhone(phoneNumber: string, isOnline: boolean) {
    if (typeof isOnline !== 'boolean') {
      throw new BadRequestException('isOnline must be a boolean');
    }

    if (phoneNumber?.startsWith('google:')) {
      const id = parseInt(phoneNumber.split(':')[1], 10);
      if (Number.isNaN(id)) {
        throw new BadRequestException('Invalid google session key');
      }

      const user = await this.prisma.user.findUnique({
        where: { id },
        select: { latitude: true, longitude: true },
      });
      if (!user) throw new NotFoundException(`User with id ${id} not found.`);

      return this.prisma.user.update({
        where: { id },
        data: this.buildPresenceUpdate(isOnline, user.latitude, user.longitude),
      });
    }

    this.assertPhoneNumber(phoneNumber);

    const user = await this.prisma.user.findUnique({
      where: { phoneNumber },
      select: { latitude: true, longitude: true },
    });
    if (!user) throw new NotFoundException(`User with phone ${phoneNumber} not found.`);

    return this.prisma.user.update({
      where: { phoneNumber },
      data: this.buildPresenceUpdate(isOnline, user.latitude, user.longitude),
    });
  }

  private buildPresenceUpdate(isOnline: boolean, latitude?: number | null, longitude?: number | null) {
    return {
      isOnline,
      ...(!isOnline && {
        lastSeenAt: new Date(),
        ...(latitude !== null && latitude !== undefined && { lastLatitude: latitude }),
        ...(longitude !== null && longitude !== undefined && { lastLongitude: longitude }),
      }),
    };
  }

  async sendPhoneVerificationCode(phoneNumber: string) {
    this.assertPhoneNumber(phoneNumber);

    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFromPhone = process.env.TWILIO_FROM_PHONE;

    if (!twilioAccountSid || !twilioAuthToken || !twilioFromPhone) {
      throw new BadRequestException(
        'Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_PHONE.',
      );
    }

    const code = this.generateSixDigitCode();
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(
      Date.now() + UsersService.CODE_TTL_MINUTES * 60 * 1000,
    );

    await this.prisma.phoneVerificationCode.upsert({
      where: { phoneNumber },
      update: { codeHash, expiresAt },
      create: { phoneNumber, codeHash, expiresAt },
    });

    const twilio = Twilio(twilioAccountSid, twilioAuthToken);

    await twilio.messages.create({
      to: phoneNumber,
      from: twilioFromPhone,
      body: `Your verification code is: ${code}`,
    });

    return {
      success: true,
      expiresInMinutes: UsersService.CODE_TTL_MINUTES,
    };
  }

  async loginByPhone(phoneNumber: string) {
    this.assertPhoneNumber(phoneNumber);

    const user = await this.prisma.user.findUnique({
      where: { phoneNumber },
      include: {
        interests: {
          include: { interest: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with phone ${phoneNumber} not found.`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { isOnline: true } as any,
      include: {
        interests: {
          include: { interest: true },
        },
      },
    });

    const tokens = await this.authService.generateTokens(user.id);
    return {
      ...updatedUser,
      isNewUser: false,
      needsOnboarding: !updatedUser.name || !updatedUser.birthDate || !updatedUser.gender,
      ...tokens,
    };
  }

  async verifyPhoneCode(phoneNumber: string, code: string) {
    this.assertPhoneNumber(phoneNumber);

    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('Code must be exactly 6 digits.');
    }

    const verification = await this.prisma.phoneVerificationCode.findUnique({
      where: { phoneNumber },
    });

    if (!verification) {
      throw new BadRequestException('Verification code not found. Request a new code.');
    }

    if (verification.expiresAt.getTime() < Date.now()) {
      await this.prisma.phoneVerificationCode.delete({
        where: { phoneNumber },
      });
      throw new BadRequestException('Verification code expired. Request a new code.');
    }

    const codeHash = this.hashCode(code);

    if (verification.codeHash !== codeHash) {
      throw new BadRequestException('Invalid verification code.');
    }

    const user = await this.prisma.user.upsert({
      where: { phoneNumber },
      update: { isPhoneVerified: true, isOnline: true } as any,
      create: { phoneNumber, isPhoneVerified: true, isOnline: true } as any,
    });

    await this.prisma.phoneVerificationCode.delete({
      where: { phoneNumber },
    });

    const tokens = await this.authService.generateTokens(user.id);
    return {
      success: true,
      userId: user.id,
      phoneVerified: user.isPhoneVerified,
      ...tokens,
    };
  }

  private generateSixDigitCode() {
    return randomInt(100000, 1000000).toString();
  }

  private hashCode(code: string) {
    return createHash('sha256').update(code).digest('hex');
  }

  private decodeGoogleJwtClaims(token: string): { aud?: string; iss?: string; sub?: string } | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payload = parts[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const normalized = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
      const decoded = Buffer.from(normalized, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  private getGoogleAudiences(): string[] {
    const values = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
      process.env.GOOGLE_CLIENT_IDS,
    ]
      .filter((value): value is string => Boolean(value))
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const audiences = Array.from(new Set(values));

    if (audiences.length === 1) {
      this.logger.warn(
        `Only one Google audience configured at runtime: ${audiences[0]} (check .env loading and restart)`,
      );
    }

    return audiences;
  }

  private assertPhoneNumber(phoneNumber: string) {
    if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
      throw new BadRequestException(
        'Phone number must be in E.164 format, for example +380501234567.',
      );
    }
  }

  private async findUserByKey(sessionKey: string) {
    if (sessionKey?.startsWith('google:')) {
      const id = parseInt(sessionKey.split(':')[1], 10);
      if (Number.isNaN(id)) throw new BadRequestException('Invalid google session key');
      const user = await this.prisma.user.findUnique({ where: { id } });
      if (!user) throw new NotFoundException(`User with id ${id} not found.`);
      return user;
    }
    this.assertPhoneNumber(sessionKey);
    const user = await this.prisma.user.findUnique({ where: { phoneNumber: sessionKey } });
    if (!user) throw new NotFoundException(`User with phone ${sessionKey} not found.`);
    return user;
  }
}
