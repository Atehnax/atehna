'use client';

import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, RotateCcw, Save } from 'lucide-react';
import {
  GLOBAL_STYLE_BUTTON_APPEARANCES,
  GLOBAL_STYLE_CARD_APPEARANCES,
  GLOBAL_STYLE_FONT_FAMILIES,
  GLOBAL_STYLE_FORM_APPEARANCES,
  GLOBAL_STYLE_LINK_UNDERLINES,
  GLOBAL_STYLE_SHADOW_SIZES,
  cloneDefaultGlobalStyleConfig,
  normalizeGlobalStyleConfig,
  toGlobalStyleCssVariables,
  toStoredGlobalStyleConfig,
  type GlobalStyleConfig
} from '@/shared/domain/style/globalStyle';
import { getWebsiteFontFamilyLabel } from '@/shared/domain/style/fontFamilies';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';
import { Button } from '@/shared/ui/button';
import {
  adminControlFocusTokenClasses,
  adminControlFocusWithinTokenClasses,
  adminInputFocusTokenClasses
} from '@/shared/ui/theme/tokens';
import { useToast } from '@/shared/ui/toast';
import AdminPodobaTabs from './AdminPodobaTabs';
import { AppearanceEditorNumberInput } from './AppearanceEditorToolbarPrimitives';

type GroupKey = Exclude<keyof GlobalStyleConfig, 'updatedAt'>;
type GlobalElementKey =
  | 'page'
  | 'content-column'
  | 'section'
  | 'responsive'
  | 'spacing-scale'
  | 'body-text'
  | 'headings'
  | 'paragraph'
  | 'link'
  | 'button'
  | 'form-field'
  | 'surface'
  | 'card'
  | 'border'
  | 'radii'
  | 'shadows'
  | 'accent'
  | 'statuses';

type GlobalElementDefinition = {
  value: GlobalElementKey;
  label: string;
  description: string;
};

const globalElementGroups: Array<{ label: string; items: GlobalElementDefinition[] }> = [
  {
    label: 'Struktura',
    items: [
      { value: 'page', label: 'Stran', description: 'Širina, ozadje in robovi strani' },
      { value: 'content-column', label: 'Besedilni stolpec', description: 'Berljiva širina vsebine' },
      { value: 'section', label: 'Sekcija', description: 'Navpični odmiki vsebinskih sklopov' },
      { value: 'responsive', label: 'Odzivnost', description: 'Prelomi med velikostmi zaslona' },
      { value: 'spacing-scale', label: 'Razmična lestvica', description: 'Skupni koraki notranjih odmikov' }
    ]
  },
  {
    label: 'Besedilo',
    items: [
      { value: 'body-text', label: 'Osnovno besedilo', description: 'Pisava in privzeta barva besedila' },
      { value: 'headings', label: 'Naslovi', description: 'Slogi naslovov H1, H2 in H3' },
      { value: 'paragraph', label: 'Odstavek', description: 'Velikost in ritem daljšega besedila' },
      { value: 'link', label: 'Povezava', description: 'Privzeto, hover in aktivno stanje' }
    ]
  },
  {
    label: 'Interakcije',
    items: [
      { value: 'button', label: 'Gumb', description: 'Videz, stanja in primarna barva' },
      { value: 'form-field', label: 'Vnosno polje', description: 'Polja obrazcev in fokusno stanje' }
    ]
  },
  {
    label: 'Površine',
    items: [
      { value: 'surface', label: 'Površina', description: 'Osnovna in zadržana površina' },
      { value: 'card', label: 'Kartica in panel', description: 'Ozadje, obroba, odmik in senca' },
      { value: 'border', label: 'Obroba in ločilo', description: 'Skupna barva in debelina črt' },
      { value: 'radii', label: 'Radiji elementov', description: 'Skupna lestvica zaobljenosti' },
      { value: 'shadows', label: 'Sence elementov', description: 'Majhna, srednja in velika elevacija' }
    ]
  },
  {
    label: 'Semantika',
    items: [
      { value: 'accent', label: 'Poudarek', description: 'Barva poudarjenih oznak' },
      { value: 'statuses', label: 'Statusna sporočila', description: 'Uspeh, opozorilo, nevarnost in informacija' }
    ]
  }
];

const globalElements = globalElementGroups.flatMap((group) => group.items);

const appearanceLabels = {
  filled: 'Poln',
  outline: 'Obroba',
  soft: 'Mehak',
  bordered: 'Z obrobo',
  elevated: 'Privzdignjen',
  flat: 'Raven',
  none: 'Brez',
  small: 'Majhna',
  medium: 'Srednja',
  large: 'Velika',
  never: 'Nikoli',
  hover: 'Ob prehodu',
  always: 'Vedno'
} as const;

const fieldClassName =
  `h-8 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 text-[12px] leading-[1.25] text-slate-800 font-['Inter',system-ui,sans-serif] transition placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:bg-white ${adminInputFocusTokenClasses}`;
const labelClassName = 'text-[11px] font-medium leading-4 text-slate-500';

function comparable(value: GlobalStyleConfig) {
  return JSON.stringify(toStoredGlobalStyleConfig(value));
}

function Field({
  label,
  hint,
  settingPath,
  children
}: {
  label: string;
  hint?: string;
  settingPath: string;
  children: ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1.5" data-global-style-setting={settingPath}>
      <span className={labelClassName}>{label}</span>
      {children}
      {hint ? <span className="text-[11px] leading-4 text-slate-500">{hint}</span> : null}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = 'px',
  hint,
  settingPath
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  hint?: string;
  settingPath: string;
}) {
  return (
    <Field label={label} hint={hint} settingPath={settingPath}>
      <span className={`flex h-8 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70 transition hover:border-slate-300 hover:bg-white focus-within:bg-white ${adminControlFocusWithinTokenClasses}`}>
        <AppearanceEditorNumberInput
          value={value}
          min={min}
          max={max}
          step={step}
          onValueChange={onChange}
          className={`min-w-0 flex-1 appearance-none border-0 bg-transparent px-2.5 text-[12px] text-slate-800 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${adminInputFocusTokenClasses}`}
        />
        <span className="grid min-w-8 place-items-center px-1.5 text-[11px] text-slate-400">
          {suffix}
        </span>
      </span>
    </Field>
  );
}

function ColorField({
  label,
  value,
  onChange,
  settingPath
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  settingPath: string;
}) {
  const [draft, setDraft] = useState(value);
  const isValidDraft = /^#[0-9A-F]{6}$/.test(draft);

  useEffect(() => setDraft(value), [value]);

  return (
    <fieldset className="grid min-w-0 gap-1.5 border-0 p-0" data-color-field={label} data-global-style-setting={settingPath}>
      <legend className={labelClassName}>{label}</legend>
      <span className={`flex h-8 min-w-0 items-center rounded-lg border bg-slate-50/70 transition hover:bg-white focus-within:bg-white ${adminControlFocusWithinTokenClasses} ${isValidDraft ? 'border-slate-200 hover:border-slate-300' : 'border-rose-300'}`}>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className={`ml-1 h-6 w-6 shrink-0 cursor-pointer appearance-none overflow-hidden rounded-md border-0 bg-transparent p-0 ring-1 ring-inset ring-slate-300/80 [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 ${adminInputFocusTokenClasses}`}
          aria-label={`${label}: izberi barvo`}
        />
        <input
          aria-label={`${label}: šestnajstiška vrednost`}
          aria-invalid={!isValidDraft}
          value={draft}
          maxLength={7}
          onChange={(event) => {
            const next = event.target.value.toUpperCase();
            setDraft(next);
            if (/^#[0-9A-F]{6}$/.test(next)) onChange(next);
          }}
          className={`min-w-0 flex-1 border-0 bg-transparent px-2 font-mono text-[12px] uppercase tracking-[0.02em] text-slate-700 ${adminInputFocusTokenClasses}`}
          spellCheck={false}
          autoCapitalize="characters"
        />
      </span>
      {!isValidDraft ? <span className="text-[10px] leading-4 text-rose-600">Uporabite zapis #RRGGBB.</span> : null}
    </fieldset>
  );
}

function SelectField<Value extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  settingPath
}: {
  label: string;
  value: Value;
  options: readonly Value[];
  onChange: (value: Value) => void;
  hint?: string;
  settingPath: string;
}) {
  return (
    <Field label={label} hint={hint} settingPath={settingPath}>
      <span className="relative block min-w-0">
        <select value={value} onChange={(event) => onChange(event.target.value as Value)} className={`${fieldClassName} appearance-none pr-8`}>
          {options.map((option) => (
            <option key={option} value={option}>{appearanceLabels[option as keyof typeof appearanceLabels] ?? getWebsiteFontFamilyLabel(option)}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      </span>
    </Field>
  );
}

function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">{children}</div>;
}

function SettingsSection({
  title,
  description,
  children
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3 first:pt-0 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-slate-100 [&:not(:first-child)]:pt-4">
      {title || description ? (
        <div>
          {title ? <h3 className="text-[12px] font-semibold text-slate-800">{title}</h3> : null}
          {description ? <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export default function AdminGlobalStylePageClient({ initialConfig }: { initialConfig: GlobalStyleConfig }) {
  const router = useRouter();
  const { toast } = useToast();
  const normalizedInitial = useMemo(() => normalizeGlobalStyleConfig(initialConfig), [initialConfig]);
  const [config, setConfig] = useState(normalizedInitial);
  const [savedConfig, setSavedConfig] = useState(normalizedInitial);
  const [activeElementKey, setActiveElementKey] = useState<GlobalElementKey>('page');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isSaving, setIsSaving] = useState(false);
  const isDirty = comparable(config) !== comparable(savedConfig);
  const activeElement = globalElements.find((element) => element.value === activeElementKey) ?? globalElements[0];
  const previewGutter = previewDevice === 'mobile'
    ? config.layout.gutterMobilePx
    : previewDevice === 'tablet'
      ? config.layout.gutterTabletPx
      : config.layout.gutterDesktopPx;
  const previewSectionSpace = previewDevice === 'mobile'
    ? config.spacing.sectionMobilePx
    : previewDevice === 'tablet'
      ? config.spacing.sectionTabletPx
      : config.spacing.sectionDesktopPx;
  const previewLayoutScale = 0.42;
  const previewVars = {
    ...toGlobalStyleCssVariables(config),
    '--site-global-content-width': `${Math.round(config.layout.contentWidthPx * previewLayoutScale)}px`,
    '--site-global-max-width': `${Math.round(config.layout.maxWidthPx * previewLayoutScale)}px`,
    '--site-gutter': `${previewGutter}px`,
    '--site-section-space-current': `${previewSectionSpace}px`
  } as CSSProperties;

  function updateGroup<Key extends GroupKey>(key: Key, updates: Partial<GlobalStyleConfig[Key]>) {
    setConfig((current) => normalizeGlobalStyleConfig({
      ...current,
      [key]: { ...current[key], ...updates }
    }));
  }

  async function save() {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/global-style', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: toStoredGlobalStyleConfig(config) })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.message === 'string' ? body.message : 'Shranjevanje ni uspelo.');
      const persisted = normalizeGlobalStyleConfig(body.config ?? config);
      setConfig(persisted);
      setSavedConfig(persisted);
      toast.success('Globalni parametri so shranjeni.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Shranjevanje globalnih parametrov ni uspelo.');
    } finally {
      setIsSaving(false);
    }
  }

  function resetDefaults() {
    setConfig(normalizeGlobalStyleConfig(cloneDefaultGlobalStyleConfig()));
  }

  function renderElementSettings(element: GlobalElementKey) {
    if (element === 'page') return (
      <>
        <SettingsSection title="Mere strani" description="Veljajo za glavni vsebinski okvir na vseh javnih straneh.">
          <FieldGrid>
            <NumberField settingPath="layout.maxWidthPx" label="Največja širina strani" value={config.layout.maxWidthPx} min={960} max={1920} onChange={(maxWidthPx) => updateGroup('layout', { maxWidthPx })} />
            <NumberField settingPath="layout.gutterMobilePx" label="Stranski odmik · mobilno" value={config.layout.gutterMobilePx} min={0} max={48} onChange={(gutterMobilePx) => updateGroup('layout', { gutterMobilePx })} />
            <NumberField settingPath="layout.gutterTabletPx" label="Stranski odmik · tablica" value={config.layout.gutterTabletPx} min={0} max={72} onChange={(gutterTabletPx) => updateGroup('layout', { gutterTabletPx })} />
            <NumberField settingPath="layout.gutterDesktopPx" label="Stranski odmik · desktop" value={config.layout.gutterDesktopPx} min={0} max={96} onChange={(gutterDesktopPx) => updateGroup('layout', { gutterDesktopPx })} />
          </FieldGrid>
        </SettingsSection>
        <SettingsSection title="Ozadje">
          <FieldGrid>
            <ColorField settingPath="colors.pageBackground" label="Ozadje strani" value={config.colors.pageBackground} onChange={(pageBackground) => updateGroup('colors', { pageBackground })} />
          </FieldGrid>
        </SettingsSection>
      </>
    );

    if (element === 'content-column') return (
      <SettingsSection description="Omeji širino daljšega besedila, da ostane berljivo na širokih zaslonih.">
        <FieldGrid>
          <NumberField settingPath="layout.contentWidthPx" label="Širina besedilne vsebine" value={config.layout.contentWidthPx} min={480} max={1200} onChange={(contentWidthPx) => updateGroup('layout', { contentWidthPx })} />
        </FieldGrid>
      </SettingsSection>
    );

    if (element === 'section') return (
      <SettingsSection description="Navpični odmik se prilagaja izbrani velikosti zaslona.">
        <FieldGrid>
          <NumberField settingPath="spacing.sectionDesktopPx" label="Odmik · desktop" value={config.spacing.sectionDesktopPx} min={0} max={160} onChange={(sectionDesktopPx) => updateGroup('spacing', { sectionDesktopPx })} />
          <NumberField settingPath="spacing.sectionTabletPx" label="Odmik · tablica" value={config.spacing.sectionTabletPx} min={0} max={140} onChange={(sectionTabletPx) => updateGroup('spacing', { sectionTabletPx })} />
          <NumberField settingPath="spacing.sectionMobilePx" label="Odmik · mobilno" value={config.spacing.sectionMobilePx} min={0} max={120} onChange={(sectionMobilePx) => updateGroup('spacing', { sectionMobilePx })} />
        </FieldGrid>
      </SettingsSection>
    );

    if (element === 'responsive') return (
      <SettingsSection description="Token uporabljajo komponente, ki podpirajo nastavljive prelome.">
        <FieldGrid>
          <NumberField settingPath="breakpoints.mobileMaxPx" label="Mobilno do" value={config.breakpoints.mobileMaxPx} min={480} max={900} onChange={(mobileMaxPx) => updateGroup('breakpoints', { mobileMaxPx })} />
          <NumberField settingPath="breakpoints.tabletMaxPx" label="Tablica do" value={config.breakpoints.tabletMaxPx} min={640} max={1600} onChange={(tabletMaxPx) => updateGroup('breakpoints', { tabletMaxPx })} />
          <NumberField settingPath="breakpoints.wideMinPx" label="Širok zaslon od" value={config.breakpoints.wideMinPx} min={1025} max={2560} onChange={(wideMinPx) => updateGroup('breakpoints', { wideMinPx })} />
        </FieldGrid>
      </SettingsSection>
    );

    if (element === 'spacing-scale') return (
      <SettingsSection description="Ponovljiva lestvica za notranje odmike in razmike med elementi.">
        <FieldGrid>
          <NumberField settingPath="spacing.xsPx" label="Lestvica XS" value={config.spacing.xsPx} min={0} max={16} onChange={(xsPx) => updateGroup('spacing', { xsPx })} />
          <NumberField settingPath="spacing.smPx" label="Lestvica S" value={config.spacing.smPx} min={2} max={32} onChange={(smPx) => updateGroup('spacing', { smPx })} />
          <NumberField settingPath="spacing.mdPx" label="Lestvica M" value={config.spacing.mdPx} min={4} max={48} onChange={(mdPx) => updateGroup('spacing', { mdPx })} />
          <NumberField settingPath="spacing.lgPx" label="Lestvica L" value={config.spacing.lgPx} min={8} max={72} onChange={(lgPx) => updateGroup('spacing', { lgPx })} />
          <NumberField settingPath="spacing.xlPx" label="Lestvica XL" value={config.spacing.xlPx} min={12} max={120} onChange={(xlPx) => updateGroup('spacing', { xlPx })} />
        </FieldGrid>
      </SettingsSection>
    );

    if (element === 'body-text') return (
      <>
        <SettingsSection title="Pisava">
          <FieldGrid>
            <SelectField settingPath="typography.bodyFontFamily" label="Osnovna pisava" value={config.typography.bodyFontFamily} options={GLOBAL_STYLE_FONT_FAMILIES} onChange={(bodyFontFamily) => updateGroup('typography', { bodyFontFamily })} />
            <NumberField settingPath="typography.bodySizePx" label="Osnovna velikost" value={config.typography.bodySizePx} min={12} max={24} onChange={(bodySizePx) => updateGroup('typography', { bodySizePx })} />
            <NumberField settingPath="typography.bodyWeight" label="Osnovna debelina" value={config.typography.bodyWeight} min={300} max={800} step={100} suffix="" onChange={(bodyWeight) => updateGroup('typography', { bodyWeight })} />
            <NumberField settingPath="typography.bodyLineHeight" label="Višina vrstice" value={config.typography.bodyLineHeight} min={1} max={2.2} step={0.05} suffix="×" onChange={(bodyLineHeight) => updateGroup('typography', { bodyLineHeight })} />
          </FieldGrid>
        </SettingsSection>
        <SettingsSection title="Barvi besedila">
          <FieldGrid>
            <ColorField settingPath="colors.text" label="Glavno besedilo" value={config.colors.text} onChange={(text) => updateGroup('colors', { text })} />
            <ColorField settingPath="colors.textMuted" label="Zadržano besedilo" value={config.colors.textMuted} onChange={(textMuted) => updateGroup('colors', { textMuted })} />
          </FieldGrid>
        </SettingsSection>
      </>
    );

    if (element === 'headings') return (
      <>
        <SettingsSection title="Skupni slog naslovov">
          <FieldGrid>
            <SelectField settingPath="typography.headingFontFamily" label="Pisava naslovov" value={config.typography.headingFontFamily} options={GLOBAL_STYLE_FONT_FAMILIES} onChange={(headingFontFamily) => updateGroup('typography', { headingFontFamily })} />
            <NumberField settingPath="typography.headingWeight" label="Debelina naslovov" value={config.typography.headingWeight} min={300} max={900} step={100} suffix="" onChange={(headingWeight) => updateGroup('typography', { headingWeight })} />
            <NumberField settingPath="typography.headingLineHeight" label="Višina vrstice naslovov" value={config.typography.headingLineHeight} min={0.9} max={1.8} step={0.05} suffix="×" onChange={(headingLineHeight) => updateGroup('typography', { headingLineHeight })} />
          </FieldGrid>
        </SettingsSection>
        <SettingsSection title="Velikosti">
          <FieldGrid>
            <NumberField settingPath="typography.h1SizePx" label="Naslov H1" value={config.typography.h1SizePx} min={24} max={72} onChange={(h1SizePx) => updateGroup('typography', { h1SizePx })} />
            <NumberField settingPath="typography.h2SizePx" label="Naslov H2" value={config.typography.h2SizePx} min={20} max={56} onChange={(h2SizePx) => updateGroup('typography', { h2SizePx })} />
            <NumberField settingPath="typography.h3SizePx" label="Naslov H3" value={config.typography.h3SizePx} min={16} max={40} onChange={(h3SizePx) => updateGroup('typography', { h3SizePx })} />
          </FieldGrid>
        </SettingsSection>
      </>
    );

    if (element === 'paragraph') return (
      <SettingsSection description="Ločeno od osnovnega vmesniškega besedila določa ritem daljših odstavkov.">
        <FieldGrid>
          <NumberField settingPath="typography.paragraphSizePx" label="Velikost odstavka" value={config.typography.paragraphSizePx} min={12} max={24} onChange={(paragraphSizePx) => updateGroup('typography', { paragraphSizePx })} />
          <NumberField settingPath="typography.paragraphLineHeight" label="Višina vrstice odstavka" value={config.typography.paragraphLineHeight} min={1} max={2.2} step={0.05} suffix="×" onChange={(paragraphLineHeight) => updateGroup('typography', { paragraphLineHeight })} />
        </FieldGrid>
      </SettingsSection>
    );

    if (element === 'link') return (
      <SettingsSection>
        <FieldGrid>
          <ColorField settingPath="links.color" label="Barva" value={config.links.color} onChange={(color) => updateGroup('links', { color })} />
          <ColorField settingPath="links.hoverColor" label="Barva · hover" value={config.links.hoverColor} onChange={(hoverColor) => updateGroup('links', { hoverColor })} />
          <ColorField settingPath="links.activeColor" label="Barva · aktivna" value={config.links.activeColor} onChange={(activeColor) => updateGroup('links', { activeColor })} />
          <NumberField settingPath="links.fontWeight" label="Debelina pisave" value={config.links.fontWeight} min={300} max={800} step={100} suffix="" onChange={(fontWeight) => updateGroup('links', { fontWeight })} />
          <SelectField settingPath="links.underline" label="Podčrtava" value={config.links.underline} options={GLOBAL_STYLE_LINK_UNDERLINES} onChange={(underline) => updateGroup('links', { underline })} />
        </FieldGrid>
      </SettingsSection>
    );

    if (element === 'button') return (
      <>
        <SettingsSection title="Videz in mere">
          <FieldGrid>
            <SelectField settingPath="buttons.appearance" label="Videz" value={config.buttons.appearance} options={GLOBAL_STYLE_BUTTON_APPEARANCES} onChange={(appearance) => updateGroup('buttons', { appearance })} />
            <NumberField settingPath="buttons.heightPx" label="Višina" value={config.buttons.heightPx} min={28} max={72} onChange={(heightPx) => updateGroup('buttons', { heightPx })} />
            <NumberField settingPath="buttons.paddingXPx" label="Vodoravni odmik" value={config.buttons.paddingXPx} min={8} max={48} onChange={(paddingXPx) => updateGroup('buttons', { paddingXPx })} />
            <NumberField settingPath="buttons.radiusPx" label="Radij" value={config.buttons.radiusPx} min={0} max={36} onChange={(radiusPx) => updateGroup('buttons', { radiusPx })} />
            <NumberField settingPath="buttons.fontSizePx" label="Velikost pisave" value={config.buttons.fontSizePx} min={11} max={22} onChange={(fontSizePx) => updateGroup('buttons', { fontSizePx })} />
            <NumberField settingPath="buttons.fontWeight" label="Debelina pisave" value={config.buttons.fontWeight} min={300} max={800} step={100} suffix="" onChange={(fontWeight) => updateGroup('buttons', { fontWeight })} />
            <NumberField settingPath="buttons.borderWidthPx" label="Debelina obrobe" value={config.buttons.borderWidthPx} min={0} max={4} onChange={(borderWidthPx) => updateGroup('buttons', { borderWidthPx })} />
            <SelectField settingPath="buttons.shadow" label="Senca" value={config.buttons.shadow} options={GLOBAL_STYLE_SHADOW_SIZES} onChange={(shadow) => updateGroup('buttons', { shadow })} />
            <NumberField settingPath="buttons.disabledOpacityPercent" label="Prosojnost onemogočenega" value={config.buttons.disabledOpacityPercent} min={10} max={100} suffix="%" onChange={(disabledOpacityPercent) => updateGroup('buttons', { disabledOpacityPercent })} />
          </FieldGrid>
        </SettingsSection>
        <SettingsSection title="Primarna barva in stanja">
          <FieldGrid>
            <ColorField settingPath="colors.primary" label="Privzeta" value={config.colors.primary} onChange={(primary) => updateGroup('colors', { primary })} />
            <ColorField settingPath="colors.primaryHover" label="Hover" value={config.colors.primaryHover} onChange={(primaryHover) => updateGroup('colors', { primaryHover })} />
            <ColorField settingPath="colors.primaryActive" label="Aktivna" value={config.colors.primaryActive} onChange={(primaryActive) => updateGroup('colors', { primaryActive })} />
            <ColorField settingPath="colors.primaryForeground" label="Besedilo na gumbu" value={config.colors.primaryForeground} onChange={(primaryForeground) => updateGroup('colors', { primaryForeground })} />
          </FieldGrid>
        </SettingsSection>
      </>
    );

    if (element === 'form-field') return (
      <>
        <SettingsSection title="Videz in mere">
          <FieldGrid>
            <SelectField settingPath="forms.appearance" label="Videz" value={config.forms.appearance} options={GLOBAL_STYLE_FORM_APPEARANCES} onChange={(appearance) => updateGroup('forms', { appearance })} />
            <NumberField settingPath="forms.heightPx" label="Višina" value={config.forms.heightPx} min={32} max={72} onChange={(heightPx) => updateGroup('forms', { heightPx })} />
            <NumberField settingPath="forms.paddingXPx" label="Vodoravni odmik" value={config.forms.paddingXPx} min={6} max={32} onChange={(paddingXPx) => updateGroup('forms', { paddingXPx })} />
            <NumberField settingPath="forms.radiusPx" label="Radij" value={config.forms.radiusPx} min={0} max={32} onChange={(radiusPx) => updateGroup('forms', { radiusPx })} />
            <NumberField settingPath="forms.fontSizePx" label="Velikost pisave" value={config.forms.fontSizePx} min={11} max={22} onChange={(fontSizePx) => updateGroup('forms', { fontSizePx })} />
            <NumberField settingPath="forms.borderWidthPx" label="Debelina obrobe" value={config.forms.borderWidthPx} min={0} max={4} onChange={(borderWidthPx) => updateGroup('forms', { borderWidthPx })} />
          </FieldGrid>
        </SettingsSection>
        <SettingsSection title="Barve in fokus">
          <FieldGrid>
            <ColorField settingPath="forms.background" label="Ozadje polja" value={config.forms.background} onChange={(background) => updateGroup('forms', { background })} />
            <ColorField settingPath="forms.placeholder" label="Namig" value={config.forms.placeholder} onChange={(placeholder) => updateGroup('forms', { placeholder })} />
            <ColorField settingPath="forms.focusColor" label="Fokus" value={config.forms.focusColor} onChange={(focusColor) => updateGroup('forms', { focusColor })} />
          </FieldGrid>
        </SettingsSection>
      </>
    );

    if (element === 'surface') return (
      <SettingsSection description="Površine se uporabljajo za vsebnike, menije in zadržana ozadja.">
        <FieldGrid>
          <ColorField settingPath="colors.surface" label="Osnovna površina" value={config.colors.surface} onChange={(surface) => updateGroup('colors', { surface })} />
          <ColorField settingPath="colors.surfaceMuted" label="Zadržana površina" value={config.colors.surfaceMuted} onChange={(surfaceMuted) => updateGroup('colors', { surfaceMuted })} />
        </FieldGrid>
      </SettingsSection>
    );

    if (element === 'card') return (
      <SettingsSection>
        <FieldGrid>
          <SelectField settingPath="cards.appearance" label="Videz" value={config.cards.appearance} options={GLOBAL_STYLE_CARD_APPEARANCES} onChange={(appearance) => updateGroup('cards', { appearance })} />
          <NumberField settingPath="cards.radiusPx" label="Radij" value={config.cards.radiusPx} min={0} max={48} onChange={(radiusPx) => updateGroup('cards', { radiusPx })} />
          <NumberField settingPath="cards.paddingPx" label="Notranji odmik" value={config.cards.paddingPx} min={0} max={64} onChange={(paddingPx) => updateGroup('cards', { paddingPx })} />
          <NumberField settingPath="cards.borderWidthPx" label="Debelina obrobe" value={config.cards.borderWidthPx} min={0} max={4} onChange={(borderWidthPx) => updateGroup('cards', { borderWidthPx })} />
          <ColorField settingPath="cards.background" label="Ozadje" value={config.cards.background} onChange={(background) => updateGroup('cards', { background })} />
          <SelectField settingPath="cards.shadow" label="Senca" value={config.cards.shadow} options={GLOBAL_STYLE_SHADOW_SIZES} onChange={(shadow) => updateGroup('cards', { shadow })} />
        </FieldGrid>
      </SettingsSection>
    );

    if (element === 'border') return (
      <SettingsSection>
        <FieldGrid>
          <ColorField settingPath="borders.color" label="Barva obrobe" value={config.borders.color} onChange={(color) => updateGroup('borders', { color })} />
          <ColorField settingPath="borders.dividerColor" label="Barva ločil" value={config.borders.dividerColor} onChange={(dividerColor) => updateGroup('borders', { dividerColor })} />
          <NumberField settingPath="borders.widthPx" label="Globalna debelina" value={config.borders.widthPx} min={0} max={4} onChange={(widthPx) => updateGroup('borders', { widthPx })} />
        </FieldGrid>
      </SettingsSection>
    );

    if (element === 'radii') return (
      <SettingsSection description="Skupne vrednosti uporabljajo elementi brez izrecne lokalne nastavitve.">
        <FieldGrid>
          <NumberField settingPath="radii.smallPx" label="Majhen radij" value={config.radii.smallPx} min={0} max={32} onChange={(smallPx) => updateGroup('radii', { smallPx })} />
          <NumberField settingPath="radii.mediumPx" label="Srednji radij" value={config.radii.mediumPx} min={0} max={48} onChange={(mediumPx) => updateGroup('radii', { mediumPx })} />
          <NumberField settingPath="radii.largePx" label="Velik radij" value={config.radii.largePx} min={0} max={72} onChange={(largePx) => updateGroup('radii', { largePx })} />
          <NumberField settingPath="radii.pillPx" label="Radij kapsule" value={config.radii.pillPx} min={24} max={999} onChange={(pillPx) => updateGroup('radii', { pillPx })} />
        </FieldGrid>
      </SettingsSection>
    );

    if (element === 'shadows') return (
      <SettingsSection description="Skupna barva in tri ravni elevacije za elemente spletnega mesta.">
        <FieldGrid>
          <ColorField settingPath="shadows.color" label="Barva sence" value={config.shadows.color} onChange={(color) => updateGroup('shadows', { color })} />
          <NumberField settingPath="shadows.opacityPercent" label="Prosojnost" value={config.shadows.opacityPercent} min={0} max={40} suffix="%" onChange={(opacityPercent) => updateGroup('shadows', { opacityPercent })} />
          <NumberField settingPath="shadows.smallBlurPx" label="Majhna · zameglitev" value={config.shadows.smallBlurPx} min={0} max={40} onChange={(smallBlurPx) => updateGroup('shadows', { smallBlurPx })} />
          <NumberField settingPath="shadows.smallYPx" label="Majhna · odmik Y" value={config.shadows.smallYPx} min={0} max={24} onChange={(smallYPx) => updateGroup('shadows', { smallYPx })} />
          <NumberField settingPath="shadows.mediumBlurPx" label="Srednja · zameglitev" value={config.shadows.mediumBlurPx} min={0} max={80} onChange={(mediumBlurPx) => updateGroup('shadows', { mediumBlurPx })} />
          <NumberField settingPath="shadows.mediumYPx" label="Srednja · odmik Y" value={config.shadows.mediumYPx} min={0} max={48} onChange={(mediumYPx) => updateGroup('shadows', { mediumYPx })} />
          <NumberField settingPath="shadows.largeBlurPx" label="Velika · zameglitev" value={config.shadows.largeBlurPx} min={0} max={140} onChange={(largeBlurPx) => updateGroup('shadows', { largeBlurPx })} />
          <NumberField settingPath="shadows.largeYPx" label="Velika · odmik Y" value={config.shadows.largeYPx} min={0} max={80} onChange={(largeYPx) => updateGroup('shadows', { largeYPx })} />
        </FieldGrid>
      </SettingsSection>
    );

    if (element === 'accent') return (
      <SettingsSection description="Uporablja se za poudarjene oznake, obrvi in manjše vizualne poudarke.">
        <FieldGrid>
          <ColorField settingPath="colors.accent" label="Barva poudarka" value={config.colors.accent} onChange={(accent) => updateGroup('colors', { accent })} />
        </FieldGrid>
      </SettingsSection>
    );

    return (
      <SettingsSection description="Semantične barve ostanejo dosledne v opozorilih, značkah in statusih.">
        <FieldGrid>
          <ColorField settingPath="colors.success" label="Uspeh" value={config.colors.success} onChange={(success) => updateGroup('colors', { success })} />
          <ColorField settingPath="colors.warning" label="Opozorilo" value={config.colors.warning} onChange={(warning) => updateGroup('colors', { warning })} />
          <ColorField settingPath="colors.danger" label="Nevarnost" value={config.colors.danger} onChange={(danger) => updateGroup('colors', { danger })} />
          <ColorField settingPath="colors.info" label="Informacija" value={config.colors.info} onChange={(info) => updateGroup('colors', { info })} />
        </FieldGrid>
      </SettingsSection>
    );
  }

  function handleElementKeyDown(event: KeyboardEvent<HTMLButtonElement>, elementIndex: number) {
    const lastIndex = globalElements.length - 1;
    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown') nextIndex = elementIndex === lastIndex ? 0 : elementIndex + 1;
    if (event.key === 'ArrowUp') nextIndex = elementIndex === 0 ? lastIndex : elementIndex - 1;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = lastIndex;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextElement = globalElements[nextIndex];
    const tabList = event.currentTarget.closest('[role="tablist"]');
    setActiveElementKey(nextElement.value);
    window.requestAnimationFrame(() => {
      tabList
        ?.querySelector<HTMLButtonElement>(`[data-global-element="${nextElement.value}"]`)
        ?.focus();
    });
  }

  function renderPreviewDetails() {
    if (activeElementKey === 'page') return (
      <div className="grid gap-3" data-global-preview-element="page">
        <div className="site-radius-sm border border-dashed border-[color:var(--site-border-color)] bg-[color:var(--site-color-surface)] p-3">
          <div className="mx-auto h-14 bg-[color:var(--site-color-surface-muted)]" style={{ maxWidth: 'var(--site-global-max-width)' }} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px] text-[color:var(--site-color-text-muted)]">
          <span>Največ {config.layout.maxWidthPx}px</span>
          <span className="text-right">Rob {previewGutter}px</span>
        </div>
      </div>
    );

    if (activeElementKey === 'content-column') return (
      <div className="grid gap-3" data-global-preview-element="content-column">
        <div className="mx-auto w-full border-x border-dashed border-[color:var(--site-color-primary)] px-3 py-2" style={{ maxWidth: 'var(--site-global-content-width)' }}>
          <h3 className="site-heading-3">Berljiv besedilni stolpec</h3>
          <p className="site-paragraph mt-2">Širina omeji dolge vrstice in ohrani prijeten ritem branja.</p>
        </div>
        <span className="text-center text-[10px] text-[color:var(--site-color-text-muted)]">{config.layout.contentWidthPx}px</span>
      </div>
    );

    if (activeElementKey === 'section') return (
      <div className="grid" style={{ gap: 'var(--site-section-space-current)' }} data-global-preview-element="section">
        <div className="site-radius-sm bg-[color:var(--site-color-surface-muted)] p-4 text-[11px] font-semibold">Prva sekcija</div>
        <div className="site-radius-sm bg-[color:var(--site-color-surface-muted)] p-4 text-[11px] font-semibold">Naslednja sekcija</div>
      </div>
    );

    if (activeElementKey === 'responsive') return (
      <div className="grid grid-cols-3 gap-2 text-center text-[10px]" data-global-preview-element="responsive">
        <span className="site-radius-sm bg-[color:var(--site-color-surface-muted)] px-2 py-3">M<br />≤ {config.breakpoints.mobileMaxPx}px</span>
        <span className="site-radius-sm bg-[color:var(--site-color-surface-muted)] px-2 py-3">T<br />≤ {config.breakpoints.tabletMaxPx}px</span>
        <span className="site-radius-sm bg-[color:var(--site-color-surface-muted)] px-2 py-3">W<br />≥ {config.breakpoints.wideMinPx}px</span>
      </div>
    );

    if (activeElementKey === 'spacing-scale') {
      const spacingTokens = [['XS', 'xs'], ['S', 'sm'], ['M', 'md'], ['L', 'lg'], ['XL', 'xl']];
      return (
        <div className="grid gap-2" data-global-preview-element="spacing-scale">
          {spacingTokens.map(([label, token]) => (
            <div key={token} className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-2 text-[10px] text-[color:var(--site-color-text-muted)]">
              <span>{label}</span>
              <span className="h-2 max-w-full rounded-full bg-[color:var(--site-color-primary)]" style={{ width: `calc(var(--site-space-${token}) * 2.25)` }} />
            </div>
          ))}
        </div>
      );
    }

    if (activeElementKey === 'body-text') return (
      <div className="grid gap-2" data-global-preview-element="body-text">
        <p>Osnovno besedilo je namenjeno navigaciji, oznakam in kratkim vsebinam vmesnika.</p>
        <p className="text-[color:var(--site-color-text-muted)]">Zadržano besedilo podaja dodatni kontekst.</p>
      </div>
    );

    if (activeElementKey === 'headings') return (
      <div className="grid gap-2" data-global-preview-element="headings">
        <h1 className="site-heading-1">Naslov H1</h1>
        <h2 className="site-heading-2">Naslov H2</h2>
        <h3 className="site-heading-3">Naslov H3</h3>
      </div>
    );

    if (activeElementKey === 'paragraph') return (
      <div className="grid gap-3" data-global-preview-element="paragraph">
        <p className="site-paragraph">Odstavek pokaže izbrano velikost in višino vrstice na realističnem večvrstičnem primeru besedila.</p>
        <p className="site-paragraph">Drugi odstavek pomaga oceniti razmerje med vrsticami in celoten ritem vsebine.</p>
      </div>
    );

    if (activeElementKey === 'link') return (
      <div className="grid gap-3" data-global-preview-element="link">
        <span className="font-medium" style={{ color: 'var(--site-link-color)', fontWeight: 'var(--site-link-weight)', textDecoration: 'var(--site-link-decoration)' }}>Običajna povezava</span>
        <span className="font-medium" style={{ color: 'var(--site-link-hover)', fontWeight: 'var(--site-link-weight)', textDecoration: 'var(--site-link-hover-decoration)' }}>Povezava ob prehodu</span>
        <span className="font-medium" style={{ color: 'var(--site-link-active)', fontWeight: 'var(--site-link-weight)', textDecoration: 'var(--site-link-hover-decoration)' }}>Aktivna povezava</span>
      </div>
    );

    if (activeElementKey === 'button') return (
      <div className="grid gap-3" data-global-preview-element="button">
        <div className="flex flex-wrap gap-2">
          <span className="site-button site-button--primary inline-flex items-center">Primarni</span>
          <span className="site-button site-button--secondary inline-flex items-center">Sekundarni</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="site-button site-button--primary inline-flex items-center" style={{ background: 'var(--site-color-primary-hover)' }}>Hover</span>
          <span className="site-button site-button--primary inline-flex items-center" style={{ background: 'var(--site-color-primary-active)' }}>Aktivni</span>
          <span className="site-button site-button--primary inline-flex items-center" aria-disabled="true">Onemogočen</span>
        </div>
      </div>
    );

    if (activeElementKey === 'form-field') return (
      <div className="grid gap-2" data-global-preview-element="form-field">
        <div className="site-field flex items-center text-[color:var(--site-field-placeholder)]">Vnesite besedilo</div>
        <div className="site-field flex items-center">Vnesena vrednost</div>
        <div className="site-field flex items-center" style={{ borderColor: 'var(--site-field-focus)' }}>Fokusirano polje</div>
      </div>
    );

    if (activeElementKey === 'surface') return (
      <div className="grid grid-cols-2 gap-3" data-global-preview-element="surface">
        <div className="site-radius-md border border-[color:var(--site-border-color)] bg-[color:var(--site-color-surface)] p-4 text-[11px] font-semibold">Površina</div>
        <div className="site-radius-md border border-[color:var(--site-border-color)] bg-[color:var(--site-color-surface-muted)] p-4 text-[11px] font-semibold">Zadržana</div>
      </div>
    );

    if (activeElementKey === 'card') return (
      <div className="site-card" data-global-preview-element="card">
        <p className="site-eyebrow">Kartica</p>
        <h3 className="site-heading-3 mt-2">Vsebinski panel</h3>
        <p className="site-paragraph mt-2">Ozadje, obroba, radij, notranji odmik in senca se posodobijo skupaj.</p>
        <span className="site-link mt-3 inline-block">Več informacij</span>
      </div>
    );

    if (activeElementKey === 'border') return (
      <div className="grid gap-4" data-global-preview-element="border">
        <div className="site-radius-sm border p-4 text-[11px] font-medium" style={{ borderColor: 'var(--site-border-color)', borderWidth: 'var(--site-border-width)' }}>Vsebnik z obrobo</div>
        <div className="border-t" style={{ borderColor: 'var(--site-divider-color)', borderWidth: 'var(--site-border-width)' }} />
      </div>
    );

    if (activeElementKey === 'radii') {
      const radiusSamples = [['S', 'site-radius-sm'], ['M', 'site-radius-md'], ['L', 'site-radius-lg'], ['Pill', 'site-radius-pill']];
      return (
        <div className="grid grid-cols-4 gap-2" data-global-preview-element="radii">
          {radiusSamples.map(([label, className]) => <div key={label} className={`${className} grid h-14 place-items-center bg-[color:var(--site-color-surface-muted)] text-[10px] font-semibold`}>{label}</div>)}
        </div>
      );
    }

    if (activeElementKey === 'shadows') return (
      <div className="grid grid-cols-3 gap-3 text-center text-[10px]" data-global-preview-element="shadows">
        <span className="site-radius-sm bg-[color:var(--site-color-surface)] px-2 py-6" style={{ boxShadow: 'var(--site-shadow-sm)' }}>Majhna</span>
        <span className="site-radius-sm bg-[color:var(--site-color-surface)] px-2 py-6" style={{ boxShadow: 'var(--site-shadow-md)' }}>Srednja</span>
        <span className="site-radius-sm bg-[color:var(--site-color-surface)] px-2 py-6" style={{ boxShadow: 'var(--site-shadow-lg)' }}>Velika</span>
      </div>
    );

    if (activeElementKey === 'accent') return (
      <div className="grid gap-3" data-global-preview-element="accent">
        <span className="site-radius-pill w-fit px-3 py-1.5 text-[11px] font-semibold text-white" style={{ backgroundColor: 'var(--site-color-accent)' }}>Poudarjena oznaka</span>
        <div className="site-radius-sm border-l-4 bg-[color:var(--site-color-surface-muted)] p-3 text-[11px]" style={{ borderColor: 'var(--site-color-accent)' }}>Poudarek znotraj vsebine</div>
      </div>
    );

    const statuses = [
      ['Uspeh', 'var(--site-color-success)'],
      ['Opozorilo', 'var(--site-color-warning)'],
      ['Nevarnost', 'var(--site-color-danger)'],
      ['Informacija', 'var(--site-color-info)']
    ];
    return (
      <div className="grid grid-cols-2 gap-2" data-global-preview-element="statuses">
        {statuses.map(([label, color]) => (
          <div key={label} className="site-radius-sm flex items-center gap-2 border bg-[color:var(--site-color-surface)] p-2 text-[10px] font-medium" style={{ borderColor: color }}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
      </div>
    );
  }

  const previewWidth = previewDevice === 'desktop' ? 'w-full' : previewDevice === 'tablet' ? 'w-[76%]' : 'w-[390px] max-w-full';

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Globalni parametri"
        description="Izberite element in prilagodite njegov skupni slog na celotnem javnem spletnem mestu."
        actions={
          <div className="flex items-center gap-2">
            <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500" aria-live="polite">
              <span className={`h-1.5 w-1.5 rounded-full ${isDirty ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              {isDirty ? 'Neshranjeno' : 'Objavljeno'}
            </span>
            <button type="button" aria-label="Ponastavi na privzeto" title="Ponastavi na privzeto" onClick={resetDefaults} disabled={isSaving} className={`grid h-8 w-8 place-items-center rounded-lg border border-transparent text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 ${adminControlFocusTokenClasses}`}>
              <RotateCcw className="h-4 w-4" />
            </button>
            <Button type="button" variant="primary" size="toolbar" onClick={save} disabled={!isDirty || isSaving} className="gap-2">
              <Save className="h-4 w-4" /> Shrani
            </Button>
          </div>
        }
      />
      <AdminPodobaTabs />

      <div className="grid min-w-0 gap-4 min-[980px]:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="min-w-0 self-start overflow-hidden rounded-xl border border-slate-200 bg-white min-[980px]:sticky min-[980px]:top-5" data-testid="global-parameter-element-list">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
            <div>
              <h2 className="text-[12px] font-semibold text-slate-800">Elementi spletnega mesta</h2>
              <p className="mt-0.5 text-[10px] text-slate-500">Izberite element za urejanje.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{globalElements.length}</span>
          </div>
          <div
            className="max-h-[calc(100vh-220px)] overflow-y-auto p-2 [scrollbar-width:thin]"
            role="tablist"
            aria-label="Elementi globalnih parametrov"
            aria-orientation="vertical"
          >
            {globalElementGroups.map((group) => (
              <div key={group.label} className="mb-3 last:mb-0">
                <p className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">{group.label}</p>
                <div className="grid gap-0.5">
                  {group.items.map((element) => {
                    const elementIndex = globalElements.findIndex((candidate) => candidate.value === element.value);
                    const isActive = activeElementKey === element.value;
                    return (
                      <button
                        key={element.value}
                        id={`global-element-tab-${element.value}`}
                        data-global-element={element.value}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-controls="global-element-panel"
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => setActiveElementKey(element.value)}
                        onKeyDown={(event) => handleElementKeyDown(event, elementIndex)}
                        className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${adminControlFocusTokenClasses} ${isActive ? 'border-[color:var(--blue-100)] bg-[color:var(--blue-50)] text-[color:var(--blue-700)]' : 'border-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-950'}`}
                      >
                        <span className="block text-[11px] font-semibold leading-4">{element.label}</span>
                        <span className={`mt-0.5 block text-[9px] leading-3.5 ${isActive ? 'text-[color:var(--blue-600)]/75' : 'text-slate-400'}`}>{element.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white" data-testid="global-parameter-workspace">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[color:var(--blue-600)]">Globalni element</p>
              <h2 className="mt-0.5 text-[16px] font-semibold text-slate-900">{activeElement.label}</h2>
              <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{activeElement.description}</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-500">Velja na celotnem spletnem mestu</span>
          </div>

          <div className="grid min-w-0 items-start gap-4 bg-slate-50/50 p-4 min-[1180px]:grid-cols-[minmax(330px,0.8fr)_minmax(390px,1.2fr)]">
            <div
              key={activeElementKey}
              id="global-element-panel"
              role="tabpanel"
              aria-labelledby={`global-element-tab-${activeElement.value}`}
              className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5"
              data-testid="global-parameter-settings"
            >
              <div className="mb-3 border-b border-slate-100 pb-2.5">
                <h3 className="text-[12px] font-semibold text-slate-800">Nastavitve</h3>
                <p className="mt-0.5 text-[10px] text-slate-500">Lokalne izjeme imajo prednost samo, kadar so izrecno nastavljene.</p>
              </div>
              <div className="grid gap-4">{renderElementSettings(activeElementKey)}</div>
            </div>

            <aside className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white min-[1180px]:sticky min-[1180px]:top-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
                <div>
                  <p className="text-[12px] font-semibold text-slate-800">Predogled elementa</p>
                  <p className="text-[10px] leading-4 text-slate-500">Neshranjene spremembe se pokažejo takoj.</p>
                </div>
                <div className="flex items-center gap-0.5 rounded-lg bg-slate-100/80 p-0.5" role="group" aria-label="Velikost predogleda">
                  {(['desktop', 'tablet', 'mobile'] as const).map((device) => (
                    <button
                      key={device}
                      type="button"
                      onClick={() => setPreviewDevice(device)}
                      aria-pressed={previewDevice === device}
                      title={device === 'desktop' ? `Širok zaslon od ${config.breakpoints.wideMinPx}px` : device === 'tablet' ? `Tablica do ${config.breakpoints.tabletMaxPx}px` : `Mobilno do ${config.breakpoints.mobileMaxPx}px`}
                      className={`h-7 rounded-[7px] border border-transparent px-2 text-[11px] font-medium transition ${adminControlFocusTokenClasses} ${previewDevice === device ? 'bg-white text-[color:var(--blue-600)] shadow-sm ring-1 ring-slate-200/70' : 'text-slate-500 hover:bg-white/70 hover:text-slate-900'}`}
                    >
                      {device === 'desktop' ? 'Desktop' : device === 'tablet' ? 'Tablica' : 'Mobilno'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-auto bg-slate-100 p-3">
                <div
                  data-storefront-theme
                  data-global-parameters-preview
                  data-active-global-element={activeElementKey}
                  className={`${previewWidth} storefront-theme-preview site-page-surface mx-auto min-h-[620px] overflow-hidden border border-slate-200 transition-[width]`}
                  style={previewVars}
                >
                  <div className="mx-auto w-full" style={{ maxWidth: 'var(--site-global-max-width)' }}>
                    <section className="site-section px-[var(--site-gutter)]">
                      <p className="site-eyebrow">{activeElement.label}</p>
                      <div className="mt-4">{renderPreviewDetails()}</div>
                    </section>
                    <section className="site-section px-[var(--site-gutter)] pt-0">
                      <div className="border-t pt-5" style={{ borderColor: 'var(--site-divider-color)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--site-color-text-muted)]">Primer v vsebini</p>
                        <h2 className="site-heading-2 mt-2">Dosleden slog na vsaki strani.</h2>
                        <p className="site-paragraph mt-2">Globalni element se samodejno uporabi povsod, kjer ni izrecne lokalne izjeme.</p>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className="site-button site-button--primary inline-flex items-center">Primarni gumb</span>
                          <span className="site-link">Primer povezave</span>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}
