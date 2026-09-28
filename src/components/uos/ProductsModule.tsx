import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatBRL } from '@/lib/pms-types';
import {
  POS_POINTS,
  type PosPointId,
  type PosProduct,
  listAllProducts,
  listProductCategories,
  addProductCategory,
  upsertProduct,
  deleteProduct,
} from '@/lib/pos-catalog';
import { Package, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';



export function ProductsModule() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const products = useMemo(() => listAllProducts(), [tick]);
  const categories = useMemo(() => listProductCategories(), [tick]);

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<string>('bebida');
  const [newCategory, setNewCategory] = useState('');
  const [posIds, setPosIds] = useState<PosPointId[]>(['bar-central']);
  const [active, setActive] = useState(true);

  const openNew = () => {
    setEditId(undefined);
    setName('');
    setPrice('');
    setCategory(categories[0]?.id || 'bebida');
    setPosIds(['bar-central']);
    setActive(true);
    setFormOpen(true);
  };

  const openEdit = (p: PosProduct) => {
    setEditId(p.id);
    setName(p.name);
    setPrice(String(p.price).replace('.', ','));
    setCategory(p.category);
    setPosIds([...p.posIds]);
    setActive(p.active);
    setFormOpen(true);
  };

  const togglePos = (id: PosPointId) => {
    setPosIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = () => {
    const n = parseFloat(price.replace(/\./g, '').replace(',', '.')) || 0;
    const res = upsertProduct({
      id: editId,
      name,
      price: n,
      category,
      posIds,
      active,
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(editId ? 'Produto atualizado' : 'Produto cadastrado');
    setFormOpen(false);
    refresh();
  };

  const remove = (id: string) => {
    if (!confirm('Excluir este produto?')) return;
    const r = deleteProduct(id);
    if (r.ok) {
      toast.message('Excluído');
      refresh();
    } else toast.error(r.message);
  };

  const addCategory = () => {
    const result = addProductCategory(newCategory);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`Categoria "${result.category.name}" adicionada`);
    setCategory(result.category.id);
    setNewCategory('');
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-slate-900">Produtos para venda</p>
          <p className="text-[12px] text-slate-500">
            Aparecem na Venda por PDV (Bar, Restaurante, Recepção) · {products.length} item(ns)
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={refresh} className="h-9 px-3 rounded-lg border border-slate-200 text-[12px] font-medium inline-flex items-center gap-1.5 hover:bg-slate-50">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
          <button type="button" onClick={openNew} className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-semibold inline-flex items-center gap-1.5 hover:bg-slate-800">
            <Plus className="w-3.5 h-3.5" /> Novo produto
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[12px] font-semibold text-slate-800">Categorias de produtos</p>
            <p className="text-[11px] text-slate-500">Crie categorias como Bebidas, Proteínas, Sobremesas etc.</p>
          </div>
          <div className="flex gap-2">
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); }}
              placeholder="Nova categoria"
              className="h-9 w-44 rounded-lg border border-slate-200 px-3 text-[12px] outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button type="button" onClick={addCategory} className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-semibold inline-flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <span key={c.id} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">{c.name}</span>
          ))}
        </div>
      </div>

      {formOpen && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
          <p className="text-[13px] font-semibold text-slate-800">{editId ? 'Editar produto' : 'Novo produto'}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-[11px] font-semibold uppercase text-slate-400">Nome</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 px-3 text-[14px] outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Ex.: Água sem gás" />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase text-slate-400">Preço (R$)</span>
              <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className="w-full h-10 rounded-lg border border-slate-200 px-3 text-[14px] text-right tabular-nums outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="0,00" />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase text-slate-400">Categoria</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 px-2 bg-white text-[14px]">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase text-slate-400">Pontos de venda</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {POS_POINTS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePos(p.id)}
                  className={cn(
                    'h-9 px-3 rounded-lg border text-[12px] font-medium',
                    posIds.includes(p.id)
                      ? 'border-blue-300 bg-blue-50 text-blue-800'
                      : 'border-slate-200 bg-white text-slate-600',
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Ativo (aparece na venda)
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFormOpen(false)} className="h-9 px-3 rounded-lg border border-slate-200 text-[12px] font-medium">Cancelar</button>
            <button type="button" onClick={save} className="h-9 px-4 rounded-lg bg-blue-600 text-white text-[12px] font-semibold">Salvar</button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {products.length === 0 ? (
          <p className="px-4 py-12 text-center text-[13px] text-slate-400">Nenhum produto</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {products.map((p) => (
              <li key={p.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-[13px]">
                <Package className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{p.name}</p>
                  <p className="text-[11px] text-slate-500">
                     {categories.find((c) => c.id === p.category)?.name || p.category} ·{' '}
                    {p.posIds.map((id) => POS_POINTS.find((x) => x.id === id)?.name).join(', ')}
                    {!p.active && <span className="text-amber-700"> · inativo</span>}
                  </p>
                </div>
                <span className="font-semibold tabular-nums text-slate-800">{formatBRL(p.price)}</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => openEdit(p)} className="h-8 w-8 rounded-lg border border-slate-200 inline-flex items-center justify-center hover:bg-slate-50"><Pencil className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => remove(p.id)} className="h-8 w-8 rounded-lg border border-rose-100 text-rose-600 inline-flex items-center justify-center hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
