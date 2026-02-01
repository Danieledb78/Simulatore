import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { zonesApi } from '../services/api';
import { PlusIcon, PencilIcon, TrashIcon, MapPinIcon } from '@heroicons/react/24/outline';

export default function ZonesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<any>(null);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data: zones, isLoading } = useQuery({
    queryKey: ['zones'],
    queryFn: () => zonesApi.getAll(),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => editingZone
      ? zonesApi.update(editingZone.id, data)
      : zonesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      toast.success(editingZone ? 'Zona aggiornata' : 'Zona creata');
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => zonesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      toast.success('Zona eliminata');
    },
  });

  const openModal = (zone?: any) => {
    setEditingZone(zone);
    if (zone) {
      reset({
        name: zone.name,
        description: zone.description,
        deliveryFee: zone.deliveryFee,
        postalCodes: zone.postalCodes?.join(', '),
        cities: zone.cities?.join(', '),
      });
    } else {
      reset({ deliveryFee: 5 });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingZone(null);
    reset();
  };

  const onSubmit = (data: any) => {
    saveMutation.mutate({
      name: data.name,
      description: data.description,
      deliveryFee: parseFloat(data.deliveryFee) || 0,
      postalCodes: data.postalCodes?.split(',').map((s: string) => s.trim()).filter(Boolean) || [],
      cities: data.cities?.split(',').map((s: string) => s.trim()).filter(Boolean) || [],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Zone di Consegna</h1>
        <button onClick={() => openModal()} className="btn btn-primary flex items-center gap-2">
          <PlusIcon className="h-5 w-5" /> Nuova Zona
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <p>Caricamento...</p>
        ) : zones?.data?.map((zone: any) => (
          <div key={zone.id} className="card">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
                  <MapPinIcon className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <p className="font-semibold">{zone.name}</p>
                  <p className="text-sm text-gray-500">{zone.description || 'Nessuna descrizione'}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openModal(zone)} className="p-1 text-gray-400 hover:text-gray-600">
                  <PencilIcon className="h-5 w-5" />
                </button>
                <button onClick={() => deleteMutation.mutate(zone.id)} className="p-1 text-gray-400 hover:text-red-600">
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Costo Consegna</span>
                <span className="font-semibold text-primary-600">€{Number(zone.deliveryFee).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Driver assegnati</span>
                <span className="font-medium">{zone._count?.drivers || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Clienti</span>
                <span className="font-medium">{zone._count?.customers || 0}</span>
              </div>
              {zone.postalCodes?.length > 0 && (
                <div>
                  <span className="text-gray-500">CAP: </span>
                  <span className="text-gray-700">{zone.postalCodes.join(', ')}</span>
                </div>
              )}
              {zone.cities?.length > 0 && (
                <div>
                  <span className="text-gray-500">Città: </span>
                  <span className="text-gray-700">{zone.cities.join(', ')}</span>
                </div>
              )}
            </div>

            {zone.drivers?.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-gray-500 mb-2">Driver:</p>
                <div className="flex flex-wrap gap-1">
                  {zone.drivers.map((d: any) => (
                    <span key={d.id} className="badge badge-info text-xs">
                      {d.user?.firstName} {d.user?.lastName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-semibold mb-4">
                {editingZone ? 'Modifica Zona' : 'Nuova Zona'}
              </h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="label">Nome</label>
                  <input {...register('name', { required: true })} className="input" />
                </div>
                <div>
                  <label className="label">Descrizione</label>
                  <textarea {...register('description')} className="input" rows={2} />
                </div>
                <div>
                  <label className="label">Costo Consegna (€)</label>
                  <input type="number" step="0.01" {...register('deliveryFee')} className="input" />
                </div>
                <div>
                  <label className="label">CAP (separati da virgola)</label>
                  <input {...register('postalCodes')} className="input" placeholder="00100, 00101, 00102" />
                </div>
                <div>
                  <label className="label">Città (separate da virgola)</label>
                  <input {...register('cities')} className="input" placeholder="Roma Nord, Roma Centro" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">Annulla</button>
                  <button type="submit" className="btn btn-primary flex-1">
                    {editingZone ? 'Aggiorna' : 'Crea'}
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
