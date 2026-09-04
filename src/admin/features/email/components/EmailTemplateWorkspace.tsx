'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Send, Shield } from 'lucide-react';
import EmailMessagePreview, {
  type EmailMessagePreviewProps
} from '@/admin/features/email/components/EmailMessagePreview';
import EmailTemplateContextToolbar, {
  type EmailTemplateContextField,
  type EmailTemplateContextPresentation,
  type EmailTemplateContextSharedContent,
  type EmailTemplateContextSpacingDefaults,
  type EmailTemplateContextSystemLines
} from '@/admin/features/email/components/EmailTemplateContextToolbar';
import { Badge, type BadgeVariant } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import EuiTabs from '@/shared/ui/eui-tabs';
import { adminTableBulkHeaderButtonClassName } from '@/shared/ui/admin-table';

export type EmailTemplateWorkspaceAudience<Audience extends string = string> = {
  value: Audience;
  label: ReactNode;
};

export type EmailTemplateWorkspaceActivity = {
  label: string;
  tone: BadgeVariant;
  title?: string;
};

export type EmailTemplateWorkspaceField = EmailTemplateContextField & {
  id: string;
  label: string;
  description?: string;
  testId: string;
};

export type EmailTemplateWorkspaceEditor = {
  testId: string;
  title: string;
  description?: string;
  disabled?: boolean;
  subject: EmailTemplateWorkspaceField;
  contentHtml: EmailTemplateWorkspaceField;
  variables: readonly string[];
  variablesLabel?: string;
  variablesAriaLabel: string;
  presentation?: EmailTemplateContextPresentation;
  onPresentationChange: (
    presentation: EmailTemplateContextPresentation | undefined
  ) => void;
  systemLines?: EmailTemplateContextSystemLines;
  spacingDefaults?: EmailTemplateContextSpacingDefaults;
};

export type EmailTemplateWorkspaceProps<Audience extends string = string> = {
  idPrefix: string;
  headingId?: string;
  headingLevel?: 2 | 3;
  testId: string;
  title: string;
  description?: string;
  className?: string;
  eventSelector: ReactNode;
  activity: EmailTemplateWorkspaceActivity;
  recipientControls?: ReactNode;
  audiences: ReadonlyArray<EmailTemplateWorkspaceAudience<Audience>>;
  activeAudience: Audience;
  onAudienceChange: (audience: Audience) => void;
  selectionKey?: string;
  editor: EmailTemplateWorkspaceEditor;
  sharedContent: EmailTemplateContextSharedContent;
  onReset: () => void;
  resetLabel?: string;
  resetAriaLabel: string;
  resetDisabled?: boolean;
  resetTestId?: string;
  workspaceTestId?: string;
  preview: Omit<EmailMessagePreviewProps, 'variant' | 'editor'>;
};

export type EmailTemplateRecipientToggleProps = {
  kind: 'customer' | 'admin';
  label: string;
  checked: boolean;
  disabled?: boolean;
  testId?: string;
  title?: string;
  onChange: (checked: boolean) => void;
};

const defaultBlockLabels: Readonly<Record<string, string>> = {
  subject: 'zadevo',
  sharedHeader: 'skupno glavo',
  templateContent: 'vsebino sporočila',
  audienceDetails: 'podatke prejemnika',
  customerDetails: 'podatke naročnika',
  systemDetails: 'podatke naročila',
  items: 'artikle',
  totals: 'zneske',
  primaryAction: 'akcijski gumb',
  sharedFooter: 'skupno nogo'
};

export function getEmailTemplateActivity(
  enabled: boolean,
  customer: boolean,
  admins: boolean
): EmailTemplateWorkspaceActivity {
  if (!enabled && (customer || admins)) {
    return {
      label: 'Začasno izklopljeno',
      tone: 'neutral',
      title:
        'Prejemniki so nastavljeni, vendar je glavno pošiljanje e-pošte izklopljeno.'
    };
  }
  if (customer && admins) {
    return {
      label: 'Aktivno',
      tone: 'success',
      title: 'Sporočilo je vklopljeno za stranko in administratorje.'
    };
  }
  if (customer || admins) {
    return {
      label: 'Delno aktivno',
      tone: 'warning',
      title: customer
        ? 'Sporočilo je vklopljeno samo za stranko.'
        : 'Sporočilo je vklopljeno samo za administratorje.'
    };
  }
  return {
    label: 'Neaktivno',
    tone: 'neutral',
    title: 'Sporočilo ni vklopljeno za nobeno skupino prejemnikov.'
  };
}

export function EmailTemplateRecipientToggle({
  kind,
  label,
  checked,
  disabled = false,
  testId,
  title,
  onChange
}: EmailTemplateRecipientToggleProps) {
  const Icon = kind === 'customer' ? Send : Shield;
  return (
    <Button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title}
      variant="default"
      size="toolbar"
      className={`${adminTableBulkHeaderButtonClassName} gap-2 ${
        checked
          ? '!border-blue-300 !bg-blue-50 !text-blue-700 hover:!bg-blue-100'
          : ''
      }`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      data-testid={testId}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );
}

export default function EmailTemplateWorkspace<Audience extends string>({
  idPrefix,
  headingId: providedHeadingId,
  headingLevel = 2,
  testId,
  title,
  description,
  className = 'bg-white',
  eventSelector,
  activity,
  recipientControls,
  audiences,
  activeAudience,
  onAudienceChange,
  selectionKey,
  editor,
  sharedContent,
  onReset,
  resetLabel = 'Ponastavi privzeto',
  resetAriaLabel,
  resetDisabled = false,
  resetTestId,
  workspaceTestId,
  preview
}: EmailTemplateWorkspaceProps<Audience>) {
  const headingId = providedHeadingId ?? `${idPrefix}-heading`;
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  const audiencePanelId = `${idPrefix}-audience-panel`;
  const activeAudienceTabId = `${idPrefix}-audience-tab-${activeAudience}`;
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const previewVariableValues = useMemo(
    () => new Map(
      preview.variables.map((variable) => [variable.name, variable.value])
    ),
    [preview.variables]
  );
  const blockLabels = useMemo(() => ({
    ...defaultBlockLabels,
    ...(editor.systemLines
      ? Object.fromEntries(
          editor.systemLines.lines.map((line) => [
            `systemLine:${line.field}`,
            (
              line.label.trim() ||
              editor.systemLines?.available.find(
                (option) => option.field === line.field
              )?.label ||
              'dinamični podatek'
            ).toLocaleLowerCase('sl-SI')
          ])
        )
      : {})
  }), [editor.systemLines]);
  const selectedBlockLabel = selectedBlockId
    ? blockLabels[selectedBlockId] ?? selectedBlockId
    : '';

  useEffect(() => {
    setSelectedBlockId(null);
  }, [activeAudience, idPrefix, selectionKey]);

  return (
    <section
      className={`min-w-0 px-5 py-4 ${className}`}
      aria-labelledby={headingId}
      data-testid={testId}
    >
      <div className="mb-3">
        <Heading id={headingId} className="text-base font-semibold text-slate-900">
          {title}
        </Heading>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600">
            {description}
          </p>
        ) : null}
      </div>

      <div className="mb-4 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end">
          <div className="w-full min-w-0 max-w-sm">{eventSelector}</div>
          <Badge
            variant={activity.tone}
            size="sm"
            className="!h-9 !min-w-0 shrink-0 self-end rounded-md px-3"
            title={activity.title}
            data-testid={`${testId}-activity`}
          >
            {activity.label}
          </Badge>
        </div>
        {recipientControls ? (
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
            {recipientControls}
          </div>
        ) : null}
      </div>

      <section
        className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white"
        data-testid={workspaceTestId}
      >
        <div className="flex min-w-0 flex-col border-b border-slate-200 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
            <EuiTabs
              value={activeAudience}
              onChange={(nextAudience) => {
                setSelectedBlockId(null);
                onAudienceChange(nextAudience as Audience);
              }}
              tabs={audiences.map((audience) => ({
                value: audience.value,
                label: audience.label,
                panelId: audiencePanelId
              }))}
              ariaLabel="Prejemniki predloge sporočila"
              idPrefix={`${idPrefix}-audience`}
              surface="panel"
              variant="secondary"
              className="!border-b-0"
              tabClassName="!min-w-max !px-5"
            />
          </div>
          <div className="flex min-h-[42px] shrink-0 items-center justify-end px-3 py-2 sm:py-0">
            <Button
              type="button"
              variant="default"
              size="toolbar"
              className={adminTableBulkHeaderButtonClassName}
              disabled={editor.disabled || resetDisabled}
              onClick={() => {
                setSelectedBlockId(null);
                onReset();
              }}
              aria-label={resetAriaLabel}
              data-testid={resetTestId}
            >
              {resetLabel}
            </Button>
          </div>
        </div>

        <div
          id={audiencePanelId}
          role="tabpanel"
          aria-labelledby={activeAudienceTabId}
          tabIndex={0}
          className="min-w-0 bg-slate-50/40 p-4 outline-none"
          data-testid={editor.testId}
        >
          <EmailMessagePreview
            {...preview}
            variant="workspace"
            editor={{
              selectedBlockId,
              blockLabels,
              onSelectBlock: setSelectedBlockId,
              toolbar: selectedBlockId ? (
                <EmailTemplateContextToolbar
                  idPrefix={idPrefix}
                  selectedBlockId={selectedBlockId}
                  selectedBlockLabel={selectedBlockLabel}
                  disabled={editor.disabled}
                  subject={editor.subject}
                  contentHtml={editor.contentHtml}
                  variables={editor.variables.map((name) => ({
                    name,
                    value: previewVariableValues.get(name) ?? ''
                  }))}
                  presentation={editor.presentation}
                  onPresentationChange={editor.onPresentationChange}
                  spacingDefaults={editor.spacingDefaults}
                  sharedContent={sharedContent}
                  systemLines={editor.systemLines}
                  onClose={() => setSelectedBlockId(null)}
                />
              ) : null
            }}
          />
        </div>
      </section>
    </section>
  );
}
