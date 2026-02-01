import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { settingsApi } from '../services/api';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.getAll(),
  });

  const { data: priceLists } = useQuery({
    queryKey: ['price-lists'],
    queryFn: () => settingsApi.getPriceLists(),
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => settingsApi.getSuppliers(),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => settingsApi.updateBulk(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Impostazioni salvate');
    },
  });

  const settingsData = settings?.data || {};

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Impostazioni</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Dati Azienda</h2>
          <form
            onSubmit={handleSubmit((data) => updateMutation.mutate(data))}
            className="space-y-4"
          >
            <div>
              <label className="label">Nome Azienda</label>
              <input
                className="input"
                defaultValue={settingsData.company_name}
                {...register('company_name')}
              />
            </div>
            <div>
              <label className="label">Indirizzo</label>
              <input
                className="input"
                defaultValue={settingsData.company_address}
                {...register('company_address')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">P.IVA</label>
                <input
                  className="input"
                  defaultValue={settingsData.company_vat}
                  {...register('company_vat')}
                />
              </div>
              <div>
                <label className="label">Telefono</label>
                <input
                  className="input"
                  defaultValue={settingsData.company_phone}
                  {...register('company_phone')}
                />
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                defaultValue={settingsData.company_email}
                {...register('company_email')}
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Salva
            </button>
          </form>
        </div>

        {/* System Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Impostazioni Sistema</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Soglia Scorte Basse</label>
              <input
                type="number"
                className="input"
                defaultValue={settingsData.low_stock_threshold}
              />
              <p className="text-xs text-gray-500 mt-1">
                Notifica quando lo stock scende sotto questo valore
              </p>
            </div>
            <div>
              <label className="label">IVA Predefinita (%)</label>
              <input
                type="number"
                className="input"
                defaultValue={settingsData.default_vat_rate || 22}
              />
            </div>
            <div>
              <label className="label">Prefisso Ordini</label>
              <input
                className="input"
                defaultValue={settingsData.order_prefix || 'ORD'}
              />
            </div>
            <div>
              <label className="label">Prefisso Fatture</label>
              <input
                className="input"
                defaultValue={settingsData.invoice_prefix || 'FT'}
              />
            </div>
          </div>
        </div>

        {/* Price Lists */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Listini Prezzi</h2>
          <div className="space-y-3">
            {priceLists?.data?.map((list: any) => (
              <div
                key={list.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium">{list.name}</p>
                  <p className="text-sm text-gray-500">
                    {list._count?.items || 0} prodotti - {list._count?.customers || 0} clienti
                  </p>
                </div>
                {list.isDefault && (
                  <span className="badge badge-info">Default</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Suppliers */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Fornitori</h2>
          <div className="space-y-3">
            {suppliers?.data?.map((supplier: any) => (
              <div
                key={supplier.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium">{supplier.name}</p>
                  <p className="text-sm text-gray-500">
                    {supplier.email || supplier.phone || '-'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Integrations */}
        <div className="card lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">Integrazioni</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-green-600 font-bold">WA</span>
                </div>
                <div>
                  <p className="font-medium">WhatsApp Business</p>
                  <p className="text-xs text-gray-500">Ordini via chat</p>
                </div>
              </div>
              <span className="badge badge-success">Configurato</span>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 font-bold">S</span>
                </div>
                <div>
                  <p className="font-medium">Stripe</p>
                  <p className="text-xs text-gray-500">Pagamenti online</p>
                </div>
              </div>
              <span className="badge badge-success">Configurato</span>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 font-bold">FE</span>
                </div>
                <div>
                  <p className="font-medium">Fattura Elettronica</p>
                  <p className="text-xs text-gray-500">Invio SDI</p>
                </div>
              </div>
              <span className="badge badge-warning">Da configurare</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
