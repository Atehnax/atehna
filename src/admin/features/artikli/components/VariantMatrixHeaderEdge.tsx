/** A single one-pixel stroke owns the diagonal and straight parts of an edge. */
export function VariantMatrixHeaderEdge({ side, diagonalHeight, height, highlighted = false }: {
  side: 'left' | 'right'; diagonalHeight: number; height: number; highlighted?: boolean;
}) {
  return <svg
    aria-hidden="true"
    className={`pointer-events-none absolute top-0 z-20 w-px overflow-visible ${highlighted ? 'text-[color:var(--blue-500)]' : 'text-[color:var(--border)]'}`}
    style={{ height, ...(side === 'left' ? { left: -1 } : { right: 0 }) }}
    data-matrix-edge={side}
  >
    <polyline
      points={`${0.5 - diagonalHeight},0 0.5,${diagonalHeight} 0.5,${height}`}
      fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  </svg>;
}
