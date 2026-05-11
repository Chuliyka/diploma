import type {
  MapUserFriendRequestStatus,
  MapUserProfileInterestDto,
  MapUserProfileSheetDto,
} from '@/types/map-user-profile-sheet';

export function calcAgeFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const diff = Date.now() - new Date(birthDate).getTime();
  if (!Number.isFinite(diff)) return null;
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

type OnlineMarkerLike = {
  id: number;
  photoUrl: string | null;
  name: string | null;
  isOnline?: boolean | string | number | null;
  lastSeenAt?: string | null;
  birthDate?: string | null;
  about?: string | null;
  statusEmoji?: string | null;
  statusBody?: string | null;
  rating?: number | null;
  meetsCount?: number | undefined;
  friendsCount?: number | undefined;
  interests?: { interest: { id: number; name: string } }[] | undefined;
  isFriend?: boolean | null;
  friendRequestStatus?: MapUserFriendRequestStatus | null;
  relationshipLabel?: string | null;
  statusRelativeLabel?: string | null;
};

function formatPresenceLabel(isOnline: boolean, lastSeenAt: string | null | undefined): string {
  if (isOnline) return 'Онлайн';
  if (!lastSeenAt) return 'Був(ла) в мережі давно';

  const lastSeenTime = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(lastSeenTime)) return 'Був(ла) в мережі давно';

  const diffMs = Math.max(0, Date.now() - lastSeenTime);
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Був(ла) в мережі щойно';
  if (minutes < 60) return `Був(ла) в мережі ${minutes} хв тому`;
  if (hours < 24) return `Був(ла) в мережі ${hours} год тому`;
  if (days < 7) return `Був(ла) в мережі ${days} дн тому`;

  return `Був(ла) в мережі ${new Date(lastSeenTime).toLocaleDateString('uk-UA')}`;
}

function parseBackendBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function buildMapUserProfileSheetFromMarker(
  marker: OnlineMarkerLike,
  photoBaseUrl: string,
): MapUserProfileSheetDto {
  const age = calcAgeFromBirthDate(marker.birthDate);

  let interests: MapUserProfileInterestDto[] = [];
  if (Array.isArray(marker.interests) && marker.interests.length > 0) {
    interests = marker.interests.map((row) => ({
      id: row.interest.id,
      name: row.interest.name,
    }));
  }

  const photoUri =
    marker.photoUrl && marker.photoUrl.length > 0 ? `${photoBaseUrl}${marker.photoUrl}` : null;

  const statusLine = marker.statusBody?.trim() || '';
  const about = marker.about?.trim() || '';
  const relationshipLabel = marker.relationshipLabel?.trim() || 'Не твій друг';
  const isFriend = typeof marker.isFriend === 'boolean' ? marker.isFriend : relationshipLabel === 'Твій друг';
  const friendRequestStatus = marker.friendRequestStatus ?? 'none';
  const isOnline = parseBackendBoolean(marker.isOnline);
  const lastSeenLabel = isOnline
    ? formatPresenceLabel(true, marker.lastSeenAt)
    : marker.statusRelativeLabel?.trim() || formatPresenceLabel(false, marker.lastSeenAt);

  return {
    id: marker.id,
    displayName: marker.name?.trim() || 'Користувач',
    age,
    photoUri,
    statusEmoji: marker.statusEmoji?.trim() || '',
    statusLine,
    rating: Number.isFinite(Number(marker.rating)) ? Number(marker.rating) : 0,
    isOnline,
    isFriend,
    friendRequestStatus,
    relationshipLabel,
    lastSeenLabel,
    meetsCount: marker.meetsCount ?? 0,
    friendsCount: marker.friendsCount ?? 0,
    about,
    interests,
  };
}
