import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL } from '@/constants/api';
import { MapUserProfileBottomSheet } from '@/components/map/MapUserProfileBottomSheet';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import { buildMapUserProfileSheetFromMarker } from '@/utils/mapUserProfileSheet';
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
  birthDate?: string | null;
  about?: string | null;
  statusEmoji?: string | null;
  statusBody?: string | null;
  rating?: number | null;
  meetsCount?: number;
  friendsCount?: number;
  interests?: { interest: { id: number; name: string } }[];
  statusRelativeLabel?: string | null;
};

export default function MapTabScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
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
      const response = await fetchWithAuth(`${BASE_URL}/users`);
      const data = await response.json().catch(() => []);

      if (!response.ok || !Array.isArray(data)) {
        throw new Error('Не вдалося завантажити онлайн-користувачів');
      }

      const online = data
        .filter((item: any) => item?.isOnline)
        .map((item: any) => {
          const latitude = Number(item?.latitude);
          const longitude = Number(item?.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return null;
          }

          return {
            id: Number(item.id),
            latitude,
            longitude,
            photoUrl: typeof item?.photoUrl === 'string' ? item.photoUrl : null,
            name: typeof item?.name === 'string' ? item.name : null,
            birthDate: typeof item?.birthDate === 'string' ? item.birthDate : null,
            about: typeof item?.about === 'string' ? item.about : null,
            statusEmoji: typeof item?.statusEmoji === 'string' ? item.statusEmoji : null,
            statusBody: typeof item?.statusBody === 'string' ? item.statusBody : null,
            rating: Number.isFinite(Number(item?.rating)) ? Number(item.rating) : null,
            meetsCount: Number.isFinite(Number(item?.meetsCount)) ? Number(item.meetsCount) : undefined,
            friendsCount: Number.isFinite(Number(item?.friendsCount)) ? Number(item.friendsCount) : undefined,
            interests: Array.isArray(item?.interests) ? item.interests : undefined,
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
    const markers = [...onlineUsers];

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
  }, [markerCoords, onlineUsers, userMapData?.id, userMapData?.photoUrl]);

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
  }, []);

  const sheetProfile = useMemo(() => {
    if (!selectedUser) return null;
    return buildMapUserProfileSheetFromMarker(selectedUser, BASE_URL);
  }, [selectedUser]);

  const onPressChat = useCallback(() => {
    if (!selectedUser) return;
    closeSheet();

    // TODO: замінити conversationId на реальний з інтеграції чату
    router.push({
      pathname: '/chat/[conversationId]',
      params: { conversationId: String(selectedUser.id) },
    });
  }, [closeSheet, selectedUser]);

  const onPressSendLocation = useCallback(() => {
    if (!selectedUser) return;
    closeSheet();

    // TODO: інтеграція надсилання локації з мапи в тред чату
    router.push({
      pathname: '/chat/[conversationId]',
      params: { conversationId: String(selectedUser.id), action: 'send_location' },
    });
  }, [closeSheet, selectedUser]);

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
            onPress={() => {
              // Відкриваємо bottom-sheet тільки для інших користувачів
              if (marker.id === -1) return;
              if (marker.id === userMapData?.id) return;
              setSelectedUser(marker);
              setSheetVisible(true);
            }}
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

      {!!errorText && !loading && (
        <View style={[styles.floatingInfo, { top: insets.top + 12 }]}>
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
        onPressSendLocation={onPressSendLocation}
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
