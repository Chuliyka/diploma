export class UpdateUserDto {
  name?: string;
  birthDate?: string; // ISO date string, e.g. "2000-05-20"
  gender?: string;
  about?: string;
  bio?: string;
  latitude?: number;
  longitude?: number;
  isRegistered?: boolean;
}
