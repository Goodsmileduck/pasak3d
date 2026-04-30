import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { PlateMode } from "./plateModes";

interface BuildPlateProps {
    mode: PlateMode;
    isDark: boolean;
    model: THREE.Group | null;
}

// SVG path data extracted from public/favicon.svg (the 3D Lab cube logo)
// We draw this programmatically to avoid async loading and keep it resolution-independent
const LOGO_PATHS = [
    // Path 1 — left face
    "M0 0 C5.43 0.34 10.3 2.5 15.3 4.48 C16.22 4.84 17.15 5.2 18.1 5.57 C20.11 6.36 22.12 7.15 24.13 7.94 C27.37 9.21 30.61 10.48 33.86 11.74 C37.31 13.09 40.76 14.44 44.21 15.79 C56.2 20.47 68.2 25.11 80.21 29.74 C85 31.58 89.78 33.43 94.57 35.28 C102.64 38.39 110.7 41.5 118.77 44.61 C124.02 46.64 129.27 48.66 134.52 50.69 C136.45 51.43 138.38 52.18 140.31 52.92 C142.93 53.93 145.56 54.94 148.18 55.96 C148.95 56.25 149.73 56.55 150.52 56.86 C155.77 58.89 155.77 58.89 158 60 C158.49 61.86 158.49 61.86 158.88 64.19 C159.8 68.59 161 71.53 164 75 C165.35 75.73 166.71 76.44 168.08 77.13 C171.75 79.38 171.75 79.38 172.75 81.86 C173.04 84.18 173.07 86.39 173.02 88.72 C173.04 90.04 173.04 90.04 173.06 91.38 C173.1 94.33 173.07 97.27 173.05 100.21 C173.06 102.32 173.08 104.43 173.1 106.54 C173.14 112.27 173.13 117.99 173.11 123.72 C173.09 128.51 173.11 133.29 173.12 138.07 C173.15 149.35 173.14 160.63 173.1 171.91 C173.06 183.55 173.08 195.18 173.14 206.82 C173.18 216.82 173.19 226.81 173.17 236.8 C173.16 242.77 173.16 248.73 173.2 254.7 C173.23 260.31 173.21 265.92 173.16 271.54 C173.15 273.6 173.16 275.66 173.18 277.72 C173.33 293.26 173.33 293.26 170.06 297.55 C166.61 299.95 163.11 301.19 159 302 C157.04 301.55 157.04 301.55 154.95 300.72 C153.75 300.25 153.75 300.25 152.53 299.78 C151.66 299.43 150.79 299.08 149.89 298.71 C148.97 298.35 148.04 297.99 147.09 297.61 C144 296.4 140.9 295.17 137.81 293.94 C135.62 293.07 133.42 292.21 131.23 291.35 C127.76 289.99 124.29 288.62 120.82 287.25 C108.93 282.57 97 277.97 85.08 273.38 C81.5 272 77.93 270.61 74.35 269.22 C63.64 265.06 52.93 260.95 42.13 257.03 C37.52 255.36 32.93 253.65 28.33 251.95 C26.17 251.16 24 250.38 21.83 249.62 C18.84 248.57 15.88 247.47 12.91 246.36 C11.59 245.92 11.59 245.92 10.24 245.47 C7.79 244.52 5.98 243.73 4 242 C3.03 239.43 2.63 237.16 2.4 234.42 C1.72 230.32 -0.91 227.63 -4 225 C-4.85 224.65 -5.7 224.3 -6.57 223.94 C-9 222 -9 222 -9.62 218.26 C-9.64 216.65 -9.63 215.04 -9.6 213.44 C-9.61 212.55 -9.61 211.67 -9.61 210.76 C-9.62 207.78 -9.59 204.81 -9.57 201.83 C-9.57 199.7 -9.57 197.57 -9.57 195.45 C-9.57 189.66 -9.54 183.87 -9.51 178.08 C-9.48 172.03 -9.47 165.99 -9.47 159.94 C-9.45 148.49 -9.41 137.03 -9.36 125.58 C-9.3 112.54 -9.28 99.51 -9.25 86.47 C-9.2 59.65 -9.11 32.82 -9 6 C-7.24 5.02 -5.48 4.05 -3.73 3.07 C-1.84 1.99 -1.84 1.99 0 0 Z",
    // Path 2 — right face
    "M0 0 C1.68 1.31 3.35 2.65 5 4 C5.99 4.33 6.98 4.66 8 5 C8.14 33.09 8.25 61.19 8.31 89.28 C8.34 102.33 8.38 115.37 8.45 128.41 C8.51 139.78 8.55 151.15 8.56 162.51 C8.57 168.53 8.59 174.55 8.63 180.57 C8.68 186.24 8.69 191.9 8.68 197.56 C8.68 199.65 8.69 201.73 8.72 203.81 C8.74 206.65 8.74 209.48 8.72 212.32 C8.74 213.15 8.76 213.98 8.77 214.83 C8.74 217.13 8.74 217.13 8 221 C3.41 225 3.41 225 0 225 C-2.78 230.36 -4.2 234.99 -5 241 C-26.07 249.18 -47.14 257.36 -68.22 265.49 C-69.4 265.95 -70.58 266.4 -71.79 266.87 C-77.74 269.17 -83.7 271.46 -89.65 273.75 C-101.57 278.34 -113.48 282.97 -125.36 287.65 C-128.76 288.99 -132.16 290.32 -135.56 291.66 C-137.71 292.5 -139.87 293.36 -142.02 294.21 C-144.97 295.39 -147.93 296.55 -150.89 297.71 C-152.2 298.24 -152.2 298.24 -153.53 298.78 C-154.33 299.09 -155.13 299.4 -155.95 299.72 C-156.64 299.99 -157.33 300.27 -158.04 300.55 C-160.41 301.1 -161.73 300.84 -164 300 C-165.69 298.69 -167.35 297.36 -169 296 C-170.32 295.31 -171.65 294.64 -173 294 C-173.19 266.05 -173.33 238.11 -173.41 210.16 C-173.46 197.19 -173.51 184.21 -173.6 171.24 C-173.68 159.93 -173.73 148.62 -173.75 137.31 C-173.76 131.32 -173.79 125.33 -173.85 119.35 C-173.9 113.71 -173.92 108.08 -173.9 102.44 C-173.91 100.37 -173.92 98.3 -173.95 96.23 C-173.99 93.41 -173.98 90.59 -173.96 87.76 C-173.99 86.94 -174.01 86.12 -174.03 85.27 C-173.98 82.92 -173.86 81.19 -173 79 C-171.09 77.31 -169.23 76.19 -166.95 75.05 C-163.79 73.35 -162.58 71.16 -161 68 C-160.76 66.51 -160.55 65.02 -160.35 63.52 C-159.52 59.69 -159.32 59.22 -155.91 56.86 C-154.57 56.33 -153.21 55.85 -151.84 55.39 C-151.09 55.11 -150.34 54.83 -149.56 54.54 C-147.03 53.6 -144.49 52.71 -141.94 51.81 C-140.11 51.14 -138.28 50.47 -136.46 49.79 C-132.47 48.3 -128.47 46.84 -124.46 45.38 C-114.18 41.62 -103.99 37.61 -93.79 33.65 C-87.76 31.31 -81.72 28.98 -75.68 26.66 C-74.48 26.19 -73.28 25.73 -72.03 25.25 C-56.37 19.21 -40.7 13.19 -25.03 7.17 C-23.99 6.77 -22.94 6.37 -21.86 5.95 C-19.92 5.21 -17.98 4.46 -16.04 3.71 C-15.18 3.38 -14.32 3.05 -13.44 2.71 C-12.65 2.41 -11.87 2.11 -11.07 1.8 C-9.37 1.14 -7.69 0.45 -6.01 -0.25 C-3.46 -1.2 -2.49 -1.09 0 0 Z",
    // Path 3 — top face
    "M0 0 C1.23 0.85 2.46 1.7 3.69 2.56 C8.37 5.59 12.55 6.12 18 5 C20.23 3.9 22.13 2.7 24.11 1.19 C26.62 -0.39 27.99 -0.78 31 -1 C34.3 -0.19 37.42 1.03 40.59 2.24 C41.54 2.6 42.5 2.95 43.48 3.32 C46.64 4.49 49.79 5.68 52.94 6.88 C55.15 7.7 57.37 8.53 59.59 9.36 C64.16 11.06 68.73 12.77 73.29 14.49 C82.31 17.87 91.34 21.2 100.38 24.53 C105.08 26.26 109.78 28 114.48 29.74 C122.53 32.72 130.59 35.69 138.65 38.67 C141.78 39.82 144.91 40.98 148.04 42.13 C150.02 42.87 152.01 43.6 153.99 44.33 C164.36 48.15 174.71 51.99 185 56 C185 57.65 185 59.3 185 61 C171.56 66.42 158.06 71.71 144.52 76.89 C138.87 79.06 133.21 81.23 127.56 83.41 C126.38 83.86 125.2 84.31 123.98 84.78 C109.1 90.49 94.23 96.24 79.35 101.98 C77.65 102.64 77.65 102.64 75.92 103.31 C74.24 103.96 74.24 103.96 72.52 104.62 C70.32 105.48 68.11 106.33 65.9 107.17 C60.15 109.39 54.41 111.63 48.68 113.91 C47.49 114.38 46.3 114.85 45.07 115.33 C42.79 116.23 40.51 117.14 38.23 118.06 C37.21 118.46 36.19 118.86 35.13 119.27 C34.24 119.63 33.34 119.99 32.41 120.36 C29.78 121.06 28.52 120.96 26 120 C24.77 119.18 23.56 118.32 22.38 117.44 C17.66 114.43 13.47 113.88 8 115 C5.73 116.09 3.8 117.3 1.79 118.81 C-0.24 120.16 -1.58 120.64 -4 121 C-6.3 120.42 -6.3 120.42 -8.86 119.41 C-10.32 118.85 -10.32 118.85 -11.82 118.27 C-12.88 117.85 -13.94 117.42 -15.03 116.99 C-16.15 116.55 -17.27 116.12 -18.42 115.67 C-21.48 114.48 -24.53 113.27 -27.59 112.07 C-30.8 110.8 -34.03 109.54 -37.25 108.29 C-41.23 106.73 -45.21 105.18 -49.19 103.62 C-60.98 99 -72.79 94.45 -84.61 89.92 C-89.91 87.88 -95.21 85.84 -100.51 83.8 C-101.54 83.41 -102.57 83.01 -103.63 82.61 C-114.15 78.56 -124.67 74.51 -135.18 70.45 C-137.13 69.7 -139.08 68.95 -141.02 68.19 C-143.69 67.17 -146.35 66.14 -149.01 65.11 C-149.79 64.81 -150.58 64.51 -151.39 64.19 C-156.77 62.11 -156.77 62.11 -159 61 C-159 59.35 -159 57.7 -159 56 C-131.75 45.82 -104.48 35.68 -77.16 25.67 C-75.16 24.93 -73.15 24.19 -71.14 23.46 C-69.66 22.91 -69.66 22.91 -68.14 22.36 C-56.57 18.11 -45 13.84 -33.44 9.56 C-32.45 9.2 -31.47 8.84 -30.46 8.46 C-27.68 7.43 -24.9 6.41 -22.12 5.38 C-21.31 5.08 -20.5 4.78 -19.67 4.47 C-18.9 4.19 -18.14 3.91 -17.35 3.62 C-16.63 3.35 -15.9 3.08 -15.15 2.8 C-13.68 2.25 -12.21 1.69 -10.75 1.12 C-3.85 -1.54 -3.85 -1.54 0 0 Z",
];
const LOGO_TRANSFORMS = [
    { tx: 80, ty: 140 },   // left face
    { tx: 433, ty: 141 },  // right face
    { tx: 243, ty: 71 },   // top face
];
// Small circle/dot paths (decorative vertices of the cube) — simplified to circles
const LOGO_DOTS = [
    { cx: 258.06, cy: 202.52, r: 8 },
    { cx: 258.06, cy: 452.52, r: 8 },
    { cx: 451, cy: 380, r: 8 },
    { cx: 71, cy: 380, r: 8 },
    { cx: 71, cy: 130, r: 8 },
    { cx: 261, cy: 60, r: 8 },
    { cx: 452.31, cy: 131.06, r: 8 },
];

const LOGO_SIZE = 512; // Original SVG viewBox

// Tile layout constants (all in px, tile is TILE_SIZE × TILE_SIZE)
const TILE_SIZE = 256;
const LOGO_H = 100;
const TITLE_GAP = 12;
const FONT_SIZE = 22;
const CONTENT_H = LOGO_H + TITLE_GAP + FONT_SIZE;
const CONTENT_TOP = Math.round((TILE_SIZE - CONTENT_H) / 2);

/** Render the logo paths as filled shapes */
function drawLogo(ctx: CanvasRenderingContext2D, size: number, alpha: number, color = "#000000"): void {
    ctx.save();
    const scale = size / LOGO_SIZE;
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;

    LOGO_PATHS.forEach((d, i) => {
        const { tx, ty } = LOGO_TRANSFORMS[i];
        ctx.save();
        ctx.translate(tx, ty);
        ctx.fill(new Path2D(d));
        ctx.restore();
    });

    LOGO_DOTS.forEach(({ cx, cy, r }) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.restore();
}

/** Draw logo + "Pasak" title into the center of the current tile canvas */
function drawTileContent(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    color: string,
): void {
    const logoX = Math.round((TILE_SIZE - LOGO_H) / 2);

    ctx.save();
    ctx.translate(logoX, CONTENT_TOP);
    drawLogo(ctx, LOGO_H, alpha, color);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = `bold ${FONT_SIZE}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Pasak", TILE_SIZE / 2, CONTENT_TOP + LOGO_H + TITLE_GAP);
    ctx.restore();
}

/** Draw tile content rotated 90 degrees CCW (canvas is square so tiles still mesh seamlessly) */
function drawRotatedTileContent(ctx: CanvasRenderingContext2D, alpha: number, color: string): void {
    ctx.save();
    ctx.translate(TILE_SIZE / 2, TILE_SIZE / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.translate(-TILE_SIZE / 2, -TILE_SIZE / 2);
    drawTileContent(ctx, alpha, color);
    ctx.restore();
}

/** Theme-aware logo color and alpha */
function themeLogoStyle(isDark: boolean): { color: string; alpha: number } {
    return isDark ? { color: "#ffffff", alpha: 0.12 } : { color: "#000000", alpha: 0.10 };
}

/** Create a repeating CanvasTexture from a tile canvas */
function createRepeatingTexture(canvas: HTMLCanvasElement, repeats: number): THREE.CanvasTexture {
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.repeat.set(repeats, repeats);
    return texture;
}

/** 4×4 repeating logo+title pattern on a transparent canvas for the grid plate. */
function createGridOverlayTexture(isDark: boolean): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const ctx = canvas.getContext("2d")!;
    const { color, alpha } = themeLogoStyle(isDark);
    drawRotatedTileContent(ctx, alpha, color);
    return createRepeatingTexture(canvas, 4);
}

/** Generate the tiled logo pattern texture (light gray / dark gray) */
function createTiledTexture(isDark: boolean, plateSize: number): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const ctx = canvas.getContext("2d")!;

    // Slightly cool-biased gray to read as neutral under the warm hemisphere light
    ctx.fillStyle = isDark ? "#202026" : "#ecedf5";
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);

    const { color, alpha } = themeLogoStyle(isDark);
    drawRotatedTileContent(ctx, alpha, color);

    const repeats = Math.max(1, Math.round(plateSize / 20));
    return createRepeatingTexture(canvas, repeats);
}

/** Generate the gold PEI plate texture with realistic surface grain */
function createGoldTexture(plateSize: number): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const ctx = canvas.getContext("2d")!;

    // Amber PEI base (slightly deeper than pure gold)
    ctx.fillStyle = "#C8960C";
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Heavy multi-pass grain — simulates PEI textured surface
    const imageData = ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        // Coarse grain (dominant PEI surface texture)
        const coarse = (Math.random() - 0.5) * 50;
        // Fine grain overlay
        const fine = (Math.random() - 0.5) * 18;
        // Per-channel warm amber bias
        const rBias = (Math.random() - 0.4) * 12;
        const gBias = (Math.random() - 0.5) * 8;
        const bBias = (Math.random() - 0.65) * 7;
        data[i]   = Math.max(0, Math.min(255, data[i]   + coarse + fine + rBias));
        data[i+1] = Math.max(0, Math.min(255, data[i+1] + coarse + fine + gBias));
        data[i+2] = Math.max(0, Math.min(255, data[i+2] + coarse * 0.6 + fine + bBias));
    }
    ctx.putImageData(imageData, 0, 0);

    // Micro-scratches in random directions (PEI sheet handling marks)
    for (let i = 0; i < 140; i++) {
        const x = Math.random() * TILE_SIZE;
        const y = Math.random() * TILE_SIZE;
        const angle = Math.random() * Math.PI;
        const length = 3 + Math.random() * 20;
        ctx.globalAlpha = 0.04 + Math.random() * 0.08;
        ctx.strokeStyle = Math.random() > 0.35 ? "#ffffff" : "#000000";
        ctx.lineWidth = 0.2 + Math.random() * 0.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
        ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // Logo + title — rotated 90° CCW, dark on amber
    drawRotatedTileContent(ctx, 0.20, "#000000");

    const repeats = Math.max(1, Math.round(plateSize / 20));
    return createRepeatingTexture(canvas, repeats);
}

/** Compute plate size from model bounding box (XY plane in Z-up scene) */
function computePlateSize(model: THREE.Group | null): number {
    if (!model) return 100;
    const box = new THREE.Box3().setFromObject(model);
    const sizeX = box.max.x - box.min.x;
    const sizeY = box.max.y - box.min.y;
    const maxDim = Math.max(sizeX, sizeY);
    return Math.max(20, Math.min(500, maxDim * 2.5));
}

export function BuildPlate({ mode, isDark, model }: BuildPlateProps) {
    const plateSize = useMemo(() => computePlateSize(model), [model]);

    const texture = useMemo(() => {
        if (mode === "grid") return null;
        if (mode === "textured") return createGoldTexture(plateSize);
        return createTiledTexture(isDark, plateSize);
    }, [mode, isDark, plateSize]);

    const gridOverlay = useMemo(() => {
        if (mode !== "grid") return null;
        return createGridOverlayTexture(isDark);
    }, [mode, isDark]);

    // Dispose GPU textures when they are replaced
    useEffect(() => () => { texture?.dispose(); }, [texture]);
    useEffect(() => () => { gridOverlay?.dispose(); }, [gridOverlay]);

    if (mode === "grid") {
        const divisions = Math.max(10, Math.round(plateSize / 5));
        const mainColor = isDark ? 0x555555 : 0x888888;
        const subColor = isDark ? 0x333333 : 0xbbbbbb;
        return (
            <>
                {/* gridHelper draws on XZ — rotate to XY for Z-up */}
                <gridHelper key="grid-helper" args={[plateSize, divisions, mainColor, subColor]} rotation={[Math.PI / 2, 0, 0]} />
                <mesh key="grid-overlay" position={[0, 0, -0.005]} renderOrder={1}>
                    <planeGeometry args={[plateSize, plateSize]} />
                    <meshBasicMaterial map={gridOverlay} transparent depthWrite={false} />
                </mesh>
            </>
        );
    }

    // PEI is a matte plastic — no metalness, moderate roughness
    const roughness = mode === "textured" ? 0.72 : 0.95;

    const ghostColor = isDark ? "#1a1a1a" : "#f0f0f0";

    return (
        <>
            {/* Primary plate — XY plane at Z=0, visible from above (Z-up) */}
            <mesh key="plate-primary" position={[0, 0, -0.01]} receiveShadow>
                <planeGeometry args={[plateSize, plateSize]} />
                <meshStandardMaterial map={texture} roughness={roughness} metalness={0} />
            </mesh>
            {/* Ghost plane — back-face only, very faint so model stays visible from below */}
            <mesh key="plate-ghost" position={[0, 0, -0.01]}>
                <planeGeometry args={[plateSize, plateSize]} />
                <meshBasicMaterial color={ghostColor} transparent opacity={0.12} side={THREE.BackSide} />
            </mesh>
        </>
    );
}
