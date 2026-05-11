import type { MapUserProfileSheetDto } from '@/types/map-user-profile-sheet';

export const MOCK_MAP_USER_PROFILE_SHEET: Omit<MapUserProfileSheetDto, 'id'> = {
  displayName: 'Мілана',
  age: 21,
  photoUri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop',
  statusEmoji: '🐶',
  statusLine: 'Йду гуляти з собакою',
  rating: 4.9,
  relationshipLabel: 'Твій друг',
  lastSeenLabel: '10 хвилин тому',
  meetsCount: 3,
  friendsCount: 1,
  about: 'smoothie lover',
  interests: [
    { id: 1, name: 'Пілатес' },
    { id: 2, name: 'Програмування' },
  ],
};
