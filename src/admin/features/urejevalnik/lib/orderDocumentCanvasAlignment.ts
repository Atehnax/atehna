export const ORDER_DOCUMENT_ALIGNMENT_SNAP_THRESHOLD_MM = 1.6;

export type OrderDocumentAlignmentAxis = 'x' | 'y';
export type OrderDocumentHorizontalAnchor = 'left' | 'center' | 'right';
export type OrderDocumentVerticalAnchor = 'top' | 'middle' | 'bottom';
export type OrderDocumentAlignmentAnchor =
  | OrderDocumentHorizontalAnchor
  | OrderDocumentVerticalAnchor;

export type OrderDocumentAlignmentRect = {
  id: string;
  label?: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  visible?: boolean;
};

export type OrderDocumentAlignmentGuide = {
  axis: OrderDocumentAlignmentAxis;
  positionMm: number;
  movingAnchor: OrderDocumentAlignmentAnchor;
  targetAnchor: OrderDocumentAlignmentAnchor;
  targetId: string;
  targetKind: 'element' | 'page-margin';
  targetLabel: string;
  label: string;
  /** Position for the editor-only label along the guide's opposite axis. */
  markerMm: number;
};

export type ResolveOrderDocumentAlignmentInput = {
  moving: OrderDocumentAlignmentRect;
  targets: ReadonlyArray<OrderDocumentAlignmentRect>;
  pageWidthMm: number;
  pageHeightMm: number;
  pageMarginMm: number;
  thresholdMm?: number;
  /** Show matching guides without magnetically changing the raw position. */
  snap?: boolean;
};

export type ResolvedOrderDocumentAlignment = {
  xMm: number;
  yMm: number;
  guides: ReadonlyArray<OrderDocumentAlignmentGuide>;
};

type AxisAnchor = {
  anchor: OrderDocumentAlignmentAnchor;
  positionMm: number;
};

type AlignmentCandidate = AxisAnchor & {
  targetId: string;
  targetKind: OrderDocumentAlignmentGuide['targetKind'];
  targetLabel: string;
};

type AxisResolution = {
  positionMm: number;
  guide?: OrderDocumentAlignmentGuide;
};

const HORIZONTAL_ANCHOR_LABELS: Record<OrderDocumentHorizontalAnchor, string> = {
  left: 'levi rob',
  center: 'vodoravna sredina',
  right: 'desni rob'
};

const VERTICAL_ANCHOR_LABELS: Record<OrderDocumentVerticalAnchor, string> = {
  top: 'zgornji rob',
  middle: 'navpična sredina',
  bottom: 'spodnji rob'
};

const roundMm = (value: number) => Math.round(value * 10) / 10;

function anchorsForRect(
  rect: Pick<OrderDocumentAlignmentRect, 'xMm' | 'yMm' | 'widthMm' | 'heightMm'>,
  axis: OrderDocumentAlignmentAxis
): AxisAnchor[] {
  if (axis === 'x') {
    return [
      { anchor: 'left', positionMm: rect.xMm },
      { anchor: 'center', positionMm: rect.xMm + rect.widthMm / 2 },
      { anchor: 'right', positionMm: rect.xMm + rect.widthMm }
    ];
  }
  return [
    { anchor: 'top', positionMm: rect.yMm },
    { anchor: 'middle', positionMm: rect.yMm + rect.heightMm / 2 },
    { anchor: 'bottom', positionMm: rect.yMm + rect.heightMm }
  ];
}

function pageMarginCandidates(
  axis: OrderDocumentAlignmentAxis,
  pageWidthMm: number,
  pageHeightMm: number,
  pageMarginMm: number
): AlignmentCandidate[] {
  if (axis === 'x') {
    return [
      {
        anchor: 'left',
        positionMm: pageMarginMm,
        targetId: 'page-margin-left',
        targetKind: 'page-margin',
        targetLabel: 'Levi rob strani'
      },
      {
        anchor: 'center',
        positionMm: pageWidthMm / 2,
        targetId: 'page-center-x',
        targetKind: 'page-margin',
        targetLabel: 'Vodoravna sredina strani'
      },
      {
        anchor: 'right',
        positionMm: pageWidthMm - pageMarginMm,
        targetId: 'page-margin-right',
        targetKind: 'page-margin',
        targetLabel: 'Desni rob strani'
      }
    ];
  }
  return [
    {
      anchor: 'top',
      positionMm: pageMarginMm,
      targetId: 'page-margin-top',
      targetKind: 'page-margin',
      targetLabel: 'Zgornji rob strani'
    },
    {
      anchor: 'middle',
      positionMm: pageHeightMm / 2,
      targetId: 'page-center-y',
      targetKind: 'page-margin',
      targetLabel: 'Navpična sredina strani'
    },
    {
      anchor: 'bottom',
      positionMm: pageHeightMm - pageMarginMm,
      targetId: 'page-margin-bottom',
      targetKind: 'page-margin',
      targetLabel: 'Spodnji rob strani'
    }
  ];
}

function anchorLabel(anchor: OrderDocumentAlignmentAnchor) {
  return anchor in HORIZONTAL_ANCHOR_LABELS
    ? HORIZONTAL_ANCHOR_LABELS[anchor as OrderDocumentHorizontalAnchor]
    : VERTICAL_ANCHOR_LABELS[anchor as OrderDocumentVerticalAnchor];
}

function guideLabel(
  movingAnchor: OrderDocumentAlignmentAnchor,
  candidate: AlignmentCandidate
) {
  if (candidate.targetKind === 'page-margin') return candidate.targetLabel;
  const movingLabel = anchorLabel(movingAnchor);
  const targetAnchorLabel = anchorLabel(candidate.anchor);
  return movingAnchor === candidate.anchor
    ? `${candidate.targetLabel} · ${targetAnchorLabel}`
    : `${movingLabel} ↔ ${candidate.targetLabel} · ${targetAnchorLabel}`;
}

function resolveAxis(
  axis: OrderDocumentAlignmentAxis,
  moving: OrderDocumentAlignmentRect,
  targets: ReadonlyArray<OrderDocumentAlignmentRect>,
  pageWidthMm: number,
  pageHeightMm: number,
  pageMarginMm: number,
  thresholdMm: number
): AxisResolution {
  const movingAnchors = anchorsForRect(moving, axis);
  const candidates = [
    ...pageMarginCandidates(axis, pageWidthMm, pageHeightMm, pageMarginMm),
    ...targets.flatMap((target): AlignmentCandidate[] => {
      if (target.visible === false || target.id === moving.id) return [];
      return anchorsForRect(target, axis).map((anchor) => ({
        ...anchor,
        targetId: target.id,
        targetKind: 'element',
        targetLabel: target.label || 'Element'
      }));
    })
  ];

  let closest: {
    distance: number;
    sameAnchor: boolean;
    movingAnchor: AxisAnchor;
    candidate: AlignmentCandidate;
  } | null = null;

  for (const movingAnchor of movingAnchors) {
    for (const candidate of candidates) {
      // Page guides represent true content margins: left aligns to left,
      // centre to centre and right to right (the vertical equivalents apply).
      if (
        candidate.targetKind === 'page-margin'
        && movingAnchor.anchor !== candidate.anchor
      ) continue;
      const distance = Math.abs(movingAnchor.positionMm - candidate.positionMm);
      if (distance > thresholdMm) continue;
      const sameAnchor = movingAnchor.anchor === candidate.anchor;
      if (
        !closest
        || distance < closest.distance
        || (distance === closest.distance && sameAnchor && !closest.sameAnchor)
        || (
          distance === closest.distance
          && sameAnchor === closest.sameAnchor
          && candidate.targetKind === 'page-margin'
          && closest.candidate.targetKind !== 'page-margin'
        )
      ) {
        closest = { distance, sameAnchor, movingAnchor, candidate };
      }
    }
  }

  if (!closest) {
    return { positionMm: axis === 'x' ? moving.xMm : moving.yMm };
  }

  const startPosition = axis === 'x' ? moving.xMm : moving.yMm;
  const snappedPosition = startPosition
    + closest.candidate.positionMm
    - closest.movingAnchor.positionMm;
  return {
    positionMm: roundMm(snappedPosition),
    guide: {
      axis,
      positionMm: closest.candidate.positionMm,
      movingAnchor: closest.movingAnchor.anchor,
      targetAnchor: closest.candidate.anchor,
      targetId: closest.candidate.targetId,
      targetKind: closest.candidate.targetKind,
      targetLabel: closest.candidate.targetLabel,
      label: guideLabel(closest.movingAnchor.anchor, closest.candidate),
      markerMm: axis === 'x'
        ? moving.yMm + moving.heightMm / 2
        : moving.xMm + moving.widthMm / 2
    }
  };
}

/**
 * Resolves one transient drag frame. The resolver deliberately has no memory:
 * leaving the threshold immediately restores the pointer's raw position, so a
 * suggested alignment can never trap an element or make reverse movement hard.
 */
export function resolveOrderDocumentCanvasAlignment({
  moving,
  targets,
  pageWidthMm,
  pageHeightMm,
  pageMarginMm,
  thresholdMm = ORDER_DOCUMENT_ALIGNMENT_SNAP_THRESHOLD_MM,
  snap = true
}: ResolveOrderDocumentAlignmentInput): ResolvedOrderDocumentAlignment {
  if (!Number.isFinite(thresholdMm) || thresholdMm < 0) {
    return { xMm: moving.xMm, yMm: moving.yMm, guides: [] };
  }
  const horizontal = resolveAxis(
    'x',
    moving,
    targets,
    pageWidthMm,
    pageHeightMm,
    pageMarginMm,
    thresholdMm
  );
  const vertical = resolveAxis(
    'y',
    moving,
    targets,
    pageWidthMm,
    pageHeightMm,
    pageMarginMm,
    thresholdMm
  );
  const xMm = snap ? horizontal.positionMm : moving.xMm;
  const yMm = snap ? vertical.positionMm : moving.yMm;
  return {
    xMm,
    yMm,
    guides: [horizontal.guide, vertical.guide].filter(
      (guide): guide is OrderDocumentAlignmentGuide => Boolean(guide)
    ).map((guide) => ({
      ...guide,
      markerMm: guide.axis === 'x'
        ? yMm + moving.heightMm / 2
        : xMm + moving.widthMm / 2
    }))
  };
}
