import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

const statusColors: Record<string, string> = {
  PENDING: '#f59e0b',
  CONFIRMED: '#3b82f6',
  PROCESSING: '#8b5cf6',
  READY: '#10b981',
  OUT_FOR_DELIVERY: '#06b6d4',
  DELIVERED: '#6b7280',
  CANCELLED: '#ef4444',
};

const statusLabels: Record<string, string> = {
  PENDING: 'In Attesa',
  CONFIRMED: 'Confermato',
  PROCESSING: 'Preparazione',
  READY: 'Pronto',
  OUT_FOR_DELIVERY: 'In Consegna',
  DELIVERED: 'Consegnato',
  CANCELLED: 'Annullato',
};

export default function OrdersScreen() {
  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get('/orders'),
  });

  const renderOrder = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderNumber}>{item.orderNumber}</Text>
        <View style={[styles.badge, { backgroundColor: statusColors[item.status] + '20' }]}>
          <Text style={[styles.badgeText, { color: statusColors[item.status] }]}>
            {statusLabels[item.status] || item.status}
          </Text>
        </View>
      </View>

      <Text style={styles.customerName}>
        {item.customer?.firstName} {item.customer?.lastName}
      </Text>

      <View style={styles.orderDetails}>
        <Text style={styles.detailText}>
          {item.items?.length || 0} prodotti
        </Text>
        <Text style={styles.orderTotal}>€{Number(item.total).toFixed(2)}</Text>
      </View>

      <View style={styles.orderFooter}>
        <Text style={styles.sourceText}>{item.source}</Text>
        <Text style={styles.dateText}>
          {new Date(item.createdAt).toLocaleDateString('it-IT')}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={orders?.data?.data || []}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyText}>Nessun ordine</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  list: { padding: 16, gap: 12 },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderNumber: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  customerName: { fontSize: 14, color: '#64748b', marginBottom: 12 },
  orderDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailText: { fontSize: 14, color: '#64748b' },
  orderTotal: { fontSize: 18, fontWeight: 'bold', color: '#0ea5e9' },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  sourceText: { fontSize: 12, color: '#94a3b8' },
  dateText: { fontSize: 12, color: '#94a3b8' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#64748b' },
});
