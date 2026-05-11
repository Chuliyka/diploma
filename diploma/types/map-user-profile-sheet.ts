export interface MapUserProfileInterestDto {
  id: number;
  name: string;
}

export interface MapUserProfileSheetDto {
  id: number;
  displayName: string;
  age: number | null;
  photoUri: string | null;
  statusEmoji: string;
  statusLine: string;
  rating: number;
  relationshipLabel: string;
  lastSeenLabel: string;
  meetsCount: number;
  friendsCount: number;
  about: string;
  interests: MapUserProfileInterestDto[];
}
