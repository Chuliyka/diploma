export type NotificationKnownType =
  | 'FRIEND_REQUEST'
  | 'FRIEND_REQUEST_ACCEPTED'
  | 'status_interaction'
  | 'proximity_friend'
  | 'location_suggestion'
  | 'interest_match'
  | 'friend_activity'
  | 'place_discovery';

export interface NotificationDto {
  id: string | number;
  type: string;
  title: string;
  subtitle?: string;
  body?: string;
  createdAt: string;
  read?: boolean;
  metadata?: Record<string, unknown>;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  createdAt: string;
  read: boolean;
  metadata?: Record<string, unknown>;
}

export interface NotificationListSection {
  dayKey: string;
  title: string;
  data: NotificationItem[];
}

export function mapNotificationDto(dto: NotificationDto): NotificationItem {
  const subtitle = dto.subtitle ?? dto.body ?? '';
  return {
    id: String(dto.id),
    type: dto.type,
    title: dto.title,
    subtitle,
    createdAt: dto.createdAt,
    read: Boolean(dto.read),
    metadata: dto.metadata,
  };
}

export function mapNotificationDtoList(dtos: NotificationDto[]): NotificationItem[] {
  return dtos.map(mapNotificationDto);
}
