import type { GeographyFeature, GeographyReference, Position } from '@/shared/domain/analytics/geography';
import type { BusinessRecord } from '@/shared/domain/analytics/businessAnalytics';

export type GeographyOverviewArea = { id: string; code: string; name: string; level: 'municipality' | 'region'; regionId: string | null; orderCount: number; activityValue: number | null; knownValueOrders: number; distinctCustomers: number; mappedShare: number | null; municipalityResolvedOrders: number; regionOnlyOrders: number };
export type GeographyResponse = {
  basis: 'activity' | 'paid'; asOf: string; reference: { metadata: GeographyReference['metadata']; assetUrl: string; latestVersion: string | null; lastError: string | null };
  areas: GeographyOverviewArea[]; reconciliation: { allEligibleOrders: number; mappedSlovenianOrders: number; unresolvedSlovenianOrders: number; foreignOrders: number; unknownCountryOrders: number; regionOnlyResolvedOrders: number };
  coverage: { resolvedOrders: number; missingReferenceGeometry: number; staleAddressResolutions: number; otherVintageOrders: number; unlinkedCustomerOrders: number };
  unresolved: { id: string; number: string; status: string; method: string; href: string }[];
  addressSource: { imported_at: string | null; source_updated_at: string | null; total: number; linked: number } | null;
  denominator: string; selected: { id: string; total: number; records: BusinessRecord[] } | null;
};

export const geographyColors = ['#e2e8f0', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#15803d'];
export const projectGeographyPosition = ([longitude, latitude]: Position): Position => [longitude * Math.cos(46 * Math.PI / 180), -latitude];
export function geographyPath(feature: GeographyFeature) {
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  return polygons.map(polygon => polygon.map(ring => ring.map((point, index) => (index ? 'L' : 'M') + projectGeographyPosition(point).join(',')).join(' ') + ' Z').join(' ')).join(' ');
}
export function geographyBounds(features: GeographyFeature[]) {
  const coordinates = features.flatMap(feature => (feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates).flatMap(polygon => polygon.flatMap(ring => ring.map(projectGeographyPosition))));
  if (!coordinates.length) return { x: 0, y: 0, width: 2, height: 1 };
  let x = Infinity, y = Infinity, right = -Infinity, bottom = -Infinity;
  for (const point of coordinates) { x = Math.min(x, point[0]); y = Math.min(y, point[1]); right = Math.max(right, point[0]); bottom = Math.max(bottom, point[1]); }
  const padding = (right - x) * .025;
  return { x: x - padding, y: y - padding, width: right - x + padding * 2, height: bottom - y + padding * 2 };
}
