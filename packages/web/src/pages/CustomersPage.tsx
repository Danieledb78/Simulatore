import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { customersApi, zonesApi } from '../services/api';
import { PlusIcon, PencilIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const customerTypes = [
  { value: 'PRIVATE', label: 'Privato' },
  { value: 'BAR', label: 'Bar' },
  { value: 'RESTAURANT', label: 'Ristorante' },
  { value: 'HOTEL', label: 'Hotel' },
  { value: 'SHOP', label: 'Negozio' },
  { value: 'WHOLESALE', label: 'Grossista' },
];

export default function CustomersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => customersApi.getAll({ search }),
  });

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: () => zonesApi.getAll(),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => editingCustomer
      ? customersApi.update(editingCustomer.id, data)
      : customersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(editingCustomer ? 'Cliente aggiornato' : 'Cliente creato');
      closeModal();
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Errore'),
  });

  const openModal = (customer?: any) => {
    setEditingCustomer(customer);
    reset(customer || { type: 'PRIVATE' });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
    reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clienti</h1>
        <button onClick={() => openModal()} className="btn btn-primary flex items-center gap-2">
          <PlusIcon className="h-5 w-5" /> Nuovo Cliente
        </button>
      </div>

      <div className="relative max-w-md">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Cerca clienti..."
          className="input pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Nome</th>
                <th className="table-header">Tipo</th>
                <th className="table-header">Telefono</th>
                <th className="table-header">Email</th>
                <th className="table-header">Zona</th>
                <th className="table-header">Ordini</th>
                <th className="table-header">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-8">Caricamento...</td></tr>
              ) : customers?.data?.data?.map((customer: any) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">
                    {customer.companyName || `${customer.firstName} ${customer.lastName}`}
                  </td>
                  <td className="table-cell">
                    <span className="badge badge-info">{customer.type}</span>
                  </td>
                  <td className="table-cell">{customer.phone}</td>
                  <td className="table-cell">{customer.email || '-'}</td>
                  <td className="table-cell">{customer.zone?.name || '-'}</td>
                  <td className="table-cell">{customer._count?.orders || 0}</td>
                  <td className="table-cell">
                    <button onClick={() => openModal(customer)} className="text-primary-600 hover:text-primary-800">
                      <PencilIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-semibold mb-4">
                {editingCustomer ? 'Modifica Cliente' : 'Nuovo Cliente'}
              </h2>
              <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-4">
                <div>
                  <label className="label">Tipo</label>
                  <select {...register('type')} className="input">
                    {customerTypes.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Nome</label>
                    <input {...register('firstName', { required: true })} className="input" />
                  </div>
                  <div>
                    <label className="label">Cognome</label>
                    <input {...register('lastName', { required: true })} className="input" />
                  </div>
                </div>
                <div>
                  <label className="label">Ragione Sociale</label>
                  <input {...register('companyName')} className="input" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Telefono</label>
                    <input {...register('phone', { required: true })} className="input" />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input type="email" {...register('email')} className="input" />
                  </div>
                </div>
                <div>
                  <label className="label">Indirizzo</label>
                  <input {...register('address')} className="input" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">Città</label>
                    <input {...register('city')} className="input" />
                  </div>
                  <div>
                    <label className="label">Provincia</label>
                    <input {...register('province')} className="input" />
                  </div>
                  <div>
                    <label className="label">CAP</label>
                    <input {...register('postalCode')} className="input" />
                  </div>
                </div>
                <div>
                  <label className="label">Zona</label>
                  <select {...register('zoneId')} className="input">
                    <option value="">Seleziona zona...</option>
                    {zones?.data?.map((zone: any) => (
                      <option key={zone.id} value={zone.id}>{zone.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">P.IVA</label>
                    <input {...register('vatNumber')} className="input" />
                  </div>
                  <div>
                    <label className="label">Codice Fiscale</label>
                    <input {...register('fiscalCode')} className="input" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">Annulla</button>
                  <button type="submit" className="btn btn-primary flex-1">
                    {editingCustomer ? 'Aggiorna' : 'Crea'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
