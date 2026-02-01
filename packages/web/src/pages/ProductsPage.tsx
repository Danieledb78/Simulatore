import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { productsApi, categoriesApi } from '../services/api';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function ProductsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: () => productsApi.getAll({ search, limit: 100 }),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => productsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Prodotto creato');
      closeModal();
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Errore'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => productsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Prodotto aggiornato');
      closeModal();
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Errore'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Prodotto eliminato');
    },
  });

  const openModal = (product?: any) => {
    setEditingProduct(product);
    if (product) {
      reset(product);
    } else {
      reset({ vatRate: 22, minStockLevel: 10 });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    reset();
  };

  const onSubmit = (data: any) => {
    const payload = {
      ...data,
      purchasePrice: parseFloat(data.purchasePrice),
      sellingPrice: parseFloat(data.sellingPrice),
      vatRate: parseFloat(data.vatRate),
      minStockLevel: parseInt(data.minStockLevel),
    };
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Prodotti</h1>
        <button onClick={() => openModal()} className="btn btn-primary flex items-center gap-2">
          <PlusIcon className="h-5 w-5" /> Nuovo Prodotto
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Cerca prodotti..."
          className="input pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Products Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Barcode</th>
                <th className="table-header">Nome</th>
                <th className="table-header">Categoria</th>
                <th className="table-header">Prezzo</th>
                <th className="table-header">Stock</th>
                <th className="table-header">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-8">Caricamento...</td></tr>
              ) : products?.data?.data?.map((product: any) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="table-cell font-mono text-sm">{product.barcode}</td>
                  <td className="table-cell font-medium">{product.name}</td>
                  <td className="table-cell">{product.category?.name}</td>
                  <td className="table-cell">€{Number(product.sellingPrice).toFixed(2)}</td>
                  <td className="table-cell">
                    <span className={`badge ${product.inventory?.quantity <= product.minStockLevel ? 'badge-danger' : 'badge-success'}`}>
                      {product.inventory?.quantity || 0}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <button onClick={() => openModal(product)} className="text-primary-600 hover:text-primary-800">
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button onClick={() => deleteMutation.mutate(product.id)} className="text-red-600 hover:text-red-800">
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-semibold mb-4">
                {editingProduct ? 'Modifica Prodotto' : 'Nuovo Prodotto'}
              </h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="label">Barcode</label>
                  <input {...register('barcode', { required: 'Richiesto' })} className="input" disabled={!!editingProduct} />
                </div>
                <div>
                  <label className="label">Nome</label>
                  <input {...register('name', { required: 'Richiesto' })} className="input" />
                </div>
                <div>
                  <label className="label">Categoria</label>
                  <select {...register('categoryId', { required: 'Richiesto' })} className="input">
                    <option value="">Seleziona...</option>
                    {categories?.data?.map((cat: any) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Prezzo Acquisto</label>
                    <input type="number" step="0.01" {...register('purchasePrice', { required: true })} className="input" />
                  </div>
                  <div>
                    <label className="label">Prezzo Vendita</label>
                    <input type="number" step="0.01" {...register('sellingPrice', { required: true })} className="input" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">IVA %</label>
                    <input type="number" {...register('vatRate')} className="input" />
                  </div>
                  <div>
                    <label className="label">Stock Minimo</label>
                    <input type="number" {...register('minStockLevel')} className="input" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">Annulla</button>
                  <button type="submit" className="btn btn-primary flex-1">
                    {editingProduct ? 'Aggiorna' : 'Crea'}
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
