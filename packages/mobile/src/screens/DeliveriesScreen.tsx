import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Linking, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function DeliveriesScreen() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['driver-orders', user?.driverId],
    queryFn: () => api.get(`/orders/driver/${user?.driverId}`),
    enabled: !!user?.driverId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-orders'] });
    },
  });

  const openMaps = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    Linking.openURL(url);
  };

  const handleDelivered = (orderId: string) => {
    Alert.alert(
      'Conferma Consegna',
      'Confermi che l\'ordine è stato consegnato?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Conferma',
          onPress: () => updateStatusMutation.mutate({ id: orderId, status: 'DELIVERED' }),
        },
      ]
    );
  };

  const renderDelivery = ({ item }: { item: any }) => (
    <View style={styles.deliveryCard}>
      <View style={styles.header}>
        <Text style={styles.orderNumber}>{item.orderNumber}</Text>
        <View style={[styles.badge, { backgroundColor: item.status === 'READY' ? '#10b981' : '#06b6d4' }]}>
          <Text style={styles.badgeText}>
            {item.status === 'READY' ? 'Da Consegnare' : 'In Consegna'}
          </Text>
        </View>
      </View>

      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>
          {item.customer?.firstName} {item.customer?.lastName}
        </Text>
        <Text style={styles.phone}>{item.customer?.phone}</Text>
      </View>

      <TouchableOpacity
        style={styles.addressCard}
        onPress={() => openMaps(item.deliveryAddress)}
      >
        <Text style={styles.addressIcon}>📍</Text>
        <View style={styles.addressContent}>
          <Text style={styles.addressText}>{item.deliveryAddress}</Text>
          <Text style={styles.mapLink}>Apri in Maps</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.itemsList}>
        <Text style={styles.itemsTitle}>Prodotti:</Text>
        {item.items?.slice(0, 3).map((orderItem: any, index: number) => (
          <Text key={index} style={styles.itemText}>
            • {orderItem.quantity}x {orderItem.product?.name}
          </Text>
        ))}
        {item.items?.length > 3 && (
          <Text style={styles.moreItems}>+{item.items.length - 3} altri...</Text>
        )}
      </View>

      <View style={styles.actions}>
        {item.status === 'READY' && (
          <TouchableOpacity
            style={styles.buttonPrimary}
            onPress={() => updateStatusMutation.mutate({ id: item.id, status: 'OUT_FOR_DELIVERY' })}
          >
            <Text style={styles.buttonPrimaryText}>🚚 Inizia Consegna</Text>
          </TouchableOpacity>
        )}
        {item.status === 'OUT_FOR_DELIVERY' && (
          <TouchableOpacity
            style={styles.buttonSuccess}
            onPress={() => handleDelivered(item.id)}
          >
            <Text style={styles.buttonSuccessText}>✅ Consegnato</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.buttonSecondary}
          onPress={() => Linking.openURL(`tel:${item.customer?.phone}`)}
        >
          <Text style={styles.buttonSecondaryText}>📞 Chiama</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!user?.driverId) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>🚫</Text>
        <Text style={styles.emptyText}>Non sei registrato come driver</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orders?.data || []}
        renderItem={renderDelivery}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>✨</Text>
            <Text style={styles.emptyText}>Nessuna consegna in programma</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  list: { padding: 16, gap: 16 },
  deliveryCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderNumber: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  customerInfo: { marginBottom: 12 },
  customerName: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  phone: { fontSize: 14, color: '#0ea5e9' },
  addressCard: { flexDirection: 'row', backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 12 },
  addressIcon: { fontSize: 20, marginRight: 12 },
  addressContent: { flex: 1 },
  addressText: { fontSize: 14, color: '#475569' },
  mapLink: { fontSize: 12, color: '#0ea5e9', marginTop: 4 },
  itemsList: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 16 },
  itemsTitle: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
  itemText: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  moreItems: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
  actions: { gap: 10 },
  buttonPrimary: { backgroundColor: '#0ea5e9', padding: 14, borderRadius: 12, alignItems: 'center' },
  buttonPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonSuccess: { backgroundColor: '#10b981', padding: 14, borderRadius: 12, alignItems: 'center' },
  buttonSuccessText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonSecondary: { backgroundColor: '#f1f5f9', padding: 14, borderRadius: 12, alignItems: 'center' },
  buttonSecondaryText: { color: '#475569', fontSize: 16, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 16, color: '#64748b' },
});
