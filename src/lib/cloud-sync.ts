/**
 * Sincroniza todas as chaves "uos-*" do localStorage com o Lovable Cloud,
 * para que todos os aparelhos vejam os mesmos dados em tempo real.
 */
import { supabase } from '@/integrations/supabase/client';

const PREFIX = 'uos-';
const LOCAL_ONLY = new Set(['uos-auth-session-v1']);
export const SYNC_EVENT = 'uos-sync';

let started = false;
let readyPromise: Promise<void> | null = null;
let origSetItem: ((k: string, v: string) => void) | null = null;
let origRemoveItem: ((k: string) => void) | null = null;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const localWriteAt = new Map<string, number>();

function shouldSync(key: string) {
  return key.startsWith(PREFIX) && !LOCAL_ONLY.has(key);
}

function push(key: string, value: string | null) {
  const t = timers.get(key);
  if (t) clearTimeout(t);
  const writeAt = Date.now();
  localWriteAt.set(key, writeAt);
  timers.set(
    key,
    setTimeout(async () => {
      timers.delete(key);
      const updatedAt = new Date(writeAt).toISOString();
      if (value === null) {
        await supabase.from('app_state').delete().eq('key', key);
      } else {
        await supabase
          .from('app_state')
          .upsert({ key, value, updated_at: updatedAt });
      }
    }, 300),
  );
}

function applyRemote(key: string, value: string | null, remoteUpdatedAt?: string) {
  if (!shouldSync(key)) return;

  const remoteTime = remoteUpdatedAt ? Date.parse(remoteUpdatedAt) : NaN;
  const localTime = localWriteAt.get(key) || 0;

  // Nunca deixa uma versão remota mais antiga sobrescrever uma alteração
  // local que acabou de ser feita neste aparelho.
  if (Number.isFinite(remoteTime) && remoteTime < localTime) return;

  const pending = timers.get(key);
  if (pending) {
    clearTimeout(pending);
    timers.delete(key);
  }

  if (Number.isFinite(remoteTime)) localWriteAt.set(key, remoteTime);

  const current = localStorage.getItem(key);
  if (current === value) return;
  if (value === null) origRemoveItem?.(key);
  else origSetItem?.(key, value);
  window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { key } }));
}

export function startCloudSync(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    if (started) return;
    started = true;
    const ls = window.localStorage;
    origSetItem = ls.setItem.bind(ls);
    origRemoveItem = ls.removeItem.bind(ls);

    // Carrega estado do servidor
    const { data, error } = await supabase.from('app_state').select('key,value,updated_at');
    const remoteKeys = new Set<string>();
    if (!error && data) {
      for (const row of data) {
        remoteKeys.add(row.key);
        origSetItem(row.key, row.value);
      }
      // Dados locais que ainda não existem no servidor são enviados
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k && shouldSync(k) && !remoteKeys.has(k)) {
          const v = ls.getItem(k);
          if (v !== null) push(k, v);
        }
      }
    }

    ls.setItem = (k: string, v: string) => {
      const prev = ls.getItem(k);
      origSetItem!(k, v);
      if (shouldSync(k) && prev !== v) push(k, v);
    };
    ls.removeItem = (k: string) => {
      origRemoveItem!(k);
      if (shouldSync(k)) push(k, null);
    };

    supabase
      .channel('app_state_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const k = (payload.old as { key?: string }).key;
          if (k) applyRemote(k, null);
        } else {
          const row = payload.new as { key: string; value: string; updated_at?: string };
          applyRemote(row.key, row.value, row.updated_at);
        }
      })
      .subscribe();
  })();
  return readyPromise;
}

/** Hook utilitário: re-renderiza quando outro aparelho alterar dados */
export function onCloudSync(cb: (key: string) => void) {
  const h = (e: Event) => cb((e as CustomEvent<{ key: string }>).detail.key);
  window.addEventListener(SYNC_EVENT, h);
  return () => window.removeEventListener(SYNC_EVENT, h);
}
