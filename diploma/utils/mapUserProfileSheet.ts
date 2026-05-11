import { MOCK_MAP_USER_PROFILE_SHEET } from '@/data/mock-map-user-profile';
import type { MapUserProfileInterestDto, MapUserProfileSheetDto } from '@/types/map-user-profile-sheet';

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
  birthDate?: string | null;
  about?: string | null;
  statusEmoji?: string | null;
  statusBody?: string | null;
  rating?: number | null;
  meetsCount?: number | undefined;
  friendsCount?: number | undefined;
  interests?: { interest: { id: number; name: string } }[] | undefined;
  statusRelativeLabel?: string | null;
};

export function buildMapUserProfileSheetFromMarker(
  marker: OnlineMarkerLike,
  photoBaseUrl: string,
): MapUserProfileSheetDto {
  const m = MOCK_MAP_USER_PROFILE_SHEET;
  const age = calcAgeFromBirthDate(marker.birthDate);

  let interests: MapUserProfileInterestDto[] = m.interests;
  if (Array.isArray(marker.interests) && marker.interests.length > 0) {
    interests = marker.interests.map((row) => ({
      id: row.interest.id,
      name: row.interest.name,
    }));
  }

  const photoUri =
    marker.photoUrl && marker.photoUrl.length > 0 ? `${photoBaseUrl}${marker.photoUrl}` : m.photoUri;

  const statusLine = marker.statusBody?.trim() || m.statusLine;
  const about = marker.about?.trim() || m.about;

  return {
    id: marker.id,
    displayName: marker.name?.trim() || m.displayName,
    age: age ?? m.age,
    photoUri,
    statusEmoji: marker.statusEmoji?.trim() || m.statusEmoji,
    statusLine,
    rating: Number.isFinite(Number(marker.rating)) ? Number(marker.rating) : m.rating,
    relationshipLabel: m.relationshipLabel,
    lastSeenLabel: marker.statusRelativeLabel?.trim() || m.lastSeenLabel,
    meetsCount: marker.meetsCount ?? m.meetsCount,
    friendsCount: marker.friendsCount ?? m.friendsCount,
    about,
    interests,
  };
}
