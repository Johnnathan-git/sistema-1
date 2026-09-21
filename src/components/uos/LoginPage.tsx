import { useState } from 'react';
import { ClipboardCheck, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { bootstrapAdmin, isBootstrapMode, login } from '@/lib/auth-store';

export function LoginPage({ onLoggedIn }: { onLoggedIn: () => void }) {
  const bootstrap = isBootstrapMode();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (bootstrap) {
        const res = bootstrapAdmin(email, password, name);
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        toast.success('Administrador criado — bem-vindo');
        onLoggedIn();
        return;
      }
      const res = login(email, password);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(`Olá, ${res.session.displayName}`);
      onLoggedIn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#eef1f6] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white mb-4 shadow-lg">
            <ClipboardCheck className="w-7 h-7" />
          </div>
          <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight">
            Auditoria e Conciliação Hotéis
          </h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Acesso restrito · UOS Property Management
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
        >
          {bootstrap && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900 flex gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Primeiro acesso: cadastre o <strong>administrador</strong> do sistema. Depois você
                gerencia usuários em <strong>Acessos</strong>.
              </span>
            </div>
          )}

          {bootstrap && (
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase text-slate-400">Nome</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="w-full h-10 rounded-lg border border-slate-200 px-3 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </label>
          )}

          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase text-slate-400">E-mail</span>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full h-10 rounded-lg border border-slate-200 pl-9 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase text-slate-400">Senha</span>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                autoComplete={bootstrap ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="w-full h-10 rounded-lg border border-slate-200 pl-9 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 rounded-xl bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {bootstrap ? 'Criar administrador e entrar' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-400 mt-6">
          Usuários e permissões são gerenciados no módulo Acessos após o login.
        </p>
      </div>
    </div>
  );
}
