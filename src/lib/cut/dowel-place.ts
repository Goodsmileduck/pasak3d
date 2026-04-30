type Point = [number, number];

export type DowelPlaceOptions = {
  count: number;
  dowelDiameter: number;
  minSpacing: number;
};

/**
 * Auto-place dowels inside a 2D polygon (with optional holes).
 * Strategy: bbox-bounded grid, filtered by point-in-polygon and pairwise spacing.
 * Returns up to `count` positions, fewer if the polygon can't fit them all.
 */
export function autoPlaceDowels(
  polygons: Array<Array<Point>>,
  opts: DowelPlaceOptions,
): Point[] {
  if (polygons.length === 0) return [];
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
  minX += inset; maxX -= inset; minY += inset; maxY -= inset;
  if (maxX <= minX || maxY <= minY) return [];

  // Sample the full bbox (bounded by polygon via PIP check).
  // We don't shrink the bbox by inset here — the PIP check ensures centers are inside.
  const bboxMinX = minX - inset;
  const bboxMaxX = maxX + inset;
  const bboxMinY = minY - inset;
  const bboxMaxY = maxY + inset;

  const placed: Point[] = [];
  const tryGrid = (cellsX: number, cellsY: number) => {
    for (let iy = 0; iy < cellsY && placed.length < opts.count; iy++) {
      for (let ix = 0; ix < cellsX && placed.length < opts.count; ix++) {
        const x = bboxMinX + ((ix + 0.5) * (bboxMaxX - bboxMinX)) / cellsX;
        const y = bboxMinY + ((iy + 0.5) * (bboxMaxY - bboxMinY)) / cellsY;
        if (!pointInPolygon([x, y], outer)) continue;
        if (holes.some((h) => pointInPolygon([x, y], h))) continue;
        if (placed.some((p) => Math.hypot(p[0] - x, p[1] - y) < minDist)) continue;
        placed.push([x, y]);
      }
    }
  };
  for (let n = 2; n <= 16 && placed.length < opts.count; n++) {
    placed.length = 0;
    tryGrid(n, n);
  }
  return placed.slice(0, opts.count);
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
