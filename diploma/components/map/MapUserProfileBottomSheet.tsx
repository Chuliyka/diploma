import { AppButton } from '@/components/ui/app-button';
import { AppColors } from '@/constants/app-colors';
import type { MapUserProfileSheetDto } from '@/types/map-user-profile-sheet';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

export type MapUserProfileBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  profile: MapUserProfileSheetDto | null;
  bottomInset: number;
  onPressMessage: () => void;
  onPressAddFriend: () => void;
  onPressSendLocation: () => void;
  addingFriend?: boolean;
  loading?: boolean;
};

function getFriendActionTitle(profile: MapUserProfileSheetDto): string {
  if (profile.isFriend) return 'Повідомлення';
  if (profile.friendRequestStatus === 'outgoing') return 'Заявка надіслана';
  if (profile.friendRequestStatus === 'incoming') return 'Заявка отримана';
  return 'Додати в друзі';
}

function shouldShowRelationshipPill(profile: MapUserProfileSheetDto): boolean {
  return profile.isFriend || profile.friendRequestStatus !== 'none';
}

function formatRatingUk(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

export function MapUserProfileBottomSheet({
  visible,
  onClose,
  profile,
  bottomInset,
  onPressMessage,
  onPressAddFriend,
  onPressSendLocation,
  addingFriend = false,
}: MapUserProfileBottomSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(windowHeight * 0.7);
  const [contentScrollable, setContentScrollable] = useState(false);
  const scrollContentHeightRef = useRef(0);
  const scrollViewportHeightRef = useRef(0);

  const updateContentScrollable = useCallback(() => {
    const { current: ch } = scrollContentHeightRef;
    const { current: vh } = scrollViewportHeightRef;
    if (vh <= 0 || ch <= 0) {
      setContentScrollable(false);
      return;
    }
    setContentScrollable(ch > vh + 2);
  }, []);

  const onScrollViewportLayout = useCallback(
    (e: LayoutChangeEvent) => {
      scrollViewportHeightRef.current = Math.round(e.nativeEvent.layout.height);
      updateContentScrollable();
    },
    [updateContentScrollable],
  );

  const onSheetContentSizeChange = useCallback(
    (_w: number, h: number) => {
      if (h <= 0) return;
      scrollContentHeightRef.current = h;
      updateContentScrollable();
    },
    [updateContentScrollable],
  );

  useEffect(() => {
    if (!visible) {
      scrollContentHeightRef.current = 0;
      scrollViewportHeightRef.current = 0;
      setContentScrollable(false);
    }
  }, [visible]);

  useEffect(() => {
    scrollContentHeightRef.current = 0;
    scrollViewportHeightRef.current = 0;
    setContentScrollable(false);
  }, [profile?.id]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />

        <View style={[styles.sheetShell, { height: sheetHeight }]}>
          {profile ? (
            <>
              <View style={styles.avatarFloatingSlot} pointerEvents="box-none">
                <View style={styles.avatarOverlapWrap}>
                  <View style={styles.avatarRingPurple}>
                    <View style={styles.avatarRingWhite}>
                      {profile.photoUri ? (
                        <Image source={{ uri: profile.photoUri }} style={styles.avatarInner} />
                      ) : (
                        <View style={[styles.avatarInner, styles.avatarPlaceholder]}>
                          <Text style={styles.avatarPlaceholderText}>🙂</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              <View style={[styles.sheetBodyColumn, { height: sheetHeight }]}>
                <ScrollView
                  style={styles.sheetScrollArea}
                  contentContainerStyle={[
                    styles.scrollContent,
                    {
                      paddingBottom: 16,
                      paddingHorizontal: 20,
                    },
                  ]}
                  onLayout={onScrollViewportLayout}
                  onContentSizeChange={onSheetContentSizeChange}
                  showsVerticalScrollIndicator={contentScrollable}
                  bounces={false}
                  alwaysBounceVertical={false}
                  overScrollMode="never"
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.handle} />

                  <View style={styles.topBlock} pointerEvents="box-none">
                    <View style={styles.ratingBlock}>
                      <Text style={styles.star}>★</Text>
                      <Text style={styles.ratingValue}>{formatRatingUk(profile.rating)}</Text>
                    </View>
                    <View style={styles.avatarScrollSpacer} />
                  </View>

                  <Text style={styles.statusLine} numberOfLines={2}>
                    {`${profile.statusEmoji?.trim() || ''} ${profile.statusLine}`.trim()}
                  </Text>

                  <Text style={styles.name}>
                    {profile.displayName}
                    {profile.age !== null ? `, ${profile.age}` : ''}
                  </Text>

                  <View style={styles.badgesRow}>
                    {shouldShowRelationshipPill(profile) ? (
                      <View style={styles.friendPill}>
                        <Text style={styles.friendPillText}>{profile.relationshipLabel}</Text>
                      </View>
                    ) : null}
                    <View style={[styles.timePill, profile.isOnline && styles.onlinePill]}>
                      <Text style={styles.timePillText}>{profile.lastSeenLabel}</Text>
                    </View>
                  </View>

                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{profile.meetsCount}</Text>
                      <Text style={styles.statLabel}>зустрічі</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{profile.friendsCount}</Text>
                      <Text style={styles.statLabel}>друг</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{profile.interests.length}</Text>
                      <Text style={styles.statLabel}>інтереси</Text>
                    </View>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Про себе</Text>
                    <Text style={styles.sectionBody}>{profile.about}</Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Інтереси</Text>
                    {profile.interests.length > 0 ? (
                      <View style={styles.tagsRow}>
                        {profile.interests.map((interest) => (
                          <View style={styles.tag} key={interest.id}>
                            <Text style={styles.tagText}>{interest.name}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.interestsEmpty}>Ще немає інтересів</Text>
                    )}
                  </View>
                </ScrollView>

                <View
                  style={[
                    styles.actionsFooter,
                    {
                      paddingBottom: bottomInset,
                      paddingHorizontal: 20,
                    },
                  ]}
                >
                  <View style={styles.actionsRow}>
                    <View style={styles.actionBtnWrap}>
                      <AppButton
                        variant="outline"
                        shape="pill"
                        title={getFriendActionTitle(profile)}
                        onPress={profile.isFriend ? onPressMessage : onPressAddFriend}
                        disabled={!profile.isFriend && profile.friendRequestStatus !== 'none'}
                        loading={!profile.isFriend && addingFriend}
                      />
                    </View>
                    <View style={styles.actionBtnWrapLast}>
                      <AppButton
                        variant="primary"
                        shape="pill"
                        title="Надіслати локацію"
                        onPress={onPressSendLocation}
                        style={{ backgroundColor: AppColors.mapSheetSendLocationButton }}
                      />
                    </View>
                  </View>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetShell: {
    width: '100%',
    alignSelf: 'stretch',
    position: 'relative',
    overflow: 'visible',
  },
  avatarFloatingSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -52,
    zIndex: 20,
    elevation: 12,
    alignItems: 'center',
  },
  sheetBodyColumn: {
    alignSelf: 'stretch',
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetScrollArea: {
    flex: 1,
    minHeight: 0,
    alignSelf: 'stretch',
  },
  actionsFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E9F0',
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 64,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E4E9F0',
    marginBottom: 6,
  },
  scrollContent: {
    flexGrow: 0,
    paddingTop: 2,
  },
  topBlock: {
    position: 'relative',
    minHeight: 30,
    marginBottom: 4,
  },
  avatarScrollSpacer: {
    height: 6,
  },
  ratingBlock: {
    position: 'absolute',
    left: 0,
    top: 8,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  star: {
    color: '#FBBF24',
    fontSize: 16,
  },
  ratingValue: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '700',
    color: '#173753',
  },
  avatarOverlapWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRingPurple: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarRingWhite: {
    width: 114,
    height: 114,
    borderRadius: 57,
    backgroundColor: AppColors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInner: {
    width: 108,
    height: 108,
    borderRadius: 54,
  },
  avatarPlaceholder: {
    backgroundColor: AppColors.tagBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 34,
    fontWeight: '700',
    color: AppColors.primary,
  },
  statusLine: {
    marginTop: 10,
    paddingHorizontal: 16,
    alignSelf: 'stretch',
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
    color: '#5B7C5F',
    textAlign: 'center',
    lineHeight: 20,
  },
  name: {
    fontFamily: 'Space Grotesk',
    fontSize: 26,
    fontWeight: '700',
    color: '#19395A',
    textAlign: 'center',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  friendPill: {
    backgroundColor: '#22C55E',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  friendPillText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  timePill: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#E8EAEF',
  },
  onlinePill: {
    backgroundColor: '#DCFCE7',
  },
  timePillText: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '500',
    color: '#173753',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontFamily: 'Space Grotesk',
    fontSize: 28,
    fontWeight: '700',
    color: '#19395A',
  },
  statLabel: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '500',
    color: '#6A8298',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E4E9F0',
  },
  section: {
    marginTop: 18,
  },
  sectionTitle: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '700',
    color: '#19395A',
    marginBottom: 8,
  },
  sectionBody: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '500',
    color: '#25496E',
    lineHeight: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E4E9F0',
    marginTop: 18,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tag: {
    backgroundColor: '#9D8DF1',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tagText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  interestsEmpty: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '500',
    color: '#6A8298',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtnWrap: {
    flex: 1,
    marginRight: 10,
  },
  actionBtnWrapLast: {
    flex: 1,
  },
});
