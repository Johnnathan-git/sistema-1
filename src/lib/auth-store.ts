/**
 * Auth local (localStorage) — espelha o fluxo Acessos do MINHA USINA
 * sem Supabase. Não altera o projeto usinadosirmaos.
 */
export type AuthModuleKey =
  | 'recepcao'
  | 'contas'
  | 'reservas'
  | 'governanca'
  | 'auditoria'
  | 'auditoria_pendencias'
  | 'cartoes'
  | 'venda'
  | 'produtos'
  | 'acessos';

export const AUTH_MODULES: { key: AuthModuleKey; label: string }[] = [
  { key: 'recepcao', label: 'Recepção' },
  { key: 'contas', label: 'Contas' },
  { key: 'reservas', label: 'Reservas' },
  { key: 'governanca', label: 'Governança' },
  { key: 'auditoria', label: 'Auditoria Life (completo)' },
  { key: 'auditoria_pendencias', label: 'Auditoria Life — só Pendências' },
  { key: 'cartoes', label: 'Central de Mídias' },
  { key: 'venda', label: 'Venda' },
  { key: 'produtos', label: 'Produtos' },
];

export type HotelPerm = 'santa-eliza' | 'varshana' | 'all';

export interface AuthUser {
  id: string;
  email: string;
  /** Hash simples — não usar em produção real */
  passwordHash: string;
  displayName: string;
  isAdmin: boolean;
  permissions: AuthModuleKey[];
  hotels: HotelPerm[];
  createdAt: string;
  active: boolean;
}

export interface AuthSession {
  userId: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  permissions: AuthModuleKey[];
  hotels: HotelPerm[];
  loggedAt: string;
}

const LS_USERS = 'uos-auth-users-v1';
const LS_SESSION = 'uos-auth-session-v1';

/** Hash leve só para não gravar senha em texto puro no localStorage */
export function hashPassword(password: string): string {
  let h = 5381;
  const s = `uos|${password}|v1`;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  let h2 = 0;
  const hex = (h >>> 0).toString(16);
  for (let i = 0; i < hex.length; i++) h2 = (h2 << 5) - h2 + hex.charCodeAt(i);
  return `h1_${(h >>> 0).toString(16)}_${(h2 >>> 0).toString(16)}`;
}

function loadUsers(): AuthUser[] {
  try {
    const raw = localStorage.getItem(LS_USERS);
    if (raw) {
      const parsed = JSON.parse(raw) as AuthUser[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveUsers(users: AuthUser[]) {
  localStorage.setItem(LS_USERS, JSON.stringify(users));
}

export function listUsers(): AuthUser[] {
  return loadUsers().sort((a, b) => a.email.localeCompare(b.email));
}

/** Usuários ativos (para atribuir responsável em divergências) */
export function listActiveUsers(): AuthUser[] {
  return listUsers().filter((u) => u.active);
}

export function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(LS_SESSION);
    if (!raw) return null;
    const s = JSON.parse(raw) as AuthSession;
    if (!s?.userId) return null;
    const u = loadUsers().find((x) => x.id === s.userId);
    if (!u || !u.active) {
      localStorage.removeItem(LS_SESSION);
      return null;
    }
    return {
      userId: u.id,
      email: u.email,
      displayName: u.displayName || u.email.split('@')[0],
      isAdmin: u.isAdmin,
      permissions: u.isAdmin ? AUTH_MODULES.map((m) => m.key) : u.permissions,
      hotels: u.isAdmin || u.hotels.includes('all') ? ['all'] : u.hotels,
      loggedAt: s.loggedAt,
    };
  } catch {
    return null;
  }
}

export function login(email: string, password: string): { ok: true; session: AuthSession } | { ok: false; message: string } {
  const mail = email.trim().toLowerCase();
  if (!mail || !password) return { ok: false, message: 'Informe e-mail e senha' };
  const users = loadUsers();
  const u = users.find((x) => x.email === mail);
  if (!u) return { ok: false, message: 'E-mail ou senha inválidos' };
  if (!u.active) return { ok: false, message: 'Usuário desativado' };
  if (u.passwordHash !== hashPassword(password)) return { ok: false, message: 'E-mail ou senha inválidos' };
  const session: AuthSession = {
    userId: u.id,
    email: u.email,
    displayName: u.displayName || u.email.split('@')[0],
    isAdmin: u.isAdmin,
    permissions: u.isAdmin ? AUTH_MODULES.map((m) => m.key) : u.permissions,
    hotels: u.isAdmin || u.hotels.includes('all') ? ['all'] : u.hotels,
    loggedAt: new Date().toISOString(),
  };
  localStorage.setItem(LS_SESSION, JSON.stringify(session));
  return { ok: true, session };
}

export function logout() {
  localStorage.removeItem(LS_SESSION);
}

export function isBootstrapMode(): boolean {
  return loadUsers().length === 0;
}

/** Cria o primeiro administrador (só quando não há usuários) */
export function bootstrapAdmin(email: string, password: string, displayName: string): { ok: true } | { ok: false; message: string } {
  if (!isBootstrapMode()) return { ok: false, message: 'Já existem usuários cadastrados' };
  const mail = email.trim().toLowerCase();
  if (!mail || !/^\S+@\S+\.\S+$/.test(mail)) return { ok: false, message: 'E-mail inválido' };
  if (password.length < 6) return { ok: false, message: 'Senha mínima de 6 caracteres' };
  const user: AuthUser = {
    id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    email: mail,
    passwordHash: hashPassword(password),
    displayName: displayName.trim() || mail.split('@')[0],
    isAdmin: true,
    permissions: AUTH_MODULES.map((m) => m.key),
    hotels: ['all'],
    createdAt: new Date().toISOString(),
    active: true,
  };
  saveUsers([user]);
  login(mail, password);
  return { ok: true };
}

export function createUser(input: {
  email: string;
  password: string;
  displayName?: string;
  isAdmin: boolean;
  permissions: AuthModuleKey[];
  hotels: HotelPerm[];
}): { ok: true; id: string } | { ok: false; message: string } {
  const mail = input.email.trim().toLowerCase();
  if (!mail || !/^\S+@\S+\.\S+$/.test(mail)) return { ok: false, message: 'E-mail inválido' };
  if (input.password.length < 6) return { ok: false, message: 'Senha mínima de 6 caracteres' };
  const users = loadUsers();
  if (users.some((u) => u.email === mail)) return { ok: false, message: 'E-mail já cadastrado' };
  const user: AuthUser = {
    id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    email: mail,
    passwordHash: hashPassword(input.password),
    displayName: (input.displayName || '').trim() || mail.split('@')[0],
    isAdmin: input.isAdmin,
    permissions: input.isAdmin ? AUTH_MODULES.map((m) => m.key) : input.permissions,
    hotels: input.isAdmin ? ['all'] : input.hotels.length ? input.hotels : ['all'],
    createdAt: new Date().toISOString(),
    active: true,
  };
  users.push(user);
  saveUsers(users);
  return { ok: true, id: user.id };
}

export function updateUser(input: {
  userId: string;
  displayName?: string;
  isAdmin?: boolean;
  permissions?: AuthModuleKey[];
  hotels?: HotelPerm[];
  password?: string;
  active?: boolean;
}): { ok: true } | { ok: false; message: string } {
  const users = loadUsers();
  const i = users.findIndex((u) => u.id === input.userId);
  if (i < 0) return { ok: false, message: 'Usuário não encontrado' };
  const u = { ...users[i] };
  if (input.displayName !== undefined) u.displayName = input.displayName.trim() || u.email.split('@')[0];
  if (input.isAdmin !== undefined) u.isAdmin = input.isAdmin;
  if (input.permissions !== undefined) u.permissions = input.isAdmin || u.isAdmin ? AUTH_MODULES.map((m) => m.key) : input.permissions;
  if (input.hotels !== undefined) u.hotels = input.isAdmin || u.isAdmin ? ['all'] : input.hotels;
  if (input.password && input.password.length >= 6) u.passwordHash = hashPassword(input.password);
  if (input.password && input.password.length > 0 && input.password.length < 6) {
    return { ok: false, message: 'Senha mínima de 6 caracteres' };
  }
  if (input.active !== undefined) u.active = input.active;
  if (u.isAdmin) {
    u.permissions = AUTH_MODULES.map((m) => m.key);
    u.hotels = ['all'];
  }
  users[i] = u;
  saveUsers(users);
  const sess = getSession();
  if (sess && sess.userId === u.id) {
    localStorage.setItem(
      LS_SESSION,
      JSON.stringify({
        ...sess,
        displayName: u.displayName,
        isAdmin: u.isAdmin,
        permissions: u.isAdmin ? AUTH_MODULES.map((m) => m.key) : u.permissions,
        hotels: u.isAdmin || u.hotels.includes('all') ? ['all'] : u.hotels,
      }),
    );
  }
  return { ok: true };
}

export function deleteUser(userId: string, currentUserId: string): { ok: true } | { ok: false; message: string } {
  if (userId === currentUserId) return { ok: false, message: 'Você não pode excluir sua própria conta' };
  const users = loadUsers().filter((u) => u.id !== userId);
  saveUsers(users);
  return { ok: true };
}

export function canAccessModule(session: AuthSession | null, module: AuthModuleKey | string): boolean {
  // Módulo Acessos desativado até segunda ordem
  if (module === 'acessos') return false;
  // Sem sessão = acesso aberto (login desativado)
  if (!session) return true;
  if (session.isAdmin) return true;
  // Nav "Auditoria Life" libera com permissão completa OU só-pendências
  if (module === 'auditoria') {
    return (
      session.permissions.includes('auditoria') ||
      session.permissions.includes('auditoria_pendencias')
    );
  }
  return session.permissions.includes(module as AuthModuleKey);
}

/** Hotel só resolve pendências (sem abrir auditoria / histórico / conciliação) */
export function isAuditPendenciasOnly(session: AuthSession | null): boolean {
  if (!session || session.isAdmin) return false;
  if (session.permissions.includes('auditoria')) return false;
  return session.permissions.includes('auditoria_pendencias');
}

/** Primeiro módulo liberado para o usuário (landing após login) */
export function firstAllowedModule(session: AuthSession | null): string {
  if (!session) return 'recepcao';
  if (session.isAdmin) return 'recepcao';
  const order: AuthModuleKey[] = [
    'recepcao',
    'contas',
    'reservas',
    'governanca',
    'cartoes',
    'venda',
    'produtos',
    'auditoria',
    'auditoria_pendencias',
  ];
  for (const m of order) {
    if (m === 'auditoria_pendencias') {
      if (session.permissions.includes('auditoria_pendencias') || session.permissions.includes('auditoria')) {
        return 'auditoria';
      }
      continue;
    }
    if (canAccessModule(session, m)) return m;
  }
  return 'recepcao';
}

export function canAccessHotel(session: AuthSession | null, hotelId: string): boolean {
  if (!session) return true;
  if (session.isAdmin || session.hotels.includes('all')) return true;
  return session.hotels.includes(hotelId as HotelPerm);
}
