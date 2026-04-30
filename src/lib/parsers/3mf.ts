import type { WorkerMeshData, ParserProgressFn } from "../../types";
import { unzipSync } from "fflate";

/* ------------------------------------------------------------------ */
/*  Internal types                                                     */
/* ------------------------------------------------------------------ */

interface MeshData {
  vertices: Float32Array;
  indices: Uint32Array;
}

interface ComponentRef {
  objectId: string;
  /** Row-major 3x4 affine matrix [m00,m01,m02,m03, m10,m11,m12,m13, m20,m21,m22,m23] */
  transform?: number[];
}

interface ObjectEntry {
  id: string;
  mesh?: MeshData;
  components?: ComponentRef[];
}

/* ------------------------------------------------------------------ */
/*  Transform helpers (no Three.js)                                    */
/* ------------------------------------------------------------------ */

/**
 * Parse a 3MF transform string into a row-major 3x4 matrix.
 *
 * 3MF spec: "m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32"
 * where [m30,m31,m32] is the translation. The values are column-major
 * in the spec (i.e. first 3 are column 0), so we convert to row-major
 * for easier vertex multiplication.
 *
 * Row-major layout: [r00,r01,r02,tx, r10,r11,r12,ty, r20,r21,r22,tz]
 */
function parseTransformStr(s: string): number[] {
  const t = s.split(" ").map(parseFloat);
  // 3MF column-major: t[0..2]=col0, t[3..5]=col1, t[6..8]=col2, t[9..11]=translation
  return [
    t[0], t[3], t[6], t[9],
    t[1], t[4], t[7], t[10],
    t[2], t[5], t[8], t[11],
  ];
}

/**
 * Apply a 3x4 affine transform to a vertex array in-place.
 */
function applyTransform(vertices: Float32Array, m: number[]): void {
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const y = vertices[i + 1];
    const z = vertices[i + 2];
    vertices[i]     = m[0] * x + m[1] * y + m[2]  * z + m[3];
    vertices[i + 1] = m[4] * x + m[5] * y + m[6]  * z + m[7];
    vertices[i + 2] = m[8] * x + m[9] * y + m[10] * z + m[11];
  }
}

/**
 * Multiply two 3x4 affine matrices (row-major), returning a new 3x4 matrix.
 * Treats both as 4x4 with implicit bottom row [0,0,0,1].
 */
function multiplyTransforms(a: number[], b: number[]): number[] {
  return [
    a[0]*b[0] + a[1]*b[4] + a[2]*b[8],
    a[0]*b[1] + a[1]*b[5] + a[2]*b[9],
    a[0]*b[2] + a[1]*b[6] + a[2]*b[10],
    a[0]*b[3] + a[1]*b[7] + a[2]*b[11] + a[3],

    a[4]*b[0] + a[5]*b[4] + a[6]*b[8],
    a[4]*b[1] + a[5]*b[5] + a[6]*b[9],
    a[4]*b[2] + a[5]*b[6] + a[6]*b[10],
    a[4]*b[3] + a[5]*b[7] + a[6]*b[11] + a[7],

    a[8]*b[0] + a[9]*b[4] + a[10]*b[8],
    a[8]*b[1] + a[9]*b[5] + a[10]*b[9],
    a[8]*b[2] + a[9]*b[6] + a[10]*b[10],
    a[8]*b[3] + a[9]*b[7] + a[10]*b[11] + a[11],
  ];
}

/* ------------------------------------------------------------------ */
/*  Regex-based XML helpers (no DOMParser — works in Web Workers)      */
/* ------------------------------------------------------------------ */

/** Extract an attribute value from a tag string like `<tag attr="val">`. */
function getAttr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`);
  const m = tag.match(re);
  return m ? m[1] : null;
}

/** Match all self-closing or opening tags, returning the full tag string. */
function matchTags(xml: string, tagName: string): string[] {
  const re = new RegExp(`<${tagName}\\b[^>]*?/?>`, "g");
  return Array.from(xml.matchAll(re), m => m[0]);
}

interface TagBlock { attrs: string; body: string }

/** Match block elements `<tag ...>body</tag>`, returning attrs string and body. */
function matchBlocks(xml: string, tagName: string): TagBlock[] {
  const re = new RegExp(`(<${tagName}\\b[^>]*>)([\\s\\S]*?)</${tagName}>`, "g");
  return Array.from(xml.matchAll(re), m => ({ attrs: m[1], body: m[2] }));
}

/* ------------------------------------------------------------------ */
/*  XML parsing helpers                                                */
/* ------------------------------------------------------------------ */

function parseMesh(meshBody: string): MeshData {
  const vertices: number[] = [];
  for (const tag of matchTags(meshBody, "vertex")) {
    vertices.push(
      parseFloat(getAttr(tag, "x") || "0"),
      parseFloat(getAttr(tag, "y") || "0"),
      parseFloat(getAttr(tag, "z") || "0"),
    );
  }

  const indices: number[] = [];
  for (const tag of matchTags(meshBody, "triangle")) {
    indices.push(
      parseInt(getAttr(tag, "v1") || "0", 10),
      parseInt(getAttr(tag, "v2") || "0", 10),
      parseInt(getAttr(tag, "v3") || "0", 10),
    );
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
  };
}

function parseComponents(componentsBody: string): ComponentRef[] {
  const components: ComponentRef[] = [];
  for (const tag of matchTags(componentsBody, "component")) {
    const objectId = getAttr(tag, "objectid");
    if (!objectId) continue;
    const ref: ComponentRef = { objectId };
    const t = getAttr(tag, "transform");
    if (t) ref.transform = parseTransformStr(t);
    components.push(ref);
  }
  return components;
}

/* ------------------------------------------------------------------ */
/*  First-pass counting                                                */
/* ------------------------------------------------------------------ */

interface CountResult {
  totalVertices: number;
  totalTriangles: number;
}

function countGeometry(
  zip: Record<string, Uint8Array>,
  decoder: TextDecoder,
): CountResult {
  let totalVertices = 0;
  let totalTriangles = 0;

  for (const name in zip) {
    if (!name.match(/\.model$/i)) continue;
    const text = decoder.decode(zip[name]);
    for (const model of matchBlocks(text, "model")) {
      for (const mesh of matchBlocks(model.body, "mesh")) {
        totalVertices += matchTags(mesh.body, "vertex").length;
        totalTriangles += matchTags(mesh.body, "triangle").length;
      }
    }
  }

  return { totalVertices, totalTriangles };
}

/* ------------------------------------------------------------------ */
/*  Main parser                                                        */
/* ------------------------------------------------------------------ */

export function parse3MF(
  buffer: ArrayBuffer,
  onProgress?: ParserProgressFn,
): WorkerMeshData[] {
  const zip = unzipSync(new Uint8Array(buffer)) as Record<string, Uint8Array>;
  const decoder = new TextDecoder();

  // First pass: count total geometry for progress reporting
  const totals = countGeometry(zip, decoder);
  const totalElements = totals.totalVertices + totals.totalTriangles;
  let parsedElements = 0;

  // Collect all objects across every .model file
  const globalObjects = new Map<string, ObjectEntry>();
  let rootModelPath: string | undefined;
  const buildItems: { objectId: string; transform?: number[] }[] = [];

  // Find the root model from _rels/.rels
  for (const name in zip) {
    if (name.match(/_rels\/.rels$/)) {
      const text = decoder.decode(zip[name]);
      for (const tag of matchTags(text, "Relationship")) {
        const type = getAttr(tag, "Type") || "";
        if (type.includes("3dmodel")) {
          rootModelPath = (getAttr(tag, "Target") || "").replace(/^\//, "");
        }
      }
    }
  }

  // Second pass: parse all .model files
  for (const name in zip) {
    if (!name.match(/\.model$/i)) continue;
    const text = decoder.decode(zip[name]);
    const modelBlocks = matchBlocks(text, "model");
    if (modelBlocks.length === 0) continue;
    const modelBody = modelBlocks[0].body;

    // Parse objects
    for (const obj of matchBlocks(modelBody, "object")) {
      const id = getAttr(obj.attrs, "id");
      if (!id) continue;

      const entry: ObjectEntry = { id };

      const meshBlocks = matchBlocks(obj.body, "mesh");
      if (meshBlocks.length > 0) {
        entry.mesh = parseMesh(meshBlocks[0].body);
        parsedElements += entry.mesh.vertices.length / 3 + entry.mesh.indices.length / 3;
        if (onProgress && totalElements > 0) {
          onProgress(parsedElements, totalElements);
        }
      }

      const compBlocks = matchBlocks(obj.body, "components");
      if (compBlocks.length > 0) {
        entry.components = parseComponents(compBlocks[0].body);
      }

      globalObjects.set(id, entry);
    }

    // Parse build items from root model
    const isRoot = !rootModelPath || name === rootModelPath || name.endsWith(rootModelPath);
    if (isRoot) {
      const buildBlocks = matchBlocks(modelBody, "build");
      if (buildBlocks.length > 0) {
        for (const tag of matchTags(buildBlocks[0].body, "item")) {
          const objectId = getAttr(tag, "objectid");
          if (!objectId) continue;
          const bi: { objectId: string; transform?: number[] } = { objectId };
          const t = getAttr(tag, "transform");
          if (t) bi.transform = parseTransformStr(t);
          buildItems.push(bi);
        }
      }
    }
  }

  // Resolve objects into flat WorkerMeshData[] list
  const result: WorkerMeshData[] = [];

  /**
   * Recursively resolve an object, collecting all mesh data with accumulated
   * transforms into the result array.
   */
  function resolveObject(
    id: string,
    parentTransform?: number[],
  ): void {
    const entry = globalObjects.get(id);
    if (!entry) return;

    if (entry.mesh) {
      // Clone vertices so we don't mutate the cached data
      const vertices = new Float32Array(entry.mesh.vertices);
      const indices = new Uint32Array(entry.mesh.indices);

      if (parentTransform) {
        applyTransform(vertices, parentTransform);
      }

      result.push({
        vertices,
        normals: new Float32Array(0),
        indices,
      });
      return;
    }

    if (entry.components) {
      for (const comp of entry.components) {
        const combinedTransform =
          parentTransform && comp.transform
            ? multiplyTransforms(parentTransform, comp.transform)
            : parentTransform ?? comp.transform;

        resolveObject(comp.objectId, combinedTransform);
      }
    }
  }

  if (buildItems.length > 0) {
    for (const bi of buildItems) {
      resolveObject(bi.objectId, bi.transform);
    }
  } else {
    // No build section -- add all mesh objects
    for (const [id, entry] of globalObjects) {
      if (entry.mesh) {
        resolveObject(id);
      }
    }
  }

  // Final progress report
  if (onProgress && totalElements > 0) {
    onProgress(totalElements, totalElements);
  }

  return result;
}
