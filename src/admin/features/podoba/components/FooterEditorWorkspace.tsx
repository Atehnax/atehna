'use client';

import { useState, type CSSProperties } from 'react';
import { ExternalLink, Eye, Info, Redo2, Undo2 } from 'lucide-react';
import SiteFooter, { type SiteFooterEditorAdapter } from '@/commercial/components/SiteFooter';
import { SiteLogo, SiteLogoProvider, useSiteLogoConfig } from '@/commercial/components/SiteLogo';
import type { HomepageFooterSettings } from '@/shared/domain/landing/landingPage';
import type { PublishedSiteLogoConfig } from '@/shared/domain/logo/logoLibrary';
import { AdminSaveStatus } from '@/shared/ui/admin-save-status';
import { AdminSwitch } from '@/shared/ui/admin-switch';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { SegmentedControl } from '@/shared/ui/segmented';
import { adminTableNeutralIconButtonClassName, adminTablePrimaryButtonClassName } from '@/shared/ui/admin-table/standards';
import { adminEditorPreviewContentTokenClasses, adminEditorPreviewFrameTokenClasses } from '@/shared/ui/theme/tokens';
import { useFooterHistory } from '../lib/useFooterHistory';
import LogoPlacementSelector from './LogoPlacementSelector';
import AppearanceDeviceSelector from './AppearanceDeviceSelector';
import { AppearanceEditorNumberInput } from './AppearanceEditorToolbarPrimitives';
import { adminNumberInputClassName } from '@/shared/ui/admin-controls/adminCompactFieldStyles';
import styles from './FooterEditorWorkspace.module.css';

const activeSegmentClassName = '!bg-[color:var(--blue-500)] !text-white';

const devices = [
  { id: 'desktop', label: 'Namizje', purpose: 'footer-desktop', hint: '1025 px in več' },
  { id: 'tablet', label: 'Tablica', purpose: 'footer-tablet', hint: '768–1024 px' },
  { id: 'mobile', label: 'Mobilno', purpose: 'footer-mobile', hint: 'Do 767 px' }
] as const;
type Device = typeof devices[number]['id'];

export default function FooterEditorWorkspace({
  footer, adapter, previewStyle, isDirty, isSaving, onSave, onAddColumn, onChange, historyResetKey
}: {
  footer: HomepageFooterSettings;
  adapter: SiteFooterEditorAdapter;
  previewStyle: CSSProperties;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onAddColumn: () => void;
  onChange: (updates: Partial<HomepageFooterSettings>) => void;
  historyResetKey: string;
}) {
  const [device, setDevice] = useState<Device>('desktop');
  const [mode, setMode] = useState('edit');
  const savedLogos = useSiteLogoConfig();
  const [adoptedLogos, setAdoptedLogos] = useState<PublishedSiteLogoConfig | null>(null);
  const [previewLogos, setPreviewLogos] = useState<PublishedSiteLogoConfig | null>(null);
  const logos = previewLogos ?? (adoptedLogos && adoptedLogos.revision >= savedLogos.revision ? adoptedLogos : savedLogos);
  const history = useFooterHistory(footer, onChange, historyResetKey);
  const activeDevice = devices.find((entry) => entry.id === device)!;
  const selectedLogo = logos.placements[activeDevice.purpose];
  const editing = mode === 'edit';
  const hiddenPreview = !footer.visible || (!footer.upperSectionVisible && !footer.lowerSectionVisible);

  return (
    <SiteLogoProvider config={logos} previewDevice={device}>
      <section className="min-w-0 space-y-4" data-testid="site-footer-links-editor" aria-labelledby="footer-workspace-heading">
        <div className={styles.card}>
          <div className={styles.heading}>
            <div>
              <h2 id="footer-workspace-heading" className="text-lg font-semibold text-slate-900">Noga spletnega mesta</h2>
              <p className="mt-1 text-sm text-slate-500">Uredite vsebino, razporeditev in prikaz noge na javnih straneh.</p>
            </div>
            <div className={styles.actions}>
              <AdminSaveStatus dirty={isDirty} saving={isSaving} />
              <IconButton type="button" size="sm" tone="neutral" className={adminTableNeutralIconButtonClassName}
                aria-label="Razveljavi spremembo noge" title="Razveljavi spremembo noge" disabled={!history.canUndo || isSaving} onClick={history.undo}>
                <Undo2 aria-hidden="true" className="h-4 w-4" />
              </IconButton>
              <IconButton type="button" size="sm" tone="neutral" className={adminTableNeutralIconButtonClassName}
                aria-label="Uveljavi spremembo noge" title="Uveljavi spremembo noge" disabled={!history.canRedo || isSaving} onClick={history.redo}>
                <Redo2 aria-hidden="true" className="h-4 w-4" />
              </IconButton>
              <Button type="button" variant="primary" size="toolbar" className={adminTablePrimaryButtonClassName}
                disabled={!isDirty || isSaving} onClick={onSave}>Shrani spremembe</Button>
            </div>
          </div>
          <div className={styles.deviceRow}>
            <div className={styles.deviceChoice}>
              <AppearanceDeviceSelector value={device} ariaLabel="Naprava za predogled noge"
                onChange={(nextDevice) => { setPreviewLogos(null); setDevice(nextDevice); }} />
              <span className={styles.deviceHint}>{activeDevice.hint}</span>
            </div>
            <div className={styles.visibility}>
              <div><span className="block text-xs font-semibold text-slate-700">Prikaži nogo</span><span className="text-[11px] text-slate-500">Vidna na javnih straneh</span></div>
              <AdminSwitch checked={footer.visible} ariaLabel="Prikaži nogo" onChange={(visible) => onChange({ visible })} />
            </div>
          </div>
          <div className={styles.settingsRow}>
            <div className={styles.logoSettings}>
              <div className={styles.logoThumbnail} aria-label="Izbrani logotip noge">
                {selectedLogo ? <SiteLogo purposeId={activeDevice.purpose} className="!h-9 !max-w-24" alt="" /> : <span className="text-[11px] text-slate-400">Brez logotipa</span>}
              </div>
              <LogoPlacementSelector key={activeDevice.purpose} purpose={activeDevice.purpose} toolbar
                onPreview={setPreviewLogos} onAssigned={(next) => { setAdoptedLogos(next); setPreviewLogos(null); }} />
              <label className={styles.logoHeight} title={`Največja višina logotipa · ${activeDevice.label}. Razmerje stranic se ohrani.`}>
                <span>Višina</span>
                <span className={styles.logoHeightControl}>
                  <AppearanceEditorNumberInput key={device} aria-label="Višina logotipa v nogi" min={8} max={160} step={1}
                    value={footer.responsive[device].logoHeightPx ?? 40} disabled={!selectedLogo}
                    className={`h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-right text-[11px] text-slate-700 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-slate-400 ${adminNumberInputClassName}`}
                    onValueChange={(logoHeightPx) => {
                      if (logoHeightPx === (footer.responsive[device].logoHeightPx ?? 40)) return;
                      onChange({ responsive: { ...footer.responsive, [device]: { ...footer.responsive[device], logoHeightPx } } });
                    }} />
                  <span aria-hidden="true" className="inline-flex h-full min-w-[26px] items-center justify-center border-l border-slate-200 bg-slate-50 px-1.5 text-[11px] text-slate-500">px</span>
                </span>
              </label>
            </div>
            <fieldset aria-label="Vidnost delov noge" className={styles.sectionSwitches}>
              <legend className="sr-only">Vidnost delov noge</legend>
              <div className={styles.visibility}><span>Zgornji del</span><AdminSwitch checked={footer.upperSectionVisible} ariaLabel="Prikaži zgornji del" onChange={(upperSectionVisible) => onChange({ upperSectionVisible })} /></div>
              <div className={styles.visibility}><span>Spodnji del</span><AdminSwitch checked={footer.lowerSectionVisible} ariaLabel="Prikaži spodnji del" onChange={(lowerSectionVisible) => onChange({ lowerSectionVisible })} /></div>
              <div className={styles.visibility} title="Kontakt v spodnjem delu se uporablja, ko je zgornji del skrit in spodnji del viden."><span>Kontakt spodaj</span><AdminSwitch checked={footer.lowerContactVisible} ariaLabel="Prikaži kontakt v spodnjem delu" disabled={footer.upperSectionVisible || !footer.lowerSectionVisible} onChange={(lowerContactVisible) => onChange({ lowerContactVisible })} /></div>
            </fieldset>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.heading}>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Vsebina noge</h3>
              <p className="mt-1 text-sm text-slate-500">{editing ? 'Kliknite besedilo za urejanje. Stolpce in povezave povlecite za spremembo vrstnega reda.' : 'Predogled noge z vašimi trenutnimi spremembami.'}</p>
            </div>
            <div className={styles.actions}>
              <Button type="button" variant="primary" size="toolbar" className={adminTablePrimaryButtonClassName}
                aria-label="Dodaj stolpec v nogo" disabled={!editing || footer.columns.length >= 6} onClick={onAddColumn}>
                Dodaj stolpec
              </Button>
              <div role="group" aria-label="Način prikaza noge">
                <SegmentedControl value={mode} onChange={setMode} size="sm" options={[{ value: 'edit', label: 'Urejanje', activeClassName: activeSegmentClassName }, { value: 'preview', label: 'Predogled', activeClassName: activeSegmentClassName }]} />
              </div>
              <IconButton href="/" target="_blank" rel="noopener noreferrer" size="sm" tone="neutral" className={adminTableNeutralIconButtonClassName}
                aria-label="Odpri spletno stran" title="Odpri shranjeno spletno stran v novem zavihku"><ExternalLink className="h-4 w-4" aria-hidden="true" /></IconButton>
            </div>
          </div>
          <div className={styles.canvasViewport}>
            <div data-testid="site-footer-editor-preview" data-admin-editor-preview-frame="true" data-storefront-theme="true"
              data-footer-editor-device={device} data-footer-editor-mode={mode}
              className={`storefront-theme-preview site-page-surface ${adminEditorPreviewFrameTokenClasses} ${styles.canvas}`}
              style={{ ...previewStyle, '--site-gutter': 'clamp(var(--site-gutter-min), 4cqw, var(--site-gutter-max))', '--footer-editor-columns': footer.responsive[device].layoutColumns } as CSSProperties}
              onClickCapture={(event) => {
                // Preview links must not navigate away from an unsaved editor.
                if ((event.target as HTMLElement).closest('a')) event.preventDefault();
              }}>
              {!editing && hiddenPreview ? <div className={styles.emptyPreview}><Eye className="h-5 w-5" aria-hidden="true" /><p>Noga je skrita na spletni strani.</p><span>Vključite prikaz noge in vsaj en njen del.</span></div> :
                <SiteFooter settings={footer} editorAdapter={editing ? adapter : undefined} previewDevice={device}
                  containerClassName={`site-container ${adminEditorPreviewContentTokenClasses}`} />}
            </div>
          </div>
        </div>
        <p className="flex items-center gap-2 px-1 text-xs text-slate-500"><Info className="h-4 w-4 shrink-0" aria-hidden="true" />Spremembe so takoj vidne v predogledu. Na spletni strani se prikažejo po shranjevanju.</p>
      </section>
    </SiteLogoProvider>
  );
}
