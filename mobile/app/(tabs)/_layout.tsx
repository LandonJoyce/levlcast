import { Tabs } from 'expo-router';
import { CircleUser, Film, House, Scissors, Swords } from 'lucide-react-native';
import { colors } from '@/lib/theme';

/** The site's top bar as tabs: Home, Streams, Clips, Matches, Account. */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.line,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.ink4,
        tabBarLabelStyle: { fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <House color={color} size={size - 2} strokeWidth={1.8} /> }}
      />
      <Tabs.Screen
        name="vods"
        options={{ title: 'Streams', tabBarIcon: ({ color, size }) => <Film color={color} size={size - 2} strokeWidth={1.8} /> }}
      />
      <Tabs.Screen
        name="clips"
        options={{ title: 'Clips', tabBarIcon: ({ color, size }) => <Scissors color={color} size={size - 2} strokeWidth={1.8} /> }}
      />
      <Tabs.Screen
        name="matches"
        options={{ title: 'Matches', tabBarIcon: ({ color, size }) => <Swords color={color} size={size - 2} strokeWidth={1.8} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Account', tabBarIcon: ({ color, size }) => <CircleUser color={color} size={size - 2} strokeWidth={1.8} /> }}
      />
    </Tabs>
  );
}
