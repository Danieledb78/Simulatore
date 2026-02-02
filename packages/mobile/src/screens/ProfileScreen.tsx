import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuthStore } from '../store/authStore';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Conferma',
      'Vuoi uscire dall\'app?',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Esci', style: 'destructive', onPress: logout },
      ]
    );
  };

  const getRoleName = (role: string) => {
    const roles: Record<string, string> = {
      SUPER_ADMIN: 'Super Admin',
      ADMIN: 'Amministratore',
      WAREHOUSE_MANAGER: 'Responsabile Magazzino',
      DRIVER: 'Driver',
    };
    return roles[role] || role;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </Text>
        </View>
        <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{getRoleName(user?.role || '')}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuIcon}>👤</Text>
          <Text style={styles.menuText}>Modifica Profilo</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuIcon}>🔒</Text>
          <Text style={styles.menuText}>Cambia Password</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuIcon}>🔔</Text>
          <Text style={styles.menuText}>Notifiche</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuIcon}>ℹ️</Text>
          <Text style={styles.menuText}>Informazioni</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuIcon}>📞</Text>
          <Text style={styles.menuText}>Supporto</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Esci</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Versione 1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { backgroundColor: '#0ea5e9', padding: 32, alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: 'bold', color: '#0ea5e9' },
  name: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  email: { fontSize: 14, color: '#e0f2fe', marginTop: 4 },
  roleBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginTop: 12 },
  roleText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  section: { backgroundColor: '#fff', marginTop: 20, marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#94a3b8', padding: 16, paddingBottom: 8, textTransform: 'uppercase' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuIcon: { fontSize: 20, marginRight: 16 },
  menuText: { flex: 1, fontSize: 16, color: '#1e293b' },
  menuArrow: { fontSize: 20, color: '#94a3b8' },
  logoutButton: { backgroundColor: '#fee2e2', margin: 16, padding: 16, borderRadius: 12, alignItems: 'center' },
  logoutText: { color: '#dc2626', fontSize: 16, fontWeight: '600' },
  version: { textAlign: 'center', color: '#94a3b8', fontSize: 12, marginBottom: 32 },
});
