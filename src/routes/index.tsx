import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/uos/AppShell';
import { ReceptionModule } from '@/components/uos/ReceptionModule';
import { AccountsModule } from '@/components/uos/AccountsModule';
import { ReservationsModule } from '@/components/uos/ReservationsModule';
import { GovernanceModule } from '@/components/uos/GovernanceModule';
import { AuditoriaLifeModule } from '@/components/uos/AuditoriaLifeModule';
import { MediaCenterModule } from '@/components/uos/MediaCenterModule';
import { ProductsModule } from '@/components/uos/ProductsModule';
import { usePms } from '@/lib/pms-store';
import { Toaster } from 'sonner';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'UOS — Sistema Financeiro e Hoteleiro' },
      { name: 'description', content: 'Gestão financeira, operacional e de auditoria hoteleira.' },
      { property: 'og:title', content: 'UOS — Sistema Financeiro e Hoteleiro' },
      { property: 'og:description', content: 'Gestão financeira, operacional e de auditoria hoteleira.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <Toaster richColors position="top-right" />
      <AppShell>
        <ModuleSwitch />
      </AppShell>
    </>
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
    case 'cartoes':
      return <MediaCenterModule />;
    case 'produtos':
      return <ProductsModule />;
    case 'acessos':
      return (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <p className="text-[15px] font-semibold text-slate-800">Módulo desativado</p>
          <p className="text-[13px] text-slate-500 mt-1">
            Acessos está temporariamente desligado.
          </p>
        </div>
      );
    default:
      return <ReceptionModule />;
  }
}
