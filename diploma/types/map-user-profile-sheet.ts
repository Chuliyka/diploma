export interface MapUserProfileInterestDto {
  id: number;
  name: string;
}

export type MapUserFriendRequestStatus = 'none' | 'incoming' | 'outgoing';

export interface MapUserProfileSheetDto {
  id: number;
  displayName: string;
  age: number | null;
  photoUri: string | null;
  statusEmoji: string;
  statusLine: string;
  rating: number;
  isOnline: boolean;
  isFriend: boolean;
  friendRequestStatus: MapUserFriendRequestStatus;
  relationshipLabel: string;
  lastSeenLabel: string;
  meetsCount: number;
  friendsCount: number;
  about: string;
  interests: MapUserProfileInterestDto[];
}
