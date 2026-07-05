import { FontLoader, type Font } from "three/examples/jsm/loaders/FontLoader.js";
import fontJson from "./helvetiker_regular.typeface.json";
import { placeSolid, shiftAlong } from "./orient";

export const LABEL_SIZE_MM = 8;      // glyph height
export const LABEL_DEPTH_MM = 1;     // raised / engraved depth at the surface
const LABEL_CURVE_SEGMENTS = 6;      // glyph curve tessellation (low = few verts)
// Sink the label into the body so emboss fuses (and deboss cuts through) even when
// the placement face isn't perfectly flat at bbox-max. NOTE: labels assume an
// approximately flat top face — surface-conforming labels (raycast the true surface
// point + normal) are a future enhancement, not in Phase 1.
const LABEL_SINK_MM = 0.6;

let cachedFont: Font | null = null;

function getFont(): Font {
  if (!cachedFont) cachedFont = new FontLoader().parse(fontJson as any);
  return cachedFont;
}

/** A solid of `text`, extruded from z=0..depth, centered on the XY origin. */
export function buildSeamLabel(
  M: any,
  text: string,
  opts?: { size?: number; depth?: number },
): any {
  const size = opts?.size ?? LABEL_SIZE_MM;
  const depth = opts?.depth ?? LABEL_DEPTH_MM;
  const shapes = getFont().generateShapes(text, size);

  const contours: Array<Array<[number, number]>> = [];
  for (const shape of shapes) {
    const { shape: outer, holes } = shape.extractPoints(LABEL_CURVE_SEGMENTS);
    contours.push(outer.map((p) => [p.x, p.y] as [number, number]));
    for (const h of holes) {
      contours.push(h.map((p) => [p.x, p.y] as [number, number]));
    }
  }
  if (contours.length === 0) {
    throw new Error(`Label text "${text}" has no printable glyphs.`);
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

export function applySeamLabel(
  M: any,
  part: any,
  text: string,
  opts: { mode: "emboss" | "deboss"; size?: number; depth?: number },
  position: [number, number, number],
  axis: [number, number, number],
): any {
  const depth = opts.depth ?? LABEL_DEPTH_MM;
  // Build the label taller by the sink margin so it always overlaps the body:
  // emboss buries the base by `sink` (raised height stays `depth`); deboss lets the
  // cutter poke `sink` past the surface so the recess reaches it on uneven tops.
  const label = buildSeamLabel(M, text, { size: opts.size, depth: depth + LABEL_SINK_MM });
  const offset = opts.mode === "emboss" ? -LABEL_SINK_MM : -depth;
  const placed = placeSolid(label, shiftAlong(position, axis, offset), axis);
  label.delete();
  const out = opts.mode === "emboss" ? M.Manifold.union(part, placed) : part.subtract(placed);
  placed.delete();
  return out;
}
