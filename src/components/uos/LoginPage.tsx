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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      <div className="absolute inset-0 bg-[#0f172a]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-500/20 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-indigo-600/15 via-transparent to-transparent" />
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }}
      />

      <div className="relative w-full max-w-[420px] z-10">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 text-white mb-5 shadow-xl shadow-indigo-900/40">
            <ClipboardCheck className="w-7 h-7" />
          </div>
          <h1 className="text-[22px] font-semibold text-white tracking-tight">
            Auditoria e Conciliação Hotéis
          </h1>
          <p className="text-[13px] text-slate-400 mt-1.5">
            Acesso restrito · UOS Property Management
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-white/10 bg-white/[0.97] p-7 shadow-2xl shadow-black/30 space-y-4 backdrop-blur-xl"
        >
          {bootstrap && (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-3.5 py-3 text-[12px] text-amber-900 flex gap-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Primeiro acesso: cadastre o <strong>administrador</strong> do sistema. Depois você
                gerencia usuários em <strong>Acessos</strong>.
              </span>
            </div>
          )}

          {bootstrap && (
            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Nome
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="w-full h-11 rounded-xl border border-slate-200 px-3.5 text-[13px] outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all bg-white"
              />
            </label>
          )}

          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              E-mail
            </span>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full h-11 rounded-xl border border-slate-200 pl-10 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all bg-white"
              />
            </div>
          </label>

          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Senha
            </span>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                autoComplete={bootstrap ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="w-full h-11 rounded-xl border border-slate-200 pl-10 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all bg-white"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2 hover:from-slate-800 hover:to-slate-700 disabled:opacity-60 shadow-lg shadow-slate-900/20 transition-all mt-1"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {bootstrap ? 'Criar administrador e entrar' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-500 mt-7">
          Usuários e permissões são gerenciados no módulo Acessos após o login.
        </p>
      </div>
    </div>
  );
}
