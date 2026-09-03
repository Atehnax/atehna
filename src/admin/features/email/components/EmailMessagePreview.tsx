import type { ReactNode } from "react";

const EMAIL_PREVIEW_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";

export type EmailMessagePreviewVariable = {
  name: string;
  value: string;
};

export type EmailMessagePreviewProps = {
  subject: string;
  html: string;
  variables: readonly EmailMessagePreviewVariable[];
  testId: string;
  error?: string | null;
  controls?: ReactNode;
  variant?: "default" | "workspace";
};

export function isolateEmailPreviewHtml(html: string): string {
  const inertHtml = html.replace(
    /\shref\s*=\s*(["'])[\s\S]*?\1/giu,
    ' aria-disabled="true"',
  );
  const policy = `<meta http-equiv="Content-Security-Policy" content="${EMAIL_PREVIEW_CSP}">`;
  if (/<head(?:\s[^>]*)?>/iu.test(inertHtml)) {
    return inertHtml.replace(/<head(?:\s[^>]*)?>/iu, (head) => `${head}${policy}`);
  }
  if (/<html(?:\s[^>]*)?>/iu.test(inertHtml)) {
    return inertHtml.replace(
      /<html(?:\s[^>]*)?>/iu,
      (root) => `${root}<head>${policy}</head>`,
    );
  }
  return `<!doctype html><html><head>${policy}</head><body>${inertHtml}</body></html>`;
}

export default function EmailMessagePreview({
  subject,
  html,
  variables,
  testId,
  error = null,
  controls,
  variant = "default",
}: EmailMessagePreviewProps) {
  const isolatedHtml = isolateEmailPreviewHtml(html);
  const workspace = variant === "workspace";

  return (
    <section
      className={
        workspace
          ? "min-w-0"
          : "mt-4 min-w-0 border-t border-slate-200 pt-4"
      }
      aria-labelledby={`${testId}-heading`}
      data-testid={testId}
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h3
            id={`${testId}-heading`}
            className="text-sm font-semibold text-slate-900"
          >
            Predogled sporočila
          </h3>
          <p className="mt-0.5 max-w-3xl text-xs leading-5 text-slate-500">
            Predogled uporablja spodnje testne podatke in trenutne, tudi še
            neshranjene nastavitve. Sporočilo se ne pošlje.
          </p>
        </div>
        {controls ? <div className="w-full shrink-0 sm:w-56">{controls}</div> : null}
      </div>

      {error ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
          role="status"
          data-testid={`${testId}-error`}
        >
          {error}
        </div>
      ) : (
        <div
          className={
            workspace
              ? "grid min-w-0 gap-3"
              : "grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_16rem]"
          }
        >
          <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Zadeva
              </span>
              <p
                className="mt-0.5 break-words text-sm font-medium text-slate-900"
                data-testid={`${testId}-subject`}
              >
                {subject || "—"}
              </p>
            </div>
            <iframe
              title="Predogled e-poštnega sporočila"
              sandbox=""
              referrerPolicy="no-referrer"
              srcDoc={isolatedHtml}
              className="h-[38rem] w-full border-0 bg-white"
              data-testid={`${testId}-frame`}
            />
          </div>

          <aside className="self-start rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <h4 className="text-xs font-semibold text-slate-800">
              Testne spremenljivke
            </h4>
            <dl className="mt-2 space-y-2" data-testid={`${testId}-variables`}>
              {variables.map((variable) => (
                <div key={variable.name} className="min-w-0">
                  <dt>
                    <code className="break-all text-[11px] text-slate-600">
                      {`{{${variable.name}}}`}
                    </code>
                  </dt>
                  <dd className="mt-0.5 break-words text-xs text-slate-900">
                    {variable.value || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      )}
    </section>
  );
}
