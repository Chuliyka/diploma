import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL } from '@/constants/api';
import { AppColors } from '@/constants/app-colors';
import { MapSortFilterBottomSheet } from '@/components/map/MapSortFilterBottomSheet';
import { getInterestNameByFilterKey, type MapSortFilterKey } from '@/constants/interests';
import { MapUserProfileBottomSheet } from '@/components/map/MapUserProfileBottomSheet';
import type { MapUserFriendRequestStatus } from '@/types/map-user-profile-sheet';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import { buildMapUserProfileSheetFromMarker } from '@/utils/mapUserProfileSheet';
import { openChatWithParticipant } from '@/utils/openChat';
import { getSession } from '@/utils/session';

type UserMapData = {
  id: number | null;
  latitude: number;
  longitude: number;
  photoUrl: string | null;
};

type OnlineUserMarker = {
  id: number;
  latitude: number;
  longitude: number;
  photoUrl: string | null;
  name: string | null;
  isOnline?: boolean | null;
  lastSeenAt?: string | null;
  birthDate?: string | null;
  about?: string | null;
  statusEmoji?: string | null;
  statusBody?: string | null;
  rating?: number | null;
  meetsCount?: number;
  friendsCount?: number;
  interests?: { interest: { id: number; name: string } }[];
  isFriend?: boolean | null;
  friendRequestStatus?: MapUserFriendRequestStatus | null;
  relationshipLabel?: string | null;
  statusRelativeLabel?: string | null;
};

type FriendRelationship = {
  isFriend: boolean;
  friendRequestStatus: MapUserFriendRequestStatus;
  relationshipLabel: string;
};

type FriendUser = {
  id?: number | null;
};

type FriendshipDto = {
  id: number;
  friend?: FriendUser | null;
  requester?: FriendUser | null;
  addressee?: FriendUser | null;
};

const DEFAULT_RELATIONSHIP: FriendRelationship = {
  isFriend: false,
  friendRequestStatus: 'none',
  relationshipLabel: 'Не твій друг',
};

async function readJsonArray(response: Response) {
  const data = await response.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

function parseBackendBoolean(value: unknown) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function getFriendUserId(friendship: FriendshipDto) {
  const id = Number(friendship.friend?.id);
  return Number.isFinite(id) ? id : null;
}

function buildFriendRelationships(
  friends: FriendshipDto[],
  incomingRequests: FriendshipDto[],
  outgoingRequests: FriendshipDto[],
) {
  const relationships = new Map<number, FriendRelationship>();

  friends.forEach((friendship) => {
    const userId = getFriendUserId(friendship);
    if (userId === null) return;
    relationships.set(userId, {
      isFriend: true,
      friendRequestStatus: 'none',
      relationshipLabel: 'Твій друг',
    });
  });

  incomingRequests.forEach((friendship) => {
    const userId = getFriendUserId(friendship);
    if (userId === null || relationships.has(userId)) return;
    relationships.set(userId, {
      isFriend: false,
      friendRequestStatus: 'incoming',
      relationshipLabel: 'Заявка отримана',
    });
  });

  outgoingRequests.forEach((friendship) => {
    const userId = getFriendUserId(friendship);
    if (userId === null || relationships.has(userId)) return;
    relationships.set(userId, {
      isFriend: false,
      friendRequestStatus: 'outgoing',
      relationshipLabel: 'Заявка надіслана',
    });
  });

  return relationships;
}

function mergeBackendUserIntoMarker(marker: OnlineUserMarker, user: any): OnlineUserMarker {
  const isOnline = parseBackendBoolean(user?.isOnline);
  const latitude = Number(isOnline ? user?.latitude : user?.lastLatitude ?? user?.latitude);
  const longitude = Number(isOnline ? user?.longitude : user?.lastLongitude ?? user?.longitude);

  return {
    ...marker,
    latitude: Number.isFinite(latitude) ? latitude : marker.latitude,
    longitude: Number.isFinite(longitude) ? longitude : marker.longitude,
    photoUrl: typeof user?.photoUrl === 'string' ? user.photoUrl : marker.photoUrl,
    name: typeof user?.name === 'string' ? user.name : marker.name,
    isOnline,
    lastSeenAt: typeof user?.lastSeenAt === 'string' ? user.lastSeenAt : marker.lastSeenAt ?? null,
    birthDate: typeof user?.birthDate === 'string' ? user.birthDate : marker.birthDate ?? null,
    about: typeof user?.about === 'string' ? user.about : marker.about ?? null,
    statusEmoji: typeof user?.statusEmoji === 'string' ? user.statusEmoji : marker.statusEmoji ?? null,
    statusBody: typeof user?.statusBody === 'string' ? user.statusBody : marker.statusBody ?? null,
    rating: Number.isFinite(Number(user?.rating)) ? Number(user.rating) : marker.rating ?? null,
    meetsCount: Number.isFinite(Number(user?.meetsCount)) ? Number(user.meetsCount) : marker.meetsCount,
    friendsCount: Number.isFinite(Number(user?.friendsCount)) ? Number(user.friendsCount) : marker.friendsCount,
    interests: Array.isArray(user?.interests) ? user.interests : marker.interests,
    statusRelativeLabel:
      typeof user?.statusRelativeLabel === 'string' ? user.statusRelativeLabel : marker.statusRelativeLabel ?? null,
  };
}

export default function MapTabScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const mapTopFabIconColor = isDark ? AppColors.tabBarInactiveDarkMap : AppColors.tabBarInactiveLight;
  const insets = useSafeAreaInsets();
  const { phoneNumber } = useLocalSearchParams<{ phoneNumber?: string }>();
  const mapRef = useRef<MapView | null>(null);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userMapData, setUserMapData] = useState<UserMapData | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUserMarker[]>([]);
  const [fallbackCoords, setFallbackCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [errorText, setErrorText] = useState('');
  const [regionDelta, setRegionDelta] = useState(0.02);
  const [selectedUser, setSelectedUser] = useState<OnlineUserMarker | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sortFilterSheetVisible, setSortFilterSheetVisible] = useState(false);
  const [mapSortFilterKey, setMapSortFilterKey] = useState<MapSortFilterKey>('all');
  const [addingFriend, setAddingFriend] = useState(false);

  useEffect(() => {
    if (phoneNumber) {
      setSessionKey(phoneNumber);
      return;
    }

    getSession()
      .then((stored) => setSessionKey(stored))
      .catch(() => setSessionKey(null));
  }, [phoneNumber]);

  const loadDeviceLocation = useCallback(async () => {
    try {
      const Location = await import('expo-location');
      const existing = await Location.getForegroundPermissionsAsync();
      let status = existing.status;

      if (status !== 'granted') {
        const requested = await Location.requestForegroundPermissionsAsync();
        status = requested.status;
      }

      if (status !== 'granted') return null;

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
    } catch (error) {
      console.warn('[Map] Failed to read device location for fallback:', error);
      return null;
    }
  }, []);

  const loadCoordinates = useCallback(async () => {
    if (!sessionKey) {
      setErrorText('Не знайдено сесію користувача.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetchWithAuth(
        `${BASE_URL}/users/by-phone?phoneNumber=${encodeURIComponent(sessionKey)}`,
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message ?? 'Не вдалося завантажити профіль');
      }

      const latitude = Number(data?.latitude);
      const longitude = Number(data?.longitude);
      const photoUrl = typeof data?.photoUrl === 'string' ? data.photoUrl : null;
      const userId = Number.isFinite(Number(data?.id)) ? Number(data.id) : null;

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        setUserMapData(null);
        const currentCoords = await loadDeviceLocation();
        if (currentCoords) {
          setFallbackCoords(currentCoords);
          setErrorText('Координати профілю ще не збережені. Показуємо вашу поточну геолокацію.');
        } else {
          setFallbackCoords(null);
          setErrorText('Координати ще не збережені. Дозволь геолокацію на екрані Готово.');
        }
        return;
      }

      setUserMapData({ id: userId, latitude, longitude, photoUrl });
      setFallbackCoords(null);
      setErrorText('');
    } catch (error: any) {
      setUserMapData(null);
      const currentCoords = await loadDeviceLocation();
      if (currentCoords) {
        setFallbackCoords(currentCoords);
        setErrorText(error?.message ?? 'Показуємо поточну геолокацію через помилку завантаження профілю');
      } else {
        setFallbackCoords(null);
        setErrorText(error?.message ?? 'Помилка завантаження координат');
      }
    } finally {
      setLoading(false);
    }
  }, [loadDeviceLocation, sessionKey]);

  useEffect(() => {
    if (!sessionKey) return;
    void loadCoordinates();
  }, [sessionKey, loadCoordinates]);

  const loadOnlineUsers = useCallback(async () => {
    try {
      const [usersResponse, friendsResponse, incomingResponse, outgoingResponse] = await Promise.all([
        fetchWithAuth(`${BASE_URL}/users`),
        fetchWithAuth(`${BASE_URL}/friends`),
        fetchWithAuth(`${BASE_URL}/friends/requests/incoming`),
        fetchWithAuth(`${BASE_URL}/friends/requests/outgoing`),
      ]);

      const data = await usersResponse.json().catch(() => []);

      if (!usersResponse.ok || !Array.isArray(data)) {
        throw new Error('Не вдалося завантажити онлайн-користувачів');
      }

      const relationships = buildFriendRelationships(
        friendsResponse.ok ? await readJsonArray(friendsResponse) : [],
        incomingResponse.ok ? await readJsonArray(incomingResponse) : [],
        outgoingResponse.ok ? await readJsonArray(outgoingResponse) : [],
      );

      const online = data
        .map((item: any) => {
          const isOnline = parseBackendBoolean(item?.isOnline);
          const rawLatitude = isOnline ? item?.latitude : item?.lastLatitude ?? item?.latitude;
          const rawLongitude = isOnline ? item?.longitude : item?.lastLongitude ?? item?.longitude;
          const latitude = Number(rawLatitude);
          const longitude = Number(rawLongitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return null;
          }

          const userId = Number(item.id);
          const relationship = relationships.get(userId) ?? DEFAULT_RELATIONSHIP;

          return {
            id: userId,
            latitude,
            longitude,
            photoUrl: typeof item?.photoUrl === 'string' ? item.photoUrl : null,
            name: typeof item?.name === 'string' ? item.name : null,
            isOnline,
            lastSeenAt: typeof item?.lastSeenAt === 'string' ? item.lastSeenAt : null,
            birthDate: typeof item?.birthDate === 'string' ? item.birthDate : null,
            about: typeof item?.about === 'string' ? item.about : null,
            statusEmoji: typeof item?.statusEmoji === 'string' ? item.statusEmoji : null,
            statusBody: typeof item?.statusBody === 'string' ? item.statusBody : null,
            rating: Number.isFinite(Number(item?.rating)) ? Number(item.rating) : null,
            meetsCount: Number.isFinite(Number(item?.meetsCount)) ? Number(item.meetsCount) : undefined,
            friendsCount: Number.isFinite(Number(item?.friendsCount)) ? Number(item.friendsCount) : undefined,
            interests: Array.isArray(item?.interests) ? item.interests : undefined,
            isFriend: relationship.isFriend,
            friendRequestStatus: relationship.friendRequestStatus,
            relationshipLabel: relationship.relationshipLabel,
            statusRelativeLabel:
              typeof item?.statusRelativeLabel === 'string' ? item.statusRelativeLabel : null,
          } as OnlineUserMarker;
        })
        .filter((item: OnlineUserMarker | null): item is OnlineUserMarker => Boolean(item));

      setOnlineUsers(online);
    } catch (error) {
      console.warn('[Map] Failed to load online users:', error);
    }
  }, []);

  useEffect(() => {
    if (!sessionKey) return;

    void loadOnlineUsers();
    const timer = setInterval(() => {
      void loadOnlineUsers();
    }, 8000);

    return () => {
      clearInterval(timer);
    };
  }, [loadOnlineUsers, sessionKey]);

  const markerCoords = useMemo(() => {
    if (userMapData) {
      return { latitude: userMapData.latitude, longitude: userMapData.longitude };
    }
    return fallbackCoords;
  }, [fallbackCoords, userMapData]);

  const allVisibleMarkers = useMemo(() => {
    const interestFilterName = getInterestNameByFilterKey(mapSortFilterKey);
    const markers = onlineUsers.filter((marker) => {
      if (!interestFilterName) return true;
      const interests = marker.interests ?? [];
      return interests.some(({ interest }) => interest.name === interestFilterName);
    });

    if (markerCoords && !markers.some((m) => m.id === userMapData?.id)) {
      markers.push({
        id: -1,
        latitude: markerCoords.latitude,
        longitude: markerCoords.longitude,
        photoUrl: userMapData?.photoUrl ?? null,
        name: 'Ви',
      });
    }

    return markers;
  }, [mapSortFilterKey, markerCoords, onlineUsers, userMapData?.id, userMapData?.photoUrl]);

  const initialRegion = useMemo(() => {
    if (markerCoords) {
      return {
        latitude: markerCoords.latitude,
        longitude: markerCoords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }

    return {
      latitude: 50.4501,
      longitude: 30.5234,
      latitudeDelta: 0.15,
      longitudeDelta: 0.15,
    };
  }, [markerCoords]);

  useEffect(() => {
    if (!markerCoords || !mapRef.current) return;

    mapRef.current.animateToRegion(
      {
        latitude: markerCoords.latitude,
        longitude: markerCoords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      600,
    );
  }, [markerCoords]);

  const showDotMarker = regionDelta >= 0.01;

  const handleRegionChangeComplete = (region: Region) => {
    setRegionDelta(region.latitudeDelta);
  };

  const closeSheet = useCallback(() => {
    setSheetVisible(false);
    setSelectedUser(null);
    setAddingFriend(false);
  }, []);

  const sheetProfile = useMemo(() => {
    if (!selectedUser) return null;
    return buildMapUserProfileSheetFromMarker(selectedUser, BASE_URL);
  }, [selectedUser]);

  const onPressChat = useCallback(() => {
    if (!selectedUser) return;
    closeSheet();

    void openChatWithParticipant(Number(selectedUser.id)).catch((e: unknown) => {
      const message = e instanceof Error ? e.message : 'Не вдалося відкрити чат';
      Alert.alert('Помилка', message);
    });
  }, [closeSheet, selectedUser]);

  const onPressAddFriend = useCallback(() => {
    console.log('[Map] Add friend pressed:', { selectedUser });

    if (!selectedUser) {
      console.log('[Map] Add friend skipped: no selected user');
      return;
    }

    if (selectedUser.friendRequestStatus && selectedUser.friendRequestStatus !== 'none') {
      console.log('[Map] Add friend skipped: request already has state', {
        userId: selectedUser.id,
        friendRequestStatus: selectedUser.friendRequestStatus,
      });
      return;
    }

    const addresseeId = selectedUser.id;
    setAddingFriend(true);

    console.log('[Map] Add friend request started:', {
      url: `${BASE_URL}/friends/requests`,
      body: { addresseeId },
    });

    fetchWithAuth(`${BASE_URL}/friends/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresseeId }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        console.log('[Map] Add friend response received:', {
          status: response.status,
          ok: response.ok,
          data,
        });

        if (!response.ok) {
          throw new Error(data?.message ?? 'Не вдалося надіслати заявку в друзі');
        }

        const nextRelationship: FriendRelationship = {
          isFriend: false,
          friendRequestStatus: 'outgoing',
          relationshipLabel: 'Заявка надіслана',
        };

        setOnlineUsers((current) =>
          current.map((user) => (user.id === addresseeId ? { ...user, ...nextRelationship } : user)),
        );
        setSelectedUser((current) => (current?.id === addresseeId ? { ...current, ...nextRelationship } : current));
        console.log('[Map] Add friend UI updated:', {
          addresseeId,
          nextRelationship,
        });
        Alert.alert('Заявку надіслано', 'Користувач побачить вашу заявку в друзі.');
      })
      .catch((error: any) => {
        console.warn('[Map] Add friend failed:', {
          addresseeId,
          message: error?.message,
          error,
        });
        Alert.alert('Не вдалося додати в друзі', error?.message ?? 'Спробуйте ще раз пізніше.');
      })
      .finally(() => {
        console.log('[Map] Add friend request finished:', { addresseeId });
        setAddingFriend(false);
      });
  }, [selectedUser]);

  const onPressSendLocation = useCallback(() => {
    if (!selectedUser) return;
    closeSheet();

    void openChatWithParticipant(Number(selectedUser.id)).catch((e: unknown) => {
      const message = e instanceof Error ? e.message : 'Не вдалося відкрити чат';
      Alert.alert('Помилка', message);
    });
  }, [closeSheet, selectedUser]);

  const openSortFilterSheet = useCallback(() => {
    setSheetVisible(false);
    setSelectedUser(null);
    setSortFilterSheetVisible(true);
  }, []);

  const closeSortFilterSheet = useCallback(() => {
    setSortFilterSheetVisible(false);
  }, []);

  const onPressMapNotifications = useCallback(() => {
    router.push('/notifications');
  }, []);

  const handleMarkerPress = useCallback(
    (marker: OnlineUserMarker) => {
      if (marker.id === -1) return;
      if (marker.id === userMapData?.id) return;

      setSortFilterSheetVisible(false);

      console.log('[Map] User marker pressed:', {
        marker,
        sheetProfile: buildMapUserProfileSheetFromMarker(marker, BASE_URL),
      });

      setSelectedUser(marker);
      setSheetVisible(true);

      fetchWithAuth(`${BASE_URL}/users/${marker.id}`)
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data?.message ?? 'Не вдалося завантажити користувача');
          }

          const detailedMarker = mergeBackendUserIntoMarker(marker, data);
          console.log('[Map] User details loaded:', {
            user: data,
            marker: detailedMarker,
            sheetProfile: buildMapUserProfileSheetFromMarker(detailedMarker, BASE_URL),
          });

          setSelectedUser((current) => (current?.id === marker.id ? detailedMarker : current));
          setOnlineUsers((current) => current.map((user) => (user.id === marker.id ? detailedMarker : user)));
        })
        .catch((error) => {
          console.warn('[Map] Failed to load user details:', error);
        });
    },
    [userMapData?.id],
  );

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <MapView
        ref={(ref) => {
          mapRef.current = ref;
        }}
        style={styles.map}
        initialRegion={initialRegion}
        onRegionChangeComplete={handleRegionChangeComplete}
        userInterfaceStyle={Platform.OS === 'ios' ? (isDark ? 'dark' : 'light') : undefined}
      >
        {allVisibleMarkers.map((marker) => {
          const markerImageUri = marker.photoUrl ? `${BASE_URL}${marker.photoUrl}` : null;
          return (
          <Marker
            key={`user-marker-${marker.id}-${showDotMarker ? 'dot' : 'avatar'}`}
            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
            tracksViewChanges
            onPress={() => handleMarkerPress(marker)}
          >
            {showDotMarker ? (
              <View style={styles.dotWrap}>
                <View style={styles.dotCore} />
              </View>
            ) : (
              <View style={styles.markerWrap}>
                <View style={styles.avatarRingOnline}>
                  {markerImageUri ? (
                    <Image source={{ uri: markerImageUri }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarFallbackText}>🙂</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </Marker>
          );
        })}
      </MapView>

      <View style={[styles.mapTopBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable
          onPress={openSortFilterSheet}
          style={({ pressed }) => [
            styles.mapTopFab,
            isDark && styles.mapTopFabDark,
            pressed && styles.mapTopFabPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Сортування за статусами та інтересами"
        >
          <Ionicons name="options-outline" size={24} color={mapTopFabIconColor} />
        </Pressable>
        <Pressable
          onPress={onPressMapNotifications}
          style={({ pressed }) => [
            styles.mapTopFab,
            isDark && styles.mapTopFabDark,
            pressed && styles.mapTopFabPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Сповіщення"
        >
          <Ionicons name="notifications-outline" size={24} color={mapTopFabIconColor} />
        </Pressable>
      </View>

      {!!errorText && !loading && (
        <View style={[styles.floatingInfo, { top: insets.top + 64 }]}>
          <Text style={styles.floatingInfoText}>{errorText}</Text>
        </View>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#C88CEB" />
        </View>
      )}

      <MapUserProfileBottomSheet
        visible={sheetVisible}
        onClose={closeSheet}
        profile={sheetProfile}
        bottomInset={insets.bottom}
        onPressMessage={onPressChat}
        onPressAddFriend={onPressAddFriend}
        onPressSendLocation={onPressSendLocation}
        addingFriend={addingFriend}
      />

      <MapSortFilterBottomSheet
        visible={sortFilterSheetVisible}
        onClose={closeSortFilterSheet}
        bottomInset={insets.bottom}
        selectedKey={mapSortFilterKey}
        onSelectKey={setMapSortFilterKey}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#1C1C1E',
  },
  map: {
    flex: 1,
  },
  mapTopBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 40,
  },
  mapTopFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
    borderWidth: 1,
    borderColor: '#E7D2F4',
  },
  mapTopFabDark: {
    backgroundColor: 'rgba(38, 38, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(200, 140, 235, 0.42)',
  },
  mapTopFabPressed: {
    opacity: 0.88,
  },
  floatingInfo: {
    position: 'absolute',
    left: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  floatingInfoText: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#6A8298',
  },
  markerWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
    borderColor: '#D49BF5',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  avatarRingOnline: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
    borderColor: '#121212',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#CFE4FF',
  },
  avatarFallbackText: {
    fontSize: 22,
  },
  dotWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 155, 245, 0.28)',
  },
  dotCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#C88CEB',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
});
