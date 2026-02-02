import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../services/api';
import {
  CubeIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  CurrencyEuroIcon,
  ExclamationTriangleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => dashboardApi.getOverview(),
  });

  const { data: recentOrders } = useQuery({
    queryKey: ['recent-orders'],
    queryFn: () => dashboardApi.getRecentOrders(10),
  });

  const { data: driversStatus } = useQuery({
    queryKey: ['drivers-status'],
    queryFn: () => dashboardApi.getDriversStatus(),
  });

  const stats = overview?.data;

  const statCards = [
    { name: 'Ordini Oggi', value: stats?.todayOrders || 0, icon: ClipboardDocumentListIcon, color: 'blue' },
    { name: 'Fatturato Oggi', value: `€${Number(stats?.todayRevenue || 0).toFixed(2)}`, icon: CurrencyEuroIcon, color: 'green' },
    { name: 'Ordini in Attesa', value: stats?.pendingOrders || 0, icon: ClockIcon, color: 'yellow' },
    { name: 'Scorte Basse', value: stats?.lowStockCount || 0, icon: ExclamationTriangleIcon, color: 'red' },
    { name: 'Totale Prodotti', value: stats?.totalProducts || 0, icon: CubeIcon, color: 'purple' },
    { name: 'Totale Clienti', value: stats?.totalCustomers || 0, icon: UsersIcon, color: 'indigo' },
  ];

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      PENDING: 'badge-warning',
      CONFIRMED: 'badge-info',
      PROCESSING: 'badge-info',
      READY: 'badge-success',
      OUT_FOR_DELIVERY: 'badge-success',
      DELIVERED: 'badge-gray',
      CANCELLED: 'badge-danger',
    };
    return badges[status] || 'badge-gray';
  };

  const statusLabels: Record<string, string> = {
    PENDING: 'In Attesa',
    CONFIRMED: 'Confermato',
    PROCESSING: 'In Preparazione',
    READY: 'Pronto',
    OUT_FOR_DELIVERY: 'In Consegna',
    DELIVERED: 'Consegnato',
    CANCELLED: 'Annullato',
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <div key={stat.name} className="card flex items-center gap-4">
            <div className={`p-3 rounded-lg bg-${stat.color}-100`}>
              <stat.icon className={`h-6 w-6 text-${stat.color}-600`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{stat.name}</p>
              <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Ordini Recenti</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="table-header">Ordine</th>
                  <th className="table-header">Cliente</th>
                  <th className="table-header">Totale</th>
                  <th className="table-header">Stato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentOrders?.data?.map((order: any) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{order.orderNumber}</td>
                    <td className="table-cell">{order.customer}</td>
                    <td className="table-cell">€{Number(order.total).toFixed(2)}</td>
                    <td className="table-cell">
                      <span className={`badge ${getStatusBadge(order.status)}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Drivers Status */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Stato Driver</h2>
          <div className="space-y-3">
            {driversStatus?.data?.map((driver: any) => (
              <div
                key={driver.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      driver.isAvailable ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  />
                  <div>
                    <p className="font-medium text-gray-900">{driver.name}</p>
                    <p className="text-sm text-gray-500">{driver.zone || 'Nessuna zona'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {driver.pendingDeliveries} consegne
                  </p>
                  <p className="text-xs text-gray-500">
                    {driver.isAvailable ? 'Disponibile' : 'Non disponibile'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
