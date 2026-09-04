'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { IconButton } from "@/shared/ui/icon-button";

const EMAIL_PREVIEW_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
const WORKSPACE_PREVIEW_DEFAULT_SCALE = 0.9;
const WORKSPACE_PREVIEW_MIN_SCALE = 0.5;
const WORKSPACE_PREVIEW_MAX_SCALE = 1.5;
const WORKSPACE_PREVIEW_SCALE_STEP = 0.1;
const WORKSPACE_PREVIEW_DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeToWorkspaceDesktop(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const mediaQuery = window.matchMedia(WORKSPACE_PREVIEW_DESKTOP_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getWorkspaceDesktopSnapshot() {
  return typeof window !== "undefined"
    && window.matchMedia(WORKSPACE_PREVIEW_DESKTOP_QUERY).matches;
}

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
  const frameRef = useRef<HTMLIFrameElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [workspaceFrameHeight, setWorkspaceFrameHeight] = useState(608);
  const [workspacePreviewScaleOverride, setWorkspacePreviewScaleOverride] = useState<number | null>(null);
  const workspaceUsesDesktopDefault = useSyncExternalStore(
    subscribeToWorkspaceDesktop,
    getWorkspaceDesktopSnapshot,
    () => false,
  );
  const workspaceDefaultScale = workspaceUsesDesktopDefault
    ? WORKSPACE_PREVIEW_DEFAULT_SCALE
    : 1;
  const workspacePreviewScale = workspacePreviewScaleOverride
    ?? workspaceDefaultScale;
  const workspaceDefaultPercent = Math.round(workspaceDefaultScale * 100);
  const workspacePreviewPercent = Math.round(workspacePreviewScale * 100);
  const workspaceRenderedFrameHeight = Math.ceil(
    workspaceFrameHeight * workspacePreviewScale,
  );

  useEffect(
    () => () => resizeObserverRef.current?.disconnect(),
    [],
  );

  const sizeWorkspaceFrame = useCallback(() => {
    if (!workspace) return;
    resizeObserverRef.current?.disconnect();
    const frameDocument = frameRef.current?.contentDocument;
    const frameBody = frameDocument?.body;
    if (!frameDocument || !frameBody) return;

    frameDocument.documentElement.style.overflow = "hidden";
    frameBody.style.overflow = "hidden";
    const updateHeight = () => {
      setWorkspaceFrameHeight(Math.max(320, Math.ceil(frameBody.scrollHeight) + 2));
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(frameBody);
    resizeObserverRef.current = observer;
  }, [workspace]);

  return (
    <section
      className={
        workspace
          ? "min-w-0 lg:flex lg:h-full lg:min-h-0 lg:flex-col"
          : "mt-4 min-w-0 border-t border-slate-200 pt-4"
      }
      aria-labelledby={`${testId}-heading`}
      data-testid={testId}
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:shrink-0">
        <div className="min-w-0">
          <h3
            id={`${testId}-heading`}
            className="text-sm font-semibold text-slate-900"
          >
            Predogled sporočila
          </h3>
        </div>
        {controls || (workspace && !error) ? (
          <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
            {controls ? <div className="w-full sm:w-56">{controls}</div> : null}
            {workspace && !error ? (
              <div
                className="inline-flex items-center gap-1"
                role="group"
                aria-label="Povečava predogleda"
              >
                <IconButton
                  type="button"
                  size="sm"
                  tone="neutral"
                  aria-label="Pomanjšaj predogled"
                  title="Pomanjšaj predogled"
                  disabled={workspacePreviewScale <= WORKSPACE_PREVIEW_MIN_SCALE}
                  onClick={() =>
                    setWorkspacePreviewScaleOverride((current) =>
                      Math.max(
                        WORKSPACE_PREVIEW_MIN_SCALE,
                        (current ?? workspaceDefaultScale)
                          - WORKSPACE_PREVIEW_SCALE_STEP,
                      ),
                    )
                  }
                  data-testid={`${testId}-zoom-out`}
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                </IconButton>
                <Button
                  type="button"
                  variant="default"
                  size="toolbar"
                  className="!h-7 min-w-14 px-2 text-[11px] font-semibold tabular-nums"
                  aria-label={`${workspacePreviewPercent} %; ponastavi povečavo na ${workspaceDefaultPercent} %`}
                  title={`Ponastavi povečavo na ${workspaceDefaultPercent} %`}
                  onClick={() => setWorkspacePreviewScaleOverride(null)}
                  data-testid={`${testId}-zoom-reset`}
                >
                  <output aria-live="polite">{workspacePreviewPercent} %</output>
                </Button>
                <IconButton
                  type="button"
                  size="sm"
                  tone="neutral"
                  aria-label="Povečaj predogled"
                  title="Povečaj predogled"
                  disabled={workspacePreviewScale >= WORKSPACE_PREVIEW_MAX_SCALE}
                  onClick={() =>
                    setWorkspacePreviewScaleOverride((current) =>
                      Math.min(
                        WORKSPACE_PREVIEW_MAX_SCALE,
                        (current ?? workspaceDefaultScale)
                          + WORKSPACE_PREVIEW_SCALE_STEP,
                      ),
                    )
                  }
                  data-testid={`${testId}-zoom-in`}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </IconButton>
              </div>
            ) : null}
          </div>
        ) : null}
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
              ? "grid min-w-0 gap-3 lg:min-h-0 lg:flex-1 lg:grid-rows-[minmax(0,1fr)]"
              : "grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_16rem]"
          }
        >
          <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white lg:flex lg:min-h-0 lg:flex-col">
            <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
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
            {workspace ? (
              <div
                role="region"
                tabIndex={0}
                aria-label="Območje predogleda sporočila"
                className="h-[32rem] min-h-0 overflow-auto bg-slate-100/60 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--blue-500)] lg:h-auto lg:flex-1"
                data-testid={`${testId}-viewport`}
              >
                <div
                  className="relative mx-auto min-w-0 overflow-hidden bg-white"
                  style={{
                    width: `${workspacePreviewPercent}%`,
                    height: workspaceRenderedFrameHeight,
                  }}
                  data-testid={`${testId}-stage`}
                >
                  <iframe
                    ref={frameRef}
                    title="Predogled e-poštnega sporočila"
                    sandbox="allow-same-origin"
                    referrerPolicy="no-referrer"
                    srcDoc={isolatedHtml}
                    scrolling="no"
                    style={{
                      height: workspaceFrameHeight,
                      width: `${100 / workspacePreviewScale}%`,
                      transform: `scale(${workspacePreviewScale})`,
                      transformOrigin: "top left",
                    }}
                    className="absolute left-0 top-0 overflow-hidden border-0 bg-white"
                    onLoad={sizeWorkspaceFrame}
                    data-testid={`${testId}-frame`}
                  />
                </div>
              </div>
            ) : (
              <iframe
                ref={frameRef}
                title="Predogled e-poštnega sporočila"
                sandbox="allow-same-origin"
                referrerPolicy="no-referrer"
                srcDoc={isolatedHtml}
                scrolling="auto"
                className="h-[38rem] w-full border-0 bg-white"
                data-testid={`${testId}-frame`}
              />
            )}
          </div>

          {!workspace ? <aside className="self-start rounded-lg border border-slate-200 bg-slate-50/60 p-3">
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
          </aside> : null}
        </div>
      )}
    </section>
  );
}
