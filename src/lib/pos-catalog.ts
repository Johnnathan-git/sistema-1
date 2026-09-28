/** Catálogo de produtos e pontos de venda (POS) — localStorage */

export type PosPointId = 'bar-central' | 'restaurante' | 'recepcao';

export interface PosPoint {
  id: PosPointId;
  name: string;
  active: boolean;
}

export interface PosProductCategory {
  id: string;
  name: string;
  createdAt: string;
}

export interface PosProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  /** PDVs onde o produto aparece */
  posIds: PosPointId[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const LS_PRODUCTS = 'uos-pos-products-v1';
const LS_CATEGORIES = 'uos-pos-product-categories-v1';

export const POS_POINTS: PosPoint[] = [
  { id: 'bar-central', name: 'Bar central', active: true },
  { id: 'restaurante', name: 'Restaurante', active: true },
  { id: 'recepcao', name: 'Recepção', active: true },
];

function uid() {
  return `prd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function seedProducts(): PosProduct[] {
  const now = new Date().toISOString();
  return [
    { id: uid(), name: 'Água sem gás', price: 6, category: 'bebida', posIds: ['bar-central', 'restaurante', 'recepcao'], active: true, createdAt: now, updatedAt: now },
    { id: uid(), name: 'Água com gás', price: 7, category: 'bebida', posIds: ['bar-central', 'restaurante'], active: true, createdAt: now, updatedAt: now },
    { id: uid(), name: 'Refrigerante lata', price: 9, category: 'bebida', posIds: ['bar-central', 'restaurante'], active: true, createdAt: now, updatedAt: now },
    { id: uid(), name: 'Cerveja long neck', price: 14, category: 'bebida', posIds: ['bar-central'], active: true, createdAt: now, updatedAt: now },
    { id: uid(), name: 'Café expresso', price: 8, category: 'bebida', posIds: ['bar-central', 'restaurante', 'recepcao'], active: true, createdAt: now, updatedAt: now },
    { id: uid(), name: 'Suco natural', price: 12, category: 'bebida', posIds: ['bar-central', 'restaurante'], active: true, createdAt: now, updatedAt: now },
    { id: uid(), name: 'Porção batata', price: 28, category: 'comida', posIds: ['bar-central', 'restaurante'], active: true, createdAt: now, updatedAt: now },
    { id: uid(), name: 'Hambúrguer', price: 42, category: 'comida', posIds: ['bar-central', 'restaurante'], active: true, createdAt: now, updatedAt: now },
    { id: uid(), name: 'Prato executivo', price: 45, category: 'comida', posIds: ['restaurante'], active: true, createdAt: now, updatedAt: now },
    { id: uid(), name: 'Lavanderia peça', price: 25, category: 'servico', posIds: ['recepcao'], active: true, createdAt: now, updatedAt: now },
  ];
}

function loadProducts(): PosProduct[] {
  try {
    const raw = localStorage.getItem(LS_PRODUCTS);
    if (raw) {
      const p = JSON.parse(raw) as PosProduct[];
      if (Array.isArray(p) && p.length) return p;
    }
  } catch {}
  const seeded = seedProducts();
  saveProducts(seeded);
  return seeded;
}

function saveProducts(list: PosProduct[]) {
  localStorage.setItem(LS_PRODUCTS, JSON.stringify(list));
}

function uidCategory() {
  return `cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const DEFAULT_CATEGORIES: PosProductCategory[] = [
  { id: 'bebida', name: 'Bebidas', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'comida', name: 'Comidas', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'servico', name: 'Serviços', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'outro', name: 'Outros', createdAt: '2026-01-01T00:00:00.000Z' },
];

function loadCategories(): PosProductCategory[] {
  try {
    const raw = localStorage.getItem(LS_CATEGORIES);
    if (raw) {
      const parsed = JSON.parse(raw) as PosProductCategory[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {}
  const seeded = [...DEFAULT_CATEGORIES];
  saveCategories(seeded);
  return seeded;
}

function saveCategories(list: PosProductCategory[]) {
  localStorage.setItem(LS_CATEGORIES, JSON.stringify(list));
}

export function listProductCategories(): PosProductCategory[] {
  return loadCategories().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function addProductCategory(name: string): { ok: true; category: PosProductCategory } | { ok: false; message: string } {
  const normalized = name.trim();
  if (!normalized) return { ok: false, message: 'Informe o nome da categoria' };
  const list = loadCategories();
  if (list.some((c) => c.name.localeCompare(normalized, 'pt-BR') === 0)) {
    return { ok: false, message: 'Esta categoria já existe' };
  }
  const category: PosProductCategory = {
    id: uidCategory(),
    name: normalized,
    createdAt: new Date().toISOString(),
  };
  saveCategories([...list, category]);
  return { ok: true, category };
}

export function listProducts(opts?: { posId?: PosPointId; onlyActive?: boolean }): PosProduct[] {
  let list = loadProducts();
  if (opts?.onlyActive !== false) list = list.filter((p) => p.active);
  if (opts?.posId) list = list.filter((p) => p.posIds.includes(opts.posId!));
  return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function listAllProducts(): PosProduct[] {
  return loadProducts().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function upsertProduct(input: {
  id?: string;
  name: string;
  price: number;
  category: PosProduct['category'];
  posIds: PosPointId[];
  active?: boolean;
}): { ok: true; product: PosProduct } | { ok: false; message: string } {
  const name = input.name.trim();
  if (!name) return { ok: false, message: 'Informe o nome do produto' };
  if (!(input.price > 0)) return { ok: false, message: 'Preço inválido' };
  if (!input.posIds.length) return { ok: false, message: 'Selecione ao menos um PDV' };
  const list = loadProducts();
  const now = new Date().toISOString();
  if (input.id) {
    const i = list.findIndex((p) => p.id === input.id);
    if (i < 0) return { ok: false, message: 'Produto não encontrado' };
    list[i] = {
      ...list[i],
      name,
      price: input.price,
      category: input.category,
      posIds: input.posIds,
      active: input.active ?? list[i].active,
      updatedAt: now,
    };
    saveProducts(list);
    return { ok: true, product: list[i] };
  }
  const product: PosProduct = {
    id: uid(),
    name,
    price: input.price,
    category: input.category,
    posIds: input.posIds,
    active: input.active ?? true,
    createdAt: now,
    updatedAt: now,
  };
  list.push(product);
  saveProducts(list);
  return { ok: true, product };
}

export function deleteProduct(id: string): { ok: true } | { ok: false; message: string } {
  const list = loadProducts();
  if (!list.some((p) => p.id === id)) return { ok: false, message: 'Produto não encontrado' };
  saveProducts(list.filter((p) => p.id !== id));
  return { ok: true };
}

export function getPosName(id: PosPointId | string): string {
  return POS_POINTS.find((p) => p.id === id)?.name || id;
}
