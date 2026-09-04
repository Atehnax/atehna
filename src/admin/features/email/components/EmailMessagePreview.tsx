'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { Minus, Plus } from "lucide-react";
import { FloatingAppearanceEditorContextToolbar } from "@/admin/features/podoba/components/AppearanceEditorToolbarPrimitives";
import { Button } from "@/shared/ui/button";
import { IconButton } from "@/shared/ui/icon-button";
import { adminEditorSelectionOutlineTokenClasses } from "@/shared/ui/theme/tokens";

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

export type EmailMessagePreviewEditor = {
  selectedBlockId: string | null;
  blockLabels: Readonly<Record<string, string>>;
  onSelectBlock: (blockId: string | null) => void;
  toolbar: ReactNode;
};

export type EmailMessagePreviewProps = {
  subject: string;
  html: string;
  variables: readonly EmailMessagePreviewVariable[];
  testId: string;
  error?: string | null;
  controls?: ReactNode;
  variant?: "default" | "workspace";
  editor?: EmailMessagePreviewEditor;
};

type EmailEditorBlockOverlay = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

function emailEditorBlockOverlaysEqual(
  current: readonly EmailEditorBlockOverlay[],
  next: readonly EmailEditorBlockOverlay[],
) {
  return current.length === next.length
    && current.every((block, index) => {
      const candidate = next[index];
      return candidate !== undefined
        && block.id === candidate.id
        && block.left === candidate.left
        && block.top === candidate.top
        && block.width === candidate.width
        && block.height === candidate.height;
    });
}

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
  editor,
}: EmailMessagePreviewProps) {
  const isolatedHtml = isolateEmailPreviewHtml(html);
  const workspace = variant === "workspace";
  const editorEnabled = workspace && editor !== undefined;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const previewStageRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const previewResizeObserverRef = useRef<ResizeObserver | null>(null);
  const frameMutationObserverRef = useRef<MutationObserver | null>(null);
  const frameInteractionCleanupRef = useRef<(() => void) | null>(null);
  const editorMeasurementFrameRef = useRef<number | null>(null);
  const editorDismissFrameRef = useRef<number | null>(null);
  const editorStateRef = useRef({
    enabled: editorEnabled,
    selectedBlockId: editor?.selectedBlockId ?? null,
    onSelectBlock: editor?.onSelectBlock,
  });
  editorStateRef.current = {
    enabled: editorEnabled,
    selectedBlockId: editor?.selectedBlockId ?? null,
    onSelectBlock: editor?.onSelectBlock,
  };
  const [workspaceFrameHeight, setWorkspaceFrameHeight] = useState(608);
  const [workspacePreviewScaleOverride, setWorkspacePreviewScaleOverride] = useState<number | null>(null);
  const [editorBlockOverlays, setEditorBlockOverlays] = useState<EmailEditorBlockOverlay[]>([]);
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

  const measureEditorBlocks = useCallback(() => {
    if (!editorEnabled) {
      setEditorBlockOverlays((current) => current.length === 0 ? current : []);
      return;
    }

    const frame = frameRef.current;
    const frameDocument = frame?.contentDocument;
    const stage = previewStageRef.current;
    if (!frame || !frameDocument || !stage) return;

    const frameRect = frame.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const frameViewportWidth = frame.contentWindow?.innerWidth || frame.clientWidth;
    const frameViewportHeight = frame.contentWindow?.innerHeight || frame.clientHeight;
    if (
      frameRect.width <= 0
      || frameRect.height <= 0
      || stageRect.width <= 0
      || stageRect.height <= 0
      || frameViewportWidth <= 0
      || frameViewportHeight <= 0
    ) {
      return;
    }

    const scaleX = frameRect.width / frameViewportWidth;
    const scaleY = frameRect.height / frameViewportHeight;
    const seenIds = new Set<string>();
    const next: EmailEditorBlockOverlay[] = [];

    frameDocument
      .querySelectorAll<HTMLElement>("[data-email-editor-id]")
      .forEach((element) => {
        const id = element.dataset.emailEditorId?.trim();
        if (!id || id === "subject" || seenIds.has(id)) return;

        const rect = element.getBoundingClientRect();
        const rawLeft = frameRect.left - stageRect.left + rect.left * scaleX;
        const rawTop = frameRect.top - stageRect.top + rect.top * scaleY;
        const left = Math.max(0, rawLeft);
        const top = Math.max(0, rawTop);
        const right = Math.min(stageRect.width, rawLeft + rect.width * scaleX);
        const bottom = Math.min(stageRect.height, rawTop + rect.height * scaleY);
        if (right <= left || bottom <= top) return;

        seenIds.add(id);
        next.push({
          id,
          left: Math.round(left),
          top: Math.round(top),
          width: Math.max(1, Math.round(right - left)),
          height: Math.max(1, Math.round(bottom - top)),
        });
      });

    setEditorBlockOverlays((current) =>
      emailEditorBlockOverlaysEqual(current, next) ? current : next,
    );
  }, [editorEnabled]);

  const scheduleEditorBlockMeasurement = useCallback(() => {
    if (!editorEnabled || editorMeasurementFrameRef.current !== null) return;
    editorMeasurementFrameRef.current = window.requestAnimationFrame(() => {
      editorMeasurementFrameRef.current = null;
      measureEditorBlocks();
    });
  }, [editorEnabled, measureEditorBlocks]);

  useEffect(() => () => {
    resizeObserverRef.current?.disconnect();
    previewResizeObserverRef.current?.disconnect();
    frameMutationObserverRef.current?.disconnect();
    frameInteractionCleanupRef.current?.();
    if (editorMeasurementFrameRef.current !== null) {
      window.cancelAnimationFrame(editorMeasurementFrameRef.current);
    }
    if (editorDismissFrameRef.current !== null) {
      window.cancelAnimationFrame(editorDismissFrameRef.current);
    }
  }, []);

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
      scheduleEditorBlockMeasurement();
    };
    updateHeight();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateHeight);
      observer.observe(frameBody);
      resizeObserverRef.current = observer;
    }

    frameMutationObserverRef.current?.disconnect();
    if (editorEnabled && typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver(scheduleEditorBlockMeasurement);
      observer.observe(frameBody, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ["class", "style", "data-email-editor-id"],
      });
      frameMutationObserverRef.current = observer;
    }

    frameInteractionCleanupRef.current?.();
    const handleFramePointerDown = (event: PointerEvent) => {
      const currentEditor = editorStateRef.current;
      if (!currentEditor.enabled) return;
      const target = event.target instanceof Element
        ? event.target
        : event.target instanceof Node
          ? event.target.parentElement
          : null;
      const markedBlock = target?.closest<HTMLElement>("[data-email-editor-id]");
      const blockId = markedBlock?.dataset.emailEditorId?.trim();
      currentEditor.onSelectBlock?.(blockId && blockId !== "subject" ? blockId : null);
    };
    const handleFrameKeyDown = (event: KeyboardEvent) => {
      const currentEditor = editorStateRef.current;
      if (
        event.key !== "Escape"
        || event.defaultPrevented
        || !currentEditor.enabled
        || !currentEditor.selectedBlockId
      ) {
        return;
      }
      currentEditor.onSelectBlock?.(null);
    };
    frameDocument.addEventListener("pointerdown", handleFramePointerDown);
    frameDocument.addEventListener("keydown", handleFrameKeyDown);
    frameInteractionCleanupRef.current = () => {
      frameDocument.removeEventListener("pointerdown", handleFramePointerDown);
      frameDocument.removeEventListener("keydown", handleFrameKeyDown);
    };

    scheduleEditorBlockMeasurement();
  }, [editorEnabled, scheduleEditorBlockMeasurement, workspace]);

  useEffect(() => {
    if (
      workspace
      && frameRef.current?.contentDocument?.readyState === "complete"
    ) {
      sizeWorkspaceFrame();
    }
  }, [sizeWorkspaceFrame, workspace]);

  useEffect(() => {
    if (!editorEnabled) {
      frameMutationObserverRef.current?.disconnect();
      if (editorMeasurementFrameRef.current !== null) {
        window.cancelAnimationFrame(editorMeasurementFrameRef.current);
        editorMeasurementFrameRef.current = null;
      }
      setEditorBlockOverlays((current) => current.length === 0 ? current : []);
      return undefined;
    }

    const viewport = previewViewportRef.current;
    previewResizeObserverRef.current?.disconnect();
    if (viewport && typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(scheduleEditorBlockMeasurement);
      observer.observe(viewport);
      previewResizeObserverRef.current = observer;
    }

    viewport?.addEventListener("scroll", scheduleEditorBlockMeasurement, { passive: true });
    window.addEventListener("resize", scheduleEditorBlockMeasurement);
    window.addEventListener("scroll", scheduleEditorBlockMeasurement, true);
    window.visualViewport?.addEventListener("resize", scheduleEditorBlockMeasurement);
    window.visualViewport?.addEventListener("scroll", scheduleEditorBlockMeasurement);
    scheduleEditorBlockMeasurement();

    return () => {
      previewResizeObserverRef.current?.disconnect();
      viewport?.removeEventListener("scroll", scheduleEditorBlockMeasurement);
      window.removeEventListener("resize", scheduleEditorBlockMeasurement);
      window.removeEventListener("scroll", scheduleEditorBlockMeasurement, true);
      window.visualViewport?.removeEventListener("resize", scheduleEditorBlockMeasurement);
      window.visualViewport?.removeEventListener("scroll", scheduleEditorBlockMeasurement);
    };
  }, [editorEnabled, scheduleEditorBlockMeasurement]);

  useEffect(() => {
    scheduleEditorBlockMeasurement();
  }, [
    html,
    scheduleEditorBlockMeasurement,
    workspaceFrameHeight,
    workspacePreviewScale,
  ]);

  const selectEditorBlock = useCallback((blockId: string) => {
    editor?.onSelectBlock(blockId);
  }, [editor]);

  const dismissEditorSelection = useCallback(() => {
    const selectedBlockId = editorStateRef.current.selectedBlockId;
    if (!selectedBlockId) return;
    if (editorDismissFrameRef.current !== null) {
      window.cancelAnimationFrame(editorDismissFrameRef.current);
    }
    editorDismissFrameRef.current = window.requestAnimationFrame(() => {
      editorDismissFrameRef.current = null;
      const currentEditor = editorStateRef.current;
      if (currentEditor.selectedBlockId === selectedBlockId) {
        currentEditor.onSelectBlock?.(null);
      }
    });
  }, []);

  useEffect(() => {
    if (!editorEnabled || !editor?.selectedBlockId) return undefined;
    const selectedBlockId = editor.selectedBlockId;
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const selectedTarget = Array.from(
        previewFrameRef.current?.querySelectorAll<HTMLElement>("[data-canvas-element-id]") ?? [],
      ).find((element) => element.dataset.canvasElementId === selectedBlockId);
      editor.onSelectBlock(null);
      window.requestAnimationFrame(() => selectedTarget?.focus());
    };
    window.addEventListener("keydown", dismissOnEscape);
    return () => window.removeEventListener("keydown", dismissOnEscape);
  }, [editor, editorEnabled]);

  const renderEditorTarget = useCallback((
    blockId: string,
    className: string,
    style?: CSSProperties,
  ) => {
    if (!editorEnabled || !editor) return null;
    const selected = editor.selectedBlockId === blockId;
    const label = editor.blockLabels[blockId]
      ?? (blockId === "subject" ? "zadevo" : blockId);
    const handleKeyboardSelection = (
      event: ReactKeyboardEvent<HTMLButtonElement>,
    ) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectEditorBlock(blockId);
    };

    return (
      <button
        key={blockId}
        type="button"
        className={`${className} border-0 bg-transparent p-0 transition-shadow hover:ring-1 hover:ring-inset hover:ring-blue-300 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--blue-500)] ${selected ? adminEditorSelectionOutlineTokenClasses : "rounded-xl"}`}
        style={style}
        aria-label={`Uredi ${label}`}
        aria-pressed={selected}
        data-canvas-element-id={blockId}
        data-canvas-element-selected={selected ? "true" : undefined}
        data-email-editor-overlay={blockId}
        onClick={() => selectEditorBlock(blockId)}
        onKeyDown={handleKeyboardSelection}
        data-testid={`${testId}-editor-block-${blockId}`}
      />
    );
  }, [editor, editorEnabled, selectEditorBlock, testId]);

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
          <div
            ref={previewFrameRef}
            className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white lg:flex lg:min-h-0 lg:flex-col"
          >
            <div className="relative shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Zadeva
              </span>
              <p
                className="mt-0.5 break-words text-sm font-medium text-slate-900"
                data-testid={`${testId}-subject`}
              >
                {subject || "—"}
              </p>
              {renderEditorTarget(
                "subject",
                "absolute inset-0 z-10 cursor-pointer",
              )}
            </div>
            {workspace ? (
              <div
                ref={previewViewportRef}
                role="region"
                tabIndex={0}
                aria-label="Območje predogleda sporočila"
                className="h-[37rem] min-h-0 overflow-auto bg-slate-100/60 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--blue-500)]"
                data-testid={`${testId}-viewport`}
              >
                <div
                  ref={previewStageRef}
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
                  {editorEnabled ? (
                    <div
                      className="pointer-events-none absolute inset-0 z-10"
                      role="group"
                      aria-label="Uredljivi deli predogleda"
                      data-testid={`${testId}-editor-overlays`}
                    >
                      {editorBlockOverlays.map((block) =>
                        renderEditorTarget(
                          block.id,
                          "pointer-events-auto absolute cursor-pointer",
                          {
                            left: block.left,
                            top: block.top,
                            width: block.width,
                            height: block.height,
                          },
                        ),
                      )}
                    </div>
                  ) : null}
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
            {editorEnabled && editor?.selectedBlockId ? (
              <FloatingAppearanceEditorContextToolbar
                anchorId={editor.selectedBlockId}
                frameRef={previewFrameRef}
                viewportRef={previewFrameRef}
                scrollRegionRef={previewViewportRef}
                ariaLabel={`Orodna vrstica: ${editor.blockLabels[editor.selectedBlockId] ?? editor.selectedBlockId}`}
                testId={`${testId}-editor-toolbar`}
                onDismiss={dismissEditorSelection}
              >
                {editor.toolbar}
              </FloatingAppearanceEditorContextToolbar>
            ) : null}
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
