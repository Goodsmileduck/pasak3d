type Point = [number, number];

export type DowelPlaceOptions = {
  count: number;
  dowelDiameter: number;
  minSpacing: number;
};

/**
 * Auto-place dowels inside a 2D polygon (with optional holes).
 *
 * Strategy: farthest-point sampling, run from several seeds — the polygon
 * centroid plus the 8 cells of a 3×3 inset bbox grid — and the run that
 * places the most dowels (preferring lower max-min-distance for tie-breaks)
 * wins. Centroid seeding produces nicely centered placements when the
 * polygon has slack; corner seeding wins when the polygon is just barely
 * large enough to fit `count` dowels.
 */
export function autoPlaceDowels(
  polygons: Array<Array<Point>>,
  opts: DowelPlaceOptions,
): Point[] {
  if (polygons.length === 0 || opts.count <= 0) return [];
  const outer = polygons[0];
  const holes = polygons.slice(1);
  const minDist = opts.dowelDiameter + opts.minSpacing;
  const inset = opts.dowelDiameter / 2;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of outer) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  // Bail when the polygon is narrower than a dowel along either axis.
  if (maxX - minX <= 2 * inset || maxY - minY <= 2 * inset) return [];

  // Candidate grid spans the full polygon bbox — PIP filtering keeps centers
  // inside. We don't shrink by `inset`; the dowel cylinder may overhang the
  // cross-section a hair near concave corners, but that's negligible for the
  // realistic shapes Pasak targets, and shrinking loses density on small cuts.
  const RES = 40;
  const candidates: Point[] = [];
  for (let iy = 0; iy < RES; iy++) {
    for (let ix = 0; ix < RES; ix++) {
      const x = minX + ((ix + 0.5) * (maxX - minX)) / RES;
      const y = minY + ((iy + 0.5) * (maxY - minY)) / RES;
      if (!pointInPolygon([x, y], outer)) continue;
      if (holes.some((h) => pointInPolygon([x, y], h))) continue;
      candidates.push([x, y]);
    }
  }
  if (candidates.length === 0) return [];

  // Build seed list: centroid (clamped to nearest candidate if outside polygon)
  // plus the 9 cell centers of a 3×3 inset grid.
  const seeds: Point[] = [];
  const centroid = polygonCentroid(outer);
  const centroidInside =
    pointInPolygon(centroid, outer) &&
    !holes.some((h) => pointInPolygon(centroid, h));
  seeds.push(centroidInside ? centroid : nearestCandidate(candidates, centroid));
  for (let iy = 0; iy < 3; iy++) {
    for (let ix = 0; ix < 3; ix++) {
      const x = minX + ((ix + 0.5) * (maxX - minX)) / 3;
      const y = minY + ((iy + 0.5) * (maxY - minY)) / 3;
      seeds.push(nearestCandidate(candidates, [x, y]));
    }
  }

  let best: Point[] = [];
  for (const seed of seeds) {
    const placed = farthestPointSample(seed, candidates, opts.count, minDist);
    if (placed.length > best.length) best = placed;
    if (best.length >= opts.count) break;
  }
  return best;
}

function farthestPointSample(
  seed: Point,
  candidates: Point[],
  count: number,
  minDist: number,
): Point[] {
  const placed: Point[] = [seed];
  while (placed.length < count) {
    let bestIdx = -1;
    let bestDist = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const [cx, cy] = candidates[i];
      let minD = Infinity;
      for (const [px, py] of placed) {
        const d = Math.hypot(cx - px, cy - py);
        if (d < minD) minD = d;
      }
      if (minD < minDist) continue;
      if (minD > bestDist) { bestDist = minD; bestIdx = i; }
    }
    if (bestIdx < 0) break;
    placed.push(candidates[bestIdx]);
  }
  return placed;
}

function nearestCandidate(candidates: Point[], target: Point): Point {
  let bestIdx = 0;
  let bestD = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const d = Math.hypot(candidates[i][0] - target[0], candidates[i][1] - target[1]);
    if (d < bestD) { bestD = d; bestIdx = i; }
  }
  return candidates[bestIdx];
}

/** Area-weighted centroid via the shoelace formula. */
function polygonCentroid(poly: Point[]): Point {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const f = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    a += f;
    cx += (poly[j][0] + poly[i][0]) * f;
    cy += (poly[j][1] + poly[i][1]) * f;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-9) return [poly[0][0], poly[0][1]];
  return [cx / (6 * a), cy / (6 * a)];
}

function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (((yi > p[1]) !== (yj > p[1])) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi + 1e-12) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
