import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useWallet } from '@/contexts/WalletContext';

export default function SettingsScreen() {
  const { logout } = useWallet();

  const handleLogout = async () => {
    await logout();
    router.replace('/onboarding/welcome');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Settings</Text>
        
        <View style={styles.section}>
          <TouchableOpacity style={styles.settingItem}>
            <IconSymbol name="person.fill" size={24} color="#8B5CF6" />
            <Text style={styles.settingText}>Profile</Text>
            <IconSymbol name="chevron.right" size={16} color="#A0A0A0" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem}>
            <IconSymbol name="bell.fill" size={24} color="#8B5CF6" />
            <Text style={styles.settingText}>Notifications</Text>
            <IconSymbol name="chevron.right" size={16} color="#A0A0A0" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem}>
            <IconSymbol name="shield.fill" size={24} color="#8B5CF6" />
            <Text style={styles.settingText}>Security</Text>
            <IconSymbol name="chevron.right" size={16} color="#A0A0A0" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push('/settings/smart-watch')}
          >
            <IconSymbol name="applewatch" size={24} color="#8B5CF6" />
            <Text style={styles.settingText}>Smart Watch Connection</Text>
            <IconSymbol name="chevron.right" size={16} color="#A0A0A0" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem}>
            <IconSymbol name="questionmark.circle.fill" size={24} color="#8B5CF6" />
            <Text style={styles.settingText}>Help & Support</Text>
            <IconSymbol name="chevron.right" size={16} color="#A0A0A0" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>EntryPoint</Text>
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push('/settings/entry-point')}
          >
            <IconSymbol name="link.circle.fill" size={24} color="#8B5CF6" />
            <Text style={styles.settingText}>Prefund & Deposits</Text>
            <IconSymbol name="chevron.right" size={16} color="#A0A0A0" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <IconSymbol name="rectangle.portrait.and.arrow.right" size={24} color="#EF4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 32,
  },
  section: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    marginBottom: 32,
  },
  sectionHeading: {
    fontSize: 13,
    color: '#A0A0A0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    gap: 16,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EF4444',
    gap: 12,
  },
  logoutText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '600',
  },
});
