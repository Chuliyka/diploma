export class CreateUserDto {
  email?: string;
  phoneNumber?: string;
  googleId?: string;
  appleId?: string;
  name?: string;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
}
