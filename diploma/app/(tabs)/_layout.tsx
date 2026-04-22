import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';

const ACTIVE = '#C88CEB';
const INACTIVE = '#D8BEEB';

function CircleIcon({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.circleBase, focused ? styles.circleActive : styles.circleInactive]}>
      {children}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 18,
          height: 78,
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: {
          paddingHorizontal: 2,
        },
      }}
    >
      <Tabs.Screen
        name="people"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <CircleIcon focused={focused}>
              <MaterialCommunityIcons name={focused ? 'account-group' : 'account-group-outline'} size={26} color={focused ? '#FFFFFF' : color} />
            </CircleIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <CircleIcon focused={focused}>
              <Ionicons name={focused ? 'chatbubble' : 'chatbubble-outline'} size={24} color={focused ? '#FFFFFF' : color} />
            </CircleIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <CircleIcon focused={focused}>
              <Ionicons name={focused ? 'map' : 'map-outline'} size={24} color={focused ? '#FFFFFF' : color} />
            </CircleIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <CircleIcon focused={focused}>
              <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={focused ? '#FFFFFF' : color} />
            </CircleIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <CircleIcon focused={focused}>
              <Ionicons name="options-outline" size={24} color={focused ? '#FFFFFF' : color} />
            </CircleIcon>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  circleBase: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
    borderWidth: 1,
    borderColor: '#E7D2F4',
  },
  circleActive: {
    backgroundColor: ACTIVE,
    borderWidth: 1,
    borderColor: ACTIVE,
  },
});
