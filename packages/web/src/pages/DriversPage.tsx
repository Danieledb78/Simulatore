import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { driversApi, zonesApi } from '../services/api';
import { PlusIcon, PencilIcon } from '@heroicons/react/24/outline';

export default function DriversPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data: drivers, isLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => driversApi.getAll(),
  });

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: () => zonesApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => driversApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Driver creato');
      closeModal();
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Errore'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => driversApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Driver aggiornato');
      closeModal();
    },
  });

  const toggleAvailability = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      driversApi.updateAvailability(id, isAvailable),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });

  const openModal = (driver?: any) => {
    setEditingDriver(driver);
    if (driver) {
      reset({
        zoneId: driver.zoneId,
        vehicleType: driver.vehicleType,
        vehiclePlate: driver.vehiclePlate,
      });
    } else {
      reset({});
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDriver(null);
    reset();
  };

  const onSubmit = (data: any) => {
    if (editingDriver) {
      updateMutation.mutate({ id: editingDriver.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Driver</h1>
        <button onClick={() => openModal()} className="btn btn-primary flex items-center gap-2">
          <PlusIcon className="h-5 w-5" /> Nuovo Driver
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <p>Caricamento...</p>
        ) : drivers?.data?.map((driver: any) => (
          <div key={driver.id} className="card">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${driver.isAvailable ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <span className={`text-lg font-medium ${driver.isAvailable ? 'text-green-600' : 'text-gray-500'}`}>
                    {driver.user?.firstName?.[0]}{driver.user?.lastName?.[0]}
                  </span>
                </div>
                <div>
                  <p className="font-semibold">{driver.user?.firstName} {driver.user?.lastName}</p>
                  <p className="text-sm text-gray-500">{driver.user?.email}</p>
                </div>
              </div>
              <button onClick={() => openModal(driver)} className="text-gray-400 hover:text-gray-600">
                <PencilIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Zona</span>
                <span className="font-medium">{driver.zone?.name || 'Non assegnata'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Veicolo</span>
                <span className="font-medium">{driver.vehicleType || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Targa</span>
                <span className="font-medium">{driver.vehiclePlate || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Consegne attive</span>
                <span className="font-medium">{driver._count?.orders || 0}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <span className={`badge ${driver.isAvailable ? 'badge-success' : 'badge-gray'}`}>
                {driver.isAvailable ? 'Disponibile' : 'Non disponibile'}
              </span>
              <button
                onClick={() => toggleAvailability.mutate({ id: driver.id, isAvailable: !driver.isAvailable })}
                className="text-sm text-primary-600 hover:text-primary-800"
              >
                {driver.isAvailable ? 'Disattiva' : 'Attiva'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-semibold mb-4">
                {editingDriver ? 'Modifica Driver' : 'Nuovo Driver'}
              </h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {!editingDriver && (
                  <>
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
                      <label className="label">Email</label>
                      <input type="email" {...register('email', { required: true })} className="input" />
                    </div>
                    <div>
                      <label className="label">Password</label>
                      <input type="password" {...register('password', { required: true })} className="input" />
                    </div>
                  </>
                )}
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
                    <label className="label">Tipo Veicolo</label>
                    <input {...register('vehicleType')} className="input" placeholder="Furgone" />
                  </div>
                  <div>
                    <label className="label">Targa</label>
                    <input {...register('vehiclePlate')} className="input" placeholder="AA000BB" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">Annulla</button>
                  <button type="submit" className="btn btn-primary flex-1">
                    {editingDriver ? 'Aggiorna' : 'Crea'}
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
