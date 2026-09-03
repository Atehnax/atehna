'use client';

import type { ReactNode } from 'react';
import { Send, Shield } from 'lucide-react';
import AdminRichTextEditor from '@/admin/components/AdminRichTextEditor';
import EmailMessagePreview, {
  type EmailMessagePreviewProps
} from '@/admin/features/email/components/EmailMessagePreview';
import { Badge, type BadgeVariant } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import EuiTabs from '@/shared/ui/eui-tabs';
import { Input } from '@/shared/ui/input';
import { adminTableBulkHeaderButtonClassName } from '@/shared/ui/admin-table';

const inputClassName = 'h-9 px-3 text-[13px] leading-5';

export type EmailTemplateWorkspaceAudience<Audience extends string = string> = {
  value: Audience;
  label: ReactNode;
};

export type EmailTemplateWorkspaceActivity = {
  label: string;
  tone: BadgeVariant;
  title?: string;
};

export type EmailTemplateWorkspaceField = {
  id: string;
  label: string;
  description?: string;
  value: string;
  maxLength: number;
  testId: string;
  onChange: (value: string) => void;
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
  editor: EmailTemplateWorkspaceEditor;
  onReset: () => void;
  resetLabel?: string;
  resetAriaLabel: string;
  resetDisabled?: boolean;
  resetTestId?: string;
  workspaceTestId?: string;
  preview: Omit<EmailMessagePreviewProps, 'variant'>;
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

function FieldLabel({
  htmlFor,
  label,
  description
}: {
  htmlFor: string;
  label: string;
  description?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="block text-xs font-semibold text-slate-700">
        {label}
      </span>
      {description ? (
        <span className="mt-0.5 block text-xs leading-4 text-slate-500">
          {description}
        </span>
      ) : null}
    </label>
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
  editor,
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
  const previewVariableValues = new Map(
    preview.variables.map((variable) => [variable.name, variable.value])
  );

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

      <div
        className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start"
        data-testid={workspaceTestId}
      >
        <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex min-w-0 flex-col border-b border-slate-200 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
              <EuiTabs
                value={activeAudience}
                onChange={(nextAudience) =>
                  onAudienceChange(nextAudience as Audience)
                }
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
                onClick={onReset}
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
            className="min-w-0 p-4 outline-none"
            data-testid={editor.testId}
          >
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">
                {editor.title}
              </h3>
              {editor.description ? (
                <p className="mt-0.5 text-xs leading-4 text-slate-600">
                  {editor.description}
                </p>
              ) : null}
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <FieldLabel
                  htmlFor={editor.subject.id}
                  label={editor.subject.label}
                  description={editor.subject.description}
                />
                <Input
                  id={editor.subject.id}
                  aria-label={editor.subject.label}
                  className={`${inputClassName} mt-1.5`}
                  disabled={editor.disabled}
                  maxLength={editor.subject.maxLength}
                  value={editor.subject.value}
                  onChange={(event) =>
                    editor.subject.onChange(event.target.value)
                  }
                  data-testid={editor.subject.testId}
                />
              </div>

              <div>
                <FieldLabel
                  htmlFor={editor.contentHtml.id}
                  label={editor.contentHtml.label}
                  description={editor.contentHtml.description}
                />
                <div className="mt-1.5">
                  <AdminRichTextEditor
                    id={editor.contentHtml.id}
                    value={editor.contentHtml.value}
                    editable={!editor.disabled}
                    onChange={editor.contentHtml.onChange}
                    placeholder="Vnesite vsebino sporočila …"
                    maxLength={editor.contentHtml.maxLength}
                    testId={editor.contentHtml.testId}
                    ariaLabel={editor.contentHtml.label}
                    allowImages={false}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3 border-t border-slate-200 pt-3">
              <p className="text-xs font-medium text-slate-700">
                {editor.variablesLabel ?? 'Dovoljene spremenljivke'}
              </p>
              <div
                className="mt-1.5 flex flex-wrap gap-1.5"
                aria-label={editor.variablesAriaLabel}
              >
                {editor.variables.map((variable) => (
                  <Badge
                    key={variable}
                    variant="neutral"
                    size="sm"
                    className="!h-auto !min-w-0 max-w-full gap-1 overflow-visible rounded-md !border-slate-200 !bg-slate-50 px-1.5 py-1 text-[11px] font-normal !leading-5 !text-slate-700"
                    title={
                      previewVariableValues.get(variable) || undefined
                    }
                  >
                    <code className="break-all font-semibold !leading-5 text-slate-700">
                      {`{{${variable}}}`}
                    </code>
                    <span aria-hidden="true" className="!leading-5 text-slate-400">·</span>
                    <span className="max-w-40 truncate !leading-5 text-slate-500">
                      {previewVariableValues.get(variable) || '—'}
                    </span>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/40 p-4 lg:h-full">
          <EmailMessagePreview {...preview} variant="workspace" />
        </div>
      </div>
    </section>
  );
}
