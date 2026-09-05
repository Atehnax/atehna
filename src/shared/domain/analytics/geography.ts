import { normalizeAddressSearchText } from '@/shared/domain/address/gursAddress';

export type Position = [number, number];
export type PolygonGeometry = { type: 'Polygon'; coordinates: Position[][] } | { type: 'MultiPolygon'; coordinates: Position[][][] };
export type GeographyFeature = { type: 'Feature'; geometry: PolygonGeometry; properties: { id: string; code: string; name: string; level: 'municipality' | 'region'; regionId: string | null } };
export type GeographyReference = {
  type: 'FeatureCollection';
  features: GeographyFeature[];
  metadata: {
    version: string; importedAt: string; sourceUpdatedAt: { municipalities: string; regions: string };
    attribution: string; licence: string; sourceCrs: string; renderCrs: string;
    counts: { municipalities: number; regions: number }; sources: string[];
    crosswalkMethod: string;
  };
};
export type AddressSnapshot = { addressLine1?: unknown; addressLine2?: unknown; city?: unknown; postalCode?: unknown; countryCode?: unknown; gursHouseNumberId?: unknown };
export type GeographyResolution = {
  orderId: string; fingerprint: string; addressBasis: string; status: 'municipality' | 'region_only' | 'ambiguous' | 'unmatched' | 'partial' | 'foreign' | 'unknown_country';
  method: string; municipalityId: string | null; regionId: string | null; officialAddressId: string | null;
  sourceVersion: string; resolvedAt: string; manual: boolean; registrySourceVersion?: string | null;
};
export type GeographyAddressCandidate = {
  officialAddressId: string | null; houseNumberId: string; municipalityId: string | null; regionId: string | null;
  addressLine1: string; settlement: string; postalName: string; postalCode: string; easting?: number | null; northing?: number | null; sourceUpdatedAt?: string | null; importedAt?: string | null;
};
const stringValue = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export function normalizedAddressLine(value: string) {
  return normalizeAddressSearchText(value).replace(/([0-9]) +([a-z])$/, '$1$2');
}
export function normalizedSnapshot(address: AddressSnapshot) {
  return {
    addressLine1: normalizedAddressLine(stringValue(address.addressLine1)),
    addressLine2: normalizeAddressSearchText(stringValue(address.addressLine2)),
    city: normalizeAddressSearchText(stringValue(address.city)),
    postalCode: stringValue(address.postalCode),
    countryCode: stringValue(address.countryCode).toUpperCase(),
    gursHouseNumberId: stringValue(address.gursHouseNumberId)
  };
}
export function candidateMatchesSnapshot(address: AddressSnapshot, candidate: GeographyAddressCandidate) {
  const normalized = normalizedSnapshot(address);
  return Boolean(normalized.addressLine1 && normalized.city && normalized.countryCode === 'SI'
    && normalized.addressLine1 === normalizedAddressLine(candidate.addressLine1)
    && [candidate.settlement, candidate.postalName].some((city) => normalizeAddressSearchText(city) === normalized.city)
    && (!normalized.postalCode || normalized.postalCode === candidate.postalCode));
}
export function resolveAddressCandidates(address: AddressSnapshot, candidates: GeographyAddressCandidate[]) {
  const normalized = normalizedSnapshot(address);
  if (!normalized.countryCode) return { status: 'unknown_country' as const, candidate: null, method: 'missing_country' };
  if (normalized.countryCode !== 'SI') return { status: 'foreign' as const, candidate: null, method: 'saved_country' };
  if (!normalized.addressLine1 || !normalized.city) return { status: 'partial' as const, candidate: null, method: 'incomplete_saved_address' };
  const matched = candidates.filter((candidate) => candidateMatchesSnapshot(address, candidate));
  const identifierMatches = normalized.gursHouseNumberId ? matched.filter((candidate) => candidate.houseNumberId === normalized.gursHouseNumberId) : [];
  const usable = identifierMatches.length ? identifierMatches : matched;
  if (!usable.length) return { status: 'unmatched' as const, candidate: null, method: 'no_exact_registry_match' };
  const samePoint = usable.every((candidate) => candidate.easting === usable[0].easting && candidate.northing === usable[0].northing);
  const uniqueCandidate = usable.length === 1 ? usable[0] : { ...usable[0], officialAddressId: null, easting: samePoint ? usable[0].easting : null, northing: samePoint ? usable[0].northing : null };
  const municipalities = new Set(usable.map((candidate) => candidate.municipalityId).filter(Boolean));
  const regions = new Set(usable.map((candidate) => candidate.regionId).filter(Boolean));
  if (municipalities.size === 1 && usable.every((candidate) => Boolean(candidate.municipalityId))) {
    return { status: 'municipality' as const, candidate: uniqueCandidate, method: usable.length > 1 ? 'exact_address_unique_municipality' : identifierMatches.length ? 'saved_official_house_id_verified_address' : 'exact_full_address' };
  }
  if (municipalities.size === 0 && regions.size === 1 && usable.every((candidate) => Boolean(candidate.regionId))) {
    return { status: 'region_only' as const, candidate: uniqueCandidate, method: 'exact_address_unique_region' };
  }
  if (usable.length === 1 && usable[0].easting != null && usable[0].northing != null && municipalities.size === 0 && regions.size === 0) {
    return { status: 'unmatched' as const, candidate: usable[0], method: 'official_centroid_requires_spatial_join' };
  }
  return { status: 'ambiguous' as const, candidate: null, method: 'multiple_geographic_matches' };
}
export function polygonParts(geometry: PolygonGeometry): Position[][][] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}
export function geometryVertexCount(geometry: PolygonGeometry) {
  return polygonParts(geometry).reduce((count, polygon) => count + polygon.reduce((total, ring) => total + ring.length, 0), 0);
}
export function validateReference(reference: GeographyReference) {
  const ids = new Set<string>();
  const regions = new Set(reference.features.filter((feature) => feature.properties.level === 'region').map((feature) => feature.properties.id));
  const municipalities = reference.features.filter((feature) => feature.properties.level === 'municipality');
  if (!regions.size || !municipalities.length) throw new Error('Reference has no geographic units.');
  for (const feature of reference.features) {
    if (!feature.properties.id || ids.has(feature.properties.id)) throw new Error('Missing or duplicate official geography identifier.');
    ids.add(feature.properties.id);
    if (feature.properties.level === 'municipality' && (!feature.properties.regionId || !regions.has(feature.properties.regionId))) throw new Error('Invalid municipality-to-region relationship.');
    const polygons = polygonParts(feature.geometry);
    if (!polygons.length) throw new Error('Missing polygon geometry.');
    for (const polygon of polygons) {
      if (!polygon.length) throw new Error('Missing polygon rings.');
      for (const ring of polygon) {
        if (ring.length < 4 || ring[0][0] !== ring.at(-1)![0] || ring[0][1] !== ring.at(-1)![1]) throw new Error('Invalid closed polygon ring.');
        if (ring.some(([longitude, latitude]) => !Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < 13 || longitude > 17 || latitude < 45 || latitude > 47)) throw new Error('Geometry CRS or Slovenia bounds are invalid.');
      }
    }
  }
  if (municipalities.length !== reference.metadata.counts.municipalities || regions.size !== reference.metadata.counts.regions) throw new Error('Official reference count mismatch.');
  return reference;
}
export function equalWidthThresholds(maximum: number, bins = 5, scale: 'linear' | 'sqrt' = 'linear') {
  if (!Number.isFinite(maximum) || maximum <= 0) return [0];
  return Array.from({ length: bins + 1 }, (_, index) => maximum * (scale === 'sqrt' ? (index / bins) ** 2 : index / bins));
}


export function pointInGeometry(point: Position, geometry: PolygonGeometry): 'inside' | 'outside' | 'boundary' {
  function inRing(ring: Position[]): 'inside' | 'outside' | 'boundary' {
    let inside = false;
    const [longitude, latitude] = point;
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
      const [x1, y1] = ring[previous], [x2, y2] = ring[index];
      const cross = (longitude - x1) * (y2 - y1) - (latitude - y1) * (x2 - x1);
      if (Math.abs(cross) < 1e-11 && longitude >= Math.min(x1, x2) - 1e-11 && longitude <= Math.max(x1, x2) + 1e-11 && latitude >= Math.min(y1, y2) - 1e-11 && latitude <= Math.max(y1, y2) + 1e-11) return 'boundary';
      if ((y1 > latitude) !== (y2 > latitude) && longitude < (x2 - x1) * (latitude - y1) / (y2 - y1) + x1) inside = !inside;
    }
    return inside ? 'inside' : 'outside';
  }
  for (const polygon of polygonParts(geometry)) {
    const outer = inRing(polygon[0]);
    if (outer === 'boundary') return 'boundary';
    if (outer === 'outside') continue;
    let inHole = false;
    for (const hole of polygon.slice(1)) {
      const result = inRing(hole);
      if (result === 'boundary') return 'boundary';
      if (result === 'inside') { inHole = true; break; }
    }
    if (!inHole) return 'inside';
  }
  return 'outside';
}
