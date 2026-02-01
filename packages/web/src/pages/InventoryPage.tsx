import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { inventoryApi, productsApi } from '../services/api';
import { PlusIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function InventoryPage() {
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue } = useForm();

  const { data: inventory, isLoading } = useQuery({
    queryKey: ['inventory', showLowStock],
    queryFn: () => inventoryApi.getAll({ lowStock: showLowStock }),
  });

  const { data: lowStock } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => inventoryApi.getLowStock(),
  });

  const loadMutation = useMutation({
    mutationFn: (data: any) => inventoryApi.loadStock(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      toast.success(`Caricato: ${response.data.product.name} +${response.data.movement.quantity}`);
      reset();
      setIsLoadModalOpen(false);
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Errore'),
  });

  const handleBarcodeSearch = async (barcode: string) => {
    if (barcode.length >= 8) {
      try {
        const response = await productsApi.getByBarcode(barcode);
        toast.success(`Prodotto: ${response.data.name}`);
      } catch {
        toast.error('Prodotto non trovato');
      }
    }
  };

  const onSubmit = (data: any) => {
    loadMutation.mutate({
      barcode: data.barcode,
      quantity: parseInt(data.quantity),
      notes: data.notes,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
        <button onClick={() => setIsLoadModalOpen(true)} className="btn btn-primary flex items-center gap-2">
          <PlusIcon className="h-5 w-5" /> Carica Merce
        </button>
      </div>

      {/* Low Stock Alert */}
      {lowStock?.data?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-red-800">Scorte Basse</h3>
            <p className="text-sm text-red-600">
              {lowStock.data.length} prodotti sotto la soglia minima
            </p>
            <button
              onClick={() => setShowLowStock(!showLowStock)}
              className="text-sm text-red-700 underline mt-1"
            >
              {showLowStock ? 'Mostra tutti' : 'Mostra solo scorte basse'}
            </button>
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Prodotto</th>
                <th className="table-header">Barcode</th>
                <th className="table-header">Categoria</th>
                <th className="table-header">Quantità</th>
                <th className="table-header">Disponibile</th>
                <th className="table-header">Min. Stock</th>
                <th className="table-header">Stato</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-8">Caricamento...</td></tr>
              ) : inventory?.data?.map((item: any) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{item.name}</td>
                  <td className="table-cell font-mono text-sm">{item.barcode}</td>
                  <td className="table-cell">{item.category?.name}</td>
                  <td className="table-cell font-semibold">{item.inventory?.quantity || 0}</td>
                  <td className="table-cell">{item.inventory?.availableQty || 0}</td>
                  <td className="table-cell">{item.minStockLevel}</td>
                  <td className="table-cell">
                    {(item.inventory?.quantity || 0) <= item.minStockLevel ? (
                      <span className="badge badge-danger">Scorta Bassa</span>
                    ) : (
                      <span className="badge badge-success">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Load Stock Modal */}
      {isLoadModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setIsLoadModalOpen(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-semibold mb-4">Carica Merce</h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="label">Barcode (scansiona o inserisci)</label>
                  <input
                    {...register('barcode', { required: true })}
                    className="input font-mono text-lg"
                    autoFocus
                    onChange={(e) => handleBarcodeSearch(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Quantità</label>
                  <input
                    type="number"
                    {...register('quantity', { required: true, min: 1 })}
                    className="input text-lg"
                    min="1"
                  />
                </div>
                <div>
                  <label className="label">Note (opzionale)</label>
                  <textarea {...register('notes')} className="input" rows={2} />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsLoadModalOpen(false)} className="btn btn-secondary flex-1">
                    Annulla
                  </button>
                  <button type="submit" className="btn btn-primary flex-1" disabled={loadMutation.isPending}>
                    {loadMutation.isPending ? 'Caricamento...' : 'Carica'}
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
