import { useCallback, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/uos/AppShell';
import { ReceptionModule } from '@/components/uos/ReceptionModule';
import { AccountsModule } from '@/components/uos/AccountsModule';
import { ReservationsModule } from '@/components/uos/ReservationsModule';
import { GovernanceModule } from '@/components/uos/GovernanceModule';
import { AuditoriaLifeModule } from '@/components/uos/AuditoriaLifeModule';
import { AcessosModule } from '@/components/uos/AcessosModule';
import { LoginPage } from '@/components/uos/LoginPage';
import { PmsProvider, usePms } from '@/lib/pms-store';
import { getSession, type AuthSession } from '@/lib/auth-store';
import { Toaster } from 'sonner';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  const [session, setSession] = useState<AuthSession | null>(() => getSession());

  const refreshSession = useCallback(() => {
    setSession(getSession());
  }, []);

  if (!session) {
    return (
      <>
        <Toaster richColors position="top-right" />
        <LoginPage onLoggedIn={refreshSession} />
      </>
    );
  }

  return (
    <PmsProvider>
      <Toaster richColors position="top-right" />
      <AppShell onLogout={refreshSession}>
        <ModuleSwitch />
      </AppShell>
    </PmsProvider>
  );
}

function ModuleSwitch() {
  const { module } = usePms();
  switch (module) {
    case 'contas':
      return <AccountsModule />;
    case 'reservas':
      return <ReservationsModule />;
    case 'governanca':
      return <GovernanceModule />;
    case 'auditoria':
      return <AuditoriaLifeModule />;
    case 'acessos':
      return <AcessosModule />;
    default:
      return <ReceptionModule />;
  }
}
