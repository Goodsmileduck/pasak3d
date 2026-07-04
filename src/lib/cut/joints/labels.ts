import { FontLoader, type Font } from "three/examples/jsm/loaders/FontLoader.js";
import fontJson from "./helvetiker_regular.typeface.json";
import { placeSolid } from "./orient";

let cachedFont: Font | null = null;

function getFont(): Font {
  if (!cachedFont) cachedFont = new FontLoader().parse(fontJson as any);
  return cachedFont;
}

/** A raised solid of `text`, extruded from z=0..depth, centered on the XY origin. */
export function buildSeamLabel(
  M: any,
  text: string,
  opts?: { size?: number; depth?: number },
): any {
  const size = opts?.size ?? 6;
  const depth = opts?.depth ?? 1;
  const shapes = getFont().generateShapes(text, size);

  const contours: Array<Array<[number, number]>> = [];
  for (const shape of shapes) {
    const { shape: outer, holes } = shape.extractPoints(6);
    contours.push(outer.map((p) => [p.x, p.y] as [number, number]));
    for (const h of holes) {
      contours.push(h.map((p) => [p.x, p.y] as [number, number]));
    }
  }

  const cs = M.CrossSection.ofPolygons(contours, "EvenOdd");
  const b = cs.bounds();
  const cx = (b.min[0] + b.max[0]) / 2;
  const cy = (b.min[1] + b.max[1]) / 2;
  const centered = cs.translate([-cx, -cy]);
  cs.delete();
  const out = centered.extrude(depth, 1, 0, undefined, false);
  centered.delete();
  return out;
}

function shiftAlong(
  p: [number, number, number],
  a: [number, number, number],
  d: number,
): [number, number, number] {
  return [p[0] + a[0] * d, p[1] + a[1] * d, p[2] + a[2] * d];
}

export function applySeamLabel(
  M: any,
  part: any,
  text: string,
  opts: { mode: "emboss" | "deboss"; size?: number; depth?: number },
  position: [number, number, number],
  axis: [number, number, number],
): any {
  const depth = opts.depth ?? 1;
  const label = buildSeamLabel(M, text, { size: opts.size, depth });
  const pos = opts.mode === "deboss" ? shiftAlong(position, axis, -depth) : position;
  const placed = placeSolid(label, pos, axis);
  label.delete();
  const out = opts.mode === "emboss" ? M.Manifold.union(part, placed) : part.subtract(placed);
  placed.delete();
  return out;
}
