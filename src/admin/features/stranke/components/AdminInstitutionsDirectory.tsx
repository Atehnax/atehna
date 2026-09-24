'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { INSTITUTION_DIRECTORY_VIEWS, isInstitutionDirectoryViewId, type InstitutionDirectoryViewId } from '@/shared/domain/institutionDirectory';
import type { SchoolDirectoryData } from '@/shared/domain/schoolDirectory';
import EuiTabs from '@/shared/ui/eui-tabs';
import LazyConfirmDialog from '@/shared/ui/confirm-dialog/lazy-confirm-dialog';
import { useToast } from '@/shared/ui/toast';
import AdminSchoolsTable from './AdminSchoolsTable';

export default function AdminInstitutionsDirectory({ directoryId, initialDirectory }: {
  directoryId: InstitutionDirectoryViewId;
  initialDirectory: SchoolDirectoryData;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const navigation = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [navigationState, setNavigationState] = useState({ dirty: false, saving: false });
  const [pendingTab, setPendingTab] = useState<InstitutionDirectoryViewId | null>(null);
  const directory = INSTITUTION_DIRECTORY_VIEWS.find(item => item.id === directoryId)!;

  useEffect(() => {
    const revealSelection = () => {
      const container = navigation.current;
      const selected = container?.querySelector('[aria-selected="true"]');
      if (!container || !selected) return;
      const outer = container.getBoundingClientRect(), inner = selected.getBoundingClientRect();
      if (inner.left < outer.left) container.scrollLeft -= outer.left - inner.left;
      else if (inner.right > outer.right) container.scrollLeft += inner.right - outer.right;
    };
    revealSelection();
    window.addEventListener('resize', revealSelection);
    return () => window.removeEventListener('resize', revealSelection);
  }, [directoryId]);

  const navigate = (next: InstitutionDirectoryViewId) => {
    startTransition(() => {
      router.push('/admin/stranke/sole-in-zavodi?tab=' + next, { scroll: false });
    });
  };
  const select = (next: string) => {
    if (!isInstitutionDirectoryViewId(next) || next === directoryId || isPending) return;
    if (navigationState.saving) {
      toast.info('Počakajte, da se spremembe shranijo.');
      return;
    }
    if (navigationState.dirty) setPendingTab(next);
    else navigate(next);
  };

  return (
    <div className="min-w-0 space-y-4">
      <div ref={navigation} className="overflow-x-auto">
        <EuiTabs
          ariaLabel="Vrste šol in zavodov"
          idPrefix="institution-directory"
          variant="secondary"
          className="min-w-max"
          tabClassName="max-w-[280px] whitespace-normal"
          value={directoryId}
          onChange={select}
          tabs={INSTITUTION_DIRECTORY_VIEWS.map(item => ({ value: item.id, label: item.label, panelId: 'institution-directory-panel' }))}
        />
      </div>
      <section
        id="institution-directory-panel"
        role="tabpanel"
        aria-labelledby={'institution-directory-tab-' + directoryId}
        aria-busy={isPending}
        className={isPending ? 'pointer-events-none opacity-60' : undefined}
      >
        {directory.fullTitles.length > 0 ? (
          <div className="mb-3 space-y-1 text-sm font-medium text-slate-700" aria-label="Polni nazivi seznamov">
            {directory.fullTitles.map(title => <p key={title}>{title}</p>)}
          </div>
        ) : null}
        <AdminSchoolsTable
          key={directoryId}
          directoryId={directoryId}
          directoryLabel={directory.label}
          initialDirectory={initialDirectory}
          onNavigationStateChange={setNavigationState}
        />
      </section>
      {pendingTab ? <LazyConfirmDialog
        open
        title="Zavrzi neshranjene spremembe?"
        description="Spremembe v vrstici še niso shranjene. Če odprete drug zavihek, bodo zavržene."
        confirmLabel="Zavrzi in nadaljuj"
        cancelLabel="Ostani v zavihku"
        onCancel={() => setPendingTab(null)}
        onConfirm={() => { const next = pendingTab; setPendingTab(null); navigate(next); }}
      /> : null}
    </div>
  );
}
