import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ordersApi, driversApi } from '../services/api';
import { EyeIcon, TruckIcon } from '@heroicons/react/24/outline';

const statusOptions = [
  { value: 'PENDING', label: 'In Attesa', color: 'badge-warning' },
  { value: 'CONFIRMED', label: 'Confermato', color: 'badge-info' },
  { value: 'PROCESSING', label: 'In Preparazione', color: 'badge-info' },
  { value: 'READY', label: 'Pronto', color: 'badge-success' },
  { value: 'OUT_FOR_DELIVERY', label: 'In Consegna', color: 'badge-success' },
  { value: 'DELIVERED', label: 'Consegnato', color: 'badge-gray' },
  { value: 'CANCELLED', label: 'Annullato', color: 'badge-danger' },
];

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', statusFilter],
    queryFn: () => ordersApi.getAll({ status: statusFilter || undefined }),
  });

  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => driversApi.getAll(),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      ordersApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Stato aggiornato');
    },
  });

  const assignDriverMutation = useMutation({
    mutationFn: ({ orderId, driverId }: { orderId: string; driverId: string }) =>
      ordersApi.assignDriver(orderId, driverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Driver assegnato');
      setAssignModalOpen(false);
    },
  });

  const getStatusBadge = (status: string) => {
    const s = statusOptions.find((o) => o.value === status);
    return s ? <span className={`badge ${s.color}`}>{s.label}</span> : status;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Ordini</h1>
        <select
          className="input w-48"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tutti gli stati</option>
          {statusOptions.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Ordine</th>
                <th className="table-header">Cliente</th>
                <th className="table-header">Fonte</th>
                <th className="table-header">Totale</th>
                <th className="table-header">Stato</th>
                <th className="table-header">Pagamento</th>
                <th className="table-header">Driver</th>
                <th className="table-header">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-8">Caricamento...</td></tr>
              ) : orders?.data?.data?.map((order: any) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{order.orderNumber}</td>
                  <td className="table-cell">{order.customer?.firstName} {order.customer?.lastName}</td>
                  <td className="table-cell"><span className="badge badge-gray">{order.source}</span></td>
                  <td className="table-cell font-semibold">€{Number(order.total).toFixed(2)}</td>
                  <td className="table-cell">{getStatusBadge(order.status)}</td>
                  <td className="table-cell">
                    <span className={`badge ${order.paymentStatus === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                      {order.paymentStatus === 'PAID' ? 'Pagato' : 'In attesa'}
                    </span>
                  </td>
                  <td className="table-cell">
                    {order.driver ? (
                      `${order.driver.user?.firstName} ${order.driver.user?.lastName}`
                    ) : (
                      <button
                        onClick={() => { setSelectedOrder(order); setAssignModalOpen(true); }}
                        className="text-primary-600 hover:text-primary-800 text-sm"
                      >
                        Assegna
                      </button>
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <button className="text-primary-600 hover:text-primary-800">
                        <EyeIcon className="h-5 w-5" />
                      </button>
                      {order.status === 'PENDING' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'CONFIRMED' })}
                          className="text-green-600 hover:text-green-800 text-sm"
                        >
                          Conferma
                        </button>
                      )}
                      {order.status === 'READY' && order.driver && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'OUT_FOR_DELIVERY' })}
                          className="text-green-600 hover:text-green-800"
                        >
                          <TruckIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Driver Modal */}
      {assignModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setAssignModalOpen(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-semibold mb-4">Assegna Driver</h2>
              <p className="text-gray-600 mb-4">Ordine: {selectedOrder.orderNumber}</p>
              <div className="space-y-2">
                {drivers?.data?.filter((d: any) => d.isAvailable && d.user?.isActive).map((driver: any) => (
                  <button
                    key={driver.id}
                    onClick={() => assignDriverMutation.mutate({ orderId: selectedOrder.id, driverId: driver.id })}
                    className="w-full p-3 text-left border rounded-lg hover:bg-gray-50 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium">{driver.user?.firstName} {driver.user?.lastName}</p>
                      <p className="text-sm text-gray-500">{driver.zone?.name || 'Nessuna zona'}</p>
                    </div>
                    <span className="text-sm text-gray-500">{driver._count?.orders || 0} consegne</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setAssignModalOpen(false)} className="btn btn-secondary w-full mt-4">
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
