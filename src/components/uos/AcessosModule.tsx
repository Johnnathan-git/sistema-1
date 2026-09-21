import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserPlus, X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AUTH_MODULES,
  type AuthModuleKey,
  type AuthUser,
  type HotelPerm,
  createUser,
  deleteUser,
  getSession,
  listUsers,
  updateUser,
} from '@/lib/auth-store';

const HOTEL_OPTIONS: { key: HotelPerm; label: string }[] = [
  { key: 'all', label: 'Todos os hotéis' },
  { key: 'santa-eliza', label: 'Santa Eliza' },
  { key: 'varshana', label: 'Varshana' },
];

const MODULE_OPTIONS = AUTH_MODULES.filter((m) => m.key !== 'acessos');

function formatDateBR(iso?: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

export function AcessosModule() {
  const session = getSession();
  const [tick, setTick] = useState(0);
  const users = useMemo(() => listUsers(), [tick]);
  const [formOpen, setFormOpen] = useState(false);
  const [editUser, setEditUser] = useState<AuthUser | null>(null);
  const [resetUser, setResetUser] = useState<AuthUser | null>(null);

  if (!session?.isAdmin) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
        <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-[15px] font-semibold text-slate-800">Acesso restrito</p>
        <p className="text-[13px] text-slate-500 mt-1">
          Apenas administradores podem gerenciar usuários e permissões.
        </p>
      </div>
    );
  }

  const refresh = () => setTick((t) => t + 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-slate-900">Usuários do sistema</p>
          <p className="text-[12px] text-slate-500">
            Cadastre e-mail, senha e permissões de módulo / hotel.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditUser(null);
            setFormOpen(true);
          }}
          className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-semibold inline-flex items-center gap-1.5 hover:bg-slate-800"
        >
          <Plus className="w-3.5 h-3.5" /> Novo usuário
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b bg-slate-50/80 text-[10px] uppercase text-slate-400">
                <th className="px-4 py-3 text-left font-semibold">E-mail</th>
                <th className="px-4 py-3 text-left font-semibold">Nome</th>
                <th className="px-4 py-3 text-left font-semibold">Papel</th>
                <th className="px-4 py-3 text-left font-semibold">Permissões</th>
                <th className="px-4 py-3 text-left font-semibold">Hotéis</th>
                <th className="px-4 py-3 text-left font-semibold">Criado</th>
                <th className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className={cn('hover:bg-slate-50/60', !u.active && 'opacity-50')}>
                  <td className="px-4 py-3 font-medium text-slate-900">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600">{u.displayName || '—'}</td>
                  <td className="px-4 py-3">
                    {u.isAdmin ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-900 text-white">
                        <ShieldCheck className="w-3 h-3" /> Admin
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-medium">Usuário</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.isAdmin ? (
                      <span className="text-[11px] text-slate-400">Todos os módulos</span>
                    ) : u.permissions.length === 0 ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {u.permissions.map((p) => (
                          <span
                            key={p}
                            className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                          >
                            {AUTH_MODULES.find((m) => m.key === p)?.label ?? p}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-500">
                    {u.isAdmin || u.hotels.includes('all')
                      ? 'Todos'
                      : u.hotels
                          .map((h) => HOTEL_OPTIONS.find((x) => x.key === h)?.label ?? h)
                          .join(', ')}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-400 tabular-nums">
                    {formatDateBR(u.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => {
                          setEditUser(u);
                          setFormOpen(true);
                        }}
                        className="h-8 w-8 rounded-lg border text-slate-500 hover:bg-slate-50 inline-flex items-center justify-center"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Resetar senha"
                        onClick={() => setResetUser(u)}
                        className="h-8 w-8 rounded-lg border text-slate-500 hover:bg-slate-50 inline-flex items-center justify-center"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Excluir"
                        onClick={() => {
                          if (!confirm(`Excluir ${u.email}?`)) return;
                          const res = deleteUser(u.id, session.userId);
                          if (!res.ok) toast.error(res.message);
                          else {
                            toast.success('Usuário excluído');
                            refresh();
                          }
                        }}
                        className="h-8 w-8 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-[13px]">
                    Nenhum usuário cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <UserFormModal
          user={editUser}
          onClose={() => {
            setFormOpen(false);
            setEditUser(null);
          }}
          onSaved={refresh}
        />
      )}
      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => setResetUser(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function UserFormModal({
  user,
  onClose,
  onSaved,
}: {
  user: AuthUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!user;
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [isAdmin, setIsAdmin] = useState(user?.isAdmin ?? false);
  const [perms, setPerms] = useState<AuthModuleKey[]>(user?.permissions ?? ['auditoria']);
  const [hotels, setHotels] = useState<HotelPerm[]>(
    user?.hotels?.length ? user.hotels : ['all'],
  );

  const save = () => {
    if (isEdit && user) {
      const res = updateUser({
        userId: user.id,
        displayName,
        isAdmin,
        permissions: perms,
        hotels,
        password: password || undefined,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success('Usuário atualizado');
    } else {
      const res = createUser({
        email,
        password,
        displayName,
        isAdmin,
        permissions: perms,
        hotels,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success('Usuário criado');
    }
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-slate-500" />
            <p className="font-semibold text-[14px]">{isEdit ? 'Editar usuário' : 'Novo usuário'}</p>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          {!isEdit ? (
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase text-slate-400">E-mail</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px]"
                placeholder="usuario@empresa.com"
              />
            </label>
          ) : (
            <div>
              <span className="text-[10px] font-semibold uppercase text-slate-400">E-mail</span>
              <p className="text-[13px] font-medium text-slate-800 mt-0.5">{user?.email}</p>
            </div>
          )}
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase text-slate-400">Nome</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px]"
              placeholder="Nome de exibição"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase text-slate-400">
              {isEdit ? 'Nova senha (opcional)' : 'Senha'}
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px]"
              placeholder="Mínimo 6 caracteres"
            />
          </label>
          <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="mt-0.5"
            />
            <div>
              <p className="text-[13px] font-semibold text-slate-900">Administrador</p>
              <p className="text-[11px] text-slate-500">
                Acesso total, incluindo o módulo Acessos.
              </p>
            </div>
          </label>
          {!isAdmin && (
            <>
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-400 mb-2">
                  Módulos liberados
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {MODULE_OPTIONS.map((m) => {
                    const checked = perms.includes(m.key);
                    return (
                      <label
                        key={m.key}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-[12px] cursor-pointer hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setPerms((prev) =>
                              e.target.checked
                                ? [...prev, m.key]
                                : prev.filter((p) => p !== m.key),
                            );
                          }}
                        />
                        {m.label}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-400 mb-2">
                  Hotéis (Auditoria)
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {HOTEL_OPTIONS.map((h) => {
                    const checked = hotels.includes(h.key);
                    return (
                      <label
                        key={h.key}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-[12px] cursor-pointer hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (h.key === 'all') {
                              setHotels(e.target.checked ? ['all'] : []);
                              return;
                            }
                            setHotels((prev) => {
                              const withoutAll = prev.filter((x) => x !== 'all');
                              if (e.target.checked) return [...withoutAll, h.key];
                              return withoutAll.filter((x) => x !== h.key);
                            });
                          }}
                        />
                        {h.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border text-[13px]">
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            className="h-9 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordModal({
  user,
  onClose,
  onSaved,
}: {
  user: AuthUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl border overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <p className="font-semibold text-[14px]">Resetar senha</p>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-[12px] text-slate-500">{user.email}</p>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase text-slate-400">Nova senha</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px]"
              placeholder="Mínimo 6 caracteres"
            />
          </label>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border text-[13px]">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              const res = updateUser({ userId: user.id, password });
              if (!res.ok) {
                toast.error(res.message);
                return;
              }
              toast.success('Senha atualizada');
              onSaved();
              onClose();
            }}
            className="h-9 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
