import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync } from 'fs';
import { extname, join } from 'path';
import { ensureUploadsDir, UPLOADS_DIR } from '../paths';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SaveInterestsDto } from './dto/save-interests.dto';
import { SendPhoneCodeDto } from './dto/send-phone-code.dto';
import { VerifyPhoneCodeDto } from './dto/verify-phone-code.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('google-auth')
  googleAuth(@Body() dto: GoogleAuthDto) {
    return this.usersService.googleAuth(dto.idToken);
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get('by-phone')
  findByPhone(@Query('phoneNumber') phoneNumber: string) {
    return this.usersService.findByPhone(phoneNumber);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post('phone/send-code')
  sendPhoneCode(@Body() dto: SendPhoneCodeDto) {
    return this.usersService.sendPhoneVerificationCode(dto.phoneNumber);
  }

  @Post('phone/login')
  loginByPhone(@Body() dto: SendPhoneCodeDto) {
    return this.usersService.loginByPhone(dto.phoneNumber);
  }

  @Post('phone/verify-code')
  verifyPhoneCode(@Body() dto: VerifyPhoneCodeDto) {
    return this.usersService.verifyPhoneCode(dto.phoneNumber, dto.code);
  }

  @Patch('by-phone')
  updateByPhone(@Query('phoneNumber') phoneNumber: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateByPhone(phoneNumber, dto);
  }

  @Patch('by-phone/status')
  updateStatusByPhone(@Query('phoneNumber') phoneNumber: string, @Body() dto: UpdateStatusDto) {
    return this.usersService.updateStatusByPhone(phoneNumber, dto.isOnline);
  }

  @Post('by-phone/interests')
  saveInterests(@Query('phoneNumber') phoneNumber: string, @Body() dto: SaveInterestsDto) {
    return this.usersService.saveInterests(phoneNumber, dto.interests);
  }

  @Post('by-phone/photo')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureUploadsDir();
          cb(null, UPLOADS_DIR);
        },
        filename: (_req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname || '') || (file.mimetype === 'image/png' ? '.png' : '.jpg');
          cb(null, unique + ext);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  async uploadPhoto(
    @Query('phoneNumber') phoneNumber: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!phoneNumber?.trim()) {
      throw new BadRequestException('phoneNumber query parameter is required.');
    }

    if (!file) {
      throw new BadRequestException('Photo file is missing. Send multipart field "photo".');
    }

    if (!file.size) {
      throw new BadRequestException('Uploaded photo file is empty.');
    }

    const savedPath = join(UPLOADS_DIR, file.filename);
    if (!existsSync(savedPath)) {
      throw new BadRequestException(`Photo was not saved to disk: ${savedPath}`);
    }

    console.log(
      `[UsersController] POST by-phone/photo — key: ${phoneNumber} | dir: ${UPLOADS_DIR} | file: ${file.filename} | size: ${file.size} bytes | path: ${savedPath}`,
    );

    return this.usersService.uploadPhoto(phoneNumber.trim(), file.filename);
  }
}
