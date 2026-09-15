import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/uos/AppShell';
import { ReceptionModule } from '@/components/uos/ReceptionModule';
import { AccountsModule } from '@/components/uos/AccountsModule';
import { ReservationsModule } from '@/components/uos/ReservationsModule';
import { GovernanceModule } from '@/components/uos/GovernanceModule';
import { PmsProvider, usePms } from '@/lib/pms-store';
import { Toaster } from 'sonner';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  return (
    <PmsProvider>
      <Toaster richColors position="top-right" />
      <AppShell>
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
    default:
      return <ReceptionModule />;
  }
}
