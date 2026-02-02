import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const isDriver = user?.role === 'DRIVER';

  const { data: overview, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => api.get('/dashboard/overview'),
  });

  const stats = overview?.data || {};

  const StatCard = ({ title, value, emoji }: { title: string; value: string | number; emoji: string }) => (
    <View style={styles.statCard}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Ciao, {user?.firstName}!</Text>
        <Text style={styles.role}>{user?.role}</Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard title="Ordini Oggi" value={stats.todayOrders || 0} emoji="📋" />
        <StatCard title="In Attesa" value={stats.pendingOrders || 0} emoji="⏳" />
        <StatCard title="Fatturato Oggi" value={`€${Number(stats.todayRevenue || 0).toFixed(0)}`} emoji="💰" />
        <StatCard title="Scorte Basse" value={stats.lowStockCount || 0} emoji="⚠️" />
      </View>

      {!isDriver && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Azioni Rapide</Text>
          <View style={styles.actionsGrid}>
            <View style={styles.actionCard}>
              <Text style={styles.actionEmoji}>📷</Text>
              <Text style={styles.actionText}>Scansiona Prodotto</Text>
            </View>
            <View style={styles.actionCard}>
              <Text style={styles.actionEmoji}>➕</Text>
              <Text style={styles.actionText}>Nuovo Ordine</Text>
            </View>
            <View style={styles.actionCard}>
              <Text style={styles.actionEmoji}>📦</Text>
              <Text style={styles.actionText}>Carica Merce</Text>
            </View>
            <View style={styles.actionCard}>
              <Text style={styles.actionEmoji}>📊</Text>
              <Text style={styles.actionText}>Report</Text>
            </View>
          </View>
        </View>
      )}

      {isDriver && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Le tue consegne</Text>
          <View style={styles.deliveryCard}>
            <Text style={styles.deliveryEmoji}>🚚</Text>
            <Text style={styles.deliveryText}>Vai alla sezione Consegne per vedere i tuoi ordini da consegnare</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 20,
    backgroundColor: '#0ea5e9',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  role: {
    fontSize: 14,
    color: '#e0f2fe',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  statTitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },
  deliveryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  deliveryEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  deliveryText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});
