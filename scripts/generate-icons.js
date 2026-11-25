import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const publicDir = path.resolve('public');

// Minimal zero-dependency PNG encoder (RGBA8)
function encodePNG(width, height, rgba) {
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c >>> 0;
  }
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([typeBuf, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([lenBuf, body, crcBuf]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Distance from point (px, py) to segment (ax, ay)-(bx, by)
function distSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(px - ax, py - ay);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - bx, py - by);
  const t = c1 / c2;
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

// Distance to circular arc centered at (cx, cy) with radius r between startAngle and endAngle
function distArc(px, py, cx, cy, r, startAng, endAng) {
  let ang = Math.atan2(py - cy, px - cx);
  while (ang < startAng) ang += Math.PI * 2;
  while (ang >= startAng + Math.PI * 2) ang -= Math.PI * 2;
  const span = endAng - startAng;
  if (ang <= startAng + span) {
    return Math.abs(Math.hypot(px - cx, py - cy) - r);
  }
  const ax = cx + r * Math.cos(startAng);
  const ay = cy + r * Math.sin(startAng);
  const bx = cx + r * Math.cos(endAng);
  const by = cy + r * Math.sin(endAng);
  return Math.min(Math.hypot(px - ax, py - ay), Math.hypot(px - bx, py - by));
}

// Signed distance to the Lucide BookOpen icon in its 24x24 viewBox:
function distBookOpen(x, y) {
  let d = Infinity;
  // Left page segments & arcs
  d = Math.min(d, distSegment(x, y, 2, 3, 8, 3));
  d = Math.min(d, distArc(x, y, 8, 7, 4, -Math.PI / 2, 0));
  d = Math.min(d, distSegment(x, y, 12, 7, 12, 21));
  d = Math.min(d, distArc(x, y, 9, 21, 3, -Math.PI / 2, 0));
  d = Math.min(d, distSegment(x, y, 9, 18, 2, 18));
  d = Math.min(d, distSegment(x, y, 2, 18, 2, 3));

  // Right page segments & arcs
  d = Math.min(d, distSegment(x, y, 22, 3, 16, 3));
  d = Math.min(d, distArc(x, y, 16, 7, 4, Math.PI, 1.5 * Math.PI));
  d = Math.min(d, distArc(x, y, 15, 21, 3, Math.PI, 1.5 * Math.PI));
  d = Math.min(d, distSegment(x, y, 15, 18, 22, 18));
  d = Math.min(d, distSegment(x, y, 22, 18, 22, 3));
  return d;
}

/**
 * Smoked-obsidian + emerald aurora radial gradient matching in-app ChallanTrackMark.
 * mx, my are normalized medallion coordinates centered at (0.5, 0.5) inside diameter 1.0.
 */
function sampleMedallionSurface(mx, my, sizeForGrain, px, py) {
  // Base deep smoked slate (#0D1824 -> #070C14)
  const radCenter = clamp(Math.hypot(mx - 0.5, my - 0.5) * 2.0, 0, 1);
  let r = lerp(15, 7, radCenter);
  let g = lerp(31, 13, radCenter);
  let b = lerp(34, 21, radCenter);

  // Top-left luminous emerald aurora orb (#10B981 -> #059669)
  const dOrb1 = Math.hypot((mx - 0.28) * 1.1, (my - 0.24) * 1.1);
  const glow1 = Math.exp(-dOrb1 * dOrb1 * 4.2);
  r = lerp(r, 16, glow1 * 0.88);
  g = lerp(g, 185, glow1 * 0.88);
  b = lerp(b, 129, glow1 * 0.88);

  // Secondary lower-right subtle teal depth (#047857)
  const dOrb2 = Math.hypot(mx - 0.72, my - 0.76);
  const glow2 = Math.exp(-dOrb2 * dOrb2 * 3.4);
  r = lerp(r, 4, glow2 * 0.45);
  g = lerp(g, 120, glow2 * 0.45);
  b = lerp(b, 87, glow2 * 0.45);

  // Fine tactile micro-grain
  const scaleFactor = sizeForGrain > 256 ? 1 : 0.7;
  const grain = (((px * 37 + py * 73) % 19) / 19 - 0.5) * 2.5 * scaleFactor;
  r = clamp(r + grain, 0, 255);
  g = clamp(g + grain, 0, 255);
  b = clamp(b + grain, 0, 255);

  return [r, g, b];
}

function renderMedallionIcon(
  size,
  {
    mode, // 'circle-transparent' | 'maskable-circle-on-bg' | 'full-bleed-apple'
    medallionRadiusRatio = 0.475,
    iconScale = 0.44,
    iconOffsetY = 0.005,
  }
) {
  const rgba = Buffer.alloc(size * size * 4);
  const halfStroke = 0.96; // Clean architectural stroke weight matching ChallanTrackMark
  const outerBg = [7, 11, 19]; // #070B13 exact match to manifest background_color

  const circleR = size * medallionRadiusRatio;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const nx = (px + 0.5) / size;
      const ny = (py + 0.5) / size;
      const dx = (nx - 0.5) * size;
      const dy = (ny - 0.5) * size;
      const distCenter = Math.hypot(dx, dy);

      // Map pixel into local medallion [0..1] space
      const mx = 0.5 + dx / (circleR * 2);
      const my = 0.5 + dy / (circleR * 2);

      let outR = outerBg[0];
      let outG = outerBg[1];
      let outB = outerBg[2];
      let outA = 1;

      if (mode === 'circle-transparent') {
        const maskAlpha = 1 - smoothstep(circleR - 1.25, circleR + 0.45, distCenter);
        if (maskAlpha <= 0.001) {
          continue;
        }
        const [mr, mg, mb] = sampleMedallionSurface(mx, my, size, px, py);
        outR = mr;
        outG = mg;
        outB = mb;
        outA = maskAlpha;

        // Crisp specular rim on circular medallion
        const rimDist = Math.abs(distCenter - (circleR - size * 0.006));
        const rimW = Math.max(1.2, size * 0.0055);
        const rimFactor = (1 - smoothstep(rimW * 0.45, rimW + 1.1, rimDist));
        const topLeftHighlight = lerp(0.55, 0.14, clamp((mx + my) * 0.5, 0, 1));
        if (rimFactor > 0) {
          outR = lerp(outR, 167, rimFactor * topLeftHighlight);
          outG = lerp(outG, 243, rimFactor * topLeftHighlight);
          outB = lerp(outB, 208, rimFactor * topLeftHighlight);
        }
      } else if (mode === 'maskable-circle-on-bg') {
        // Outer canvas (#070B13) blends invisibly into PWA splash screen so ONLY a circle shows!
        // Subtle emerald halo just outside the circle
        const haloDist = Math.max(0, distCenter - circleR);
        const haloGlow = Math.exp(-Math.pow(haloDist / (size * 0.09), 2)) * 0.22;
        outR = lerp(outerBg[0], 16, haloGlow);
        outG = lerp(outerBg[1], 185, haloGlow);
        outB = lerp(outerBg[2], 129, haloGlow);
        outA = 1;

        const circleAlpha = 1 - smoothstep(circleR - 1.15, circleR + 0.5, distCenter);
        if (circleAlpha > 0.001) {
          let [mr, mg, mb] = sampleMedallionSurface(mx, my, size, px, py);
          // Specular emerald rim
          const rimDist = Math.abs(distCenter - (circleR - size * 0.005));
          const rimW = Math.max(1.1, size * 0.005);
          const rimFactor = 1 - smoothstep(rimW * 0.45, rimW + 1.0, rimDist);
          const topLeftHighlight = lerp(0.62, 0.16, clamp((mx + my) * 0.5, 0, 1));
          if (rimFactor > 0) {
            mr = lerp(mr, 167, rimFactor * topLeftHighlight);
            mg = lerp(mg, 243, rimFactor * topLeftHighlight);
            mb = lerp(mb, 208, rimFactor * topLeftHighlight);
          }
          outR = lerp(outR, mr, circleAlpha);
          outG = lerp(outG, mg, circleAlpha);
          outB = lerp(outB, mb, circleAlpha);
        }
      } else {
        // Full-bleed Apple Touch Icon (iOS automatically rounds into squircle)
        const [mr, mg, mb] = sampleMedallionSurface(nx, ny, size, px, py);
        outR = mr;
        outG = mg;
        outB = mb;
        outA = 1;
      }

      // Draw BookOpen mark inside the medallion
      const iconPxSize = size * iconScale;
      const vx = ((px + 0.5) - (size - iconPxSize) * 0.5) / iconPxSize * 24;
      const vy = ((py + 0.5) - (size - iconPxSize) * 0.5 - size * iconOffsetY) / iconPxSize * 24;

      if (vx >= -3 && vx <= 27 && vy >= -3 && vy <= 27) {
        const aa = (24 / iconPxSize) * 0.85;
        const dShadow = distBookOpen(vx, vy - 0.35);
        const shadowAlpha = (1 - smoothstep(halfStroke - aa, halfStroke + aa + 0.3, dShadow)) * 0.42;
        if (shadowAlpha > 0) {
          outR = lerp(outR, 2, shadowAlpha);
          outG = lerp(outG, 18, shadowAlpha);
          outB = lerp(outB, 14, shadowAlpha);
        }

        const d = distBookOpen(vx, vy);
        const iconAlpha = 1 - smoothstep(halfStroke - aa, halfStroke + aa, d);
        if (iconAlpha > 0) {
          outR = lerp(outR, 255, iconAlpha);
          outG = lerp(outG, 255, iconAlpha);
          outB = lerp(outB, 255, iconAlpha);
        }
      }

      const idx = (py * size + px) * 4;
      rgba[idx] = Math.round(clamp(outR, 0, 255));
      rgba[idx + 1] = Math.round(clamp(outG, 0, 255));
      rgba[idx + 2] = Math.round(clamp(outB, 0, 255));
      rgba[idx + 3] = Math.round(clamp(outA * 255, 0, 255));
    }
  }

  return encodePNG(size, size, rgba);
}

function renderSplashScreen(width, height) {
  const rgba = Buffer.alloc(width * height * 4);
  const cx = width * 0.5;
  const cy = height * 0.5;
  const medallionSize = Math.round(Math.min(width, height) * 0.28); // ~210px on 750x1334
  const circleR = medallionSize * 0.5;
  const iconPxSize = medallionSize * 0.46;
  const halfStroke = 0.96;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const nx = (px + 0.5) / width;
      const ny = (py + 0.5) / height;

      // Deep dark slate canvas #070B13 with two soft atmospheric emerald aurora blooms
      let r = 7;
      let g = 11;
      let b = 19;

      const dBloom1 = Math.hypot((nx - 0.26) * 0.9, (ny - 0.28) * 1.4);
      const b1 = Math.exp(-dBloom1 * dBloom1 * 5.2);
      r = lerp(r, 14, b1 * 0.42);
      g = lerp(g, 118, b1 * 0.42);
      b = lerp(b, 92, b1 * 0.42);

      const dBloom2 = Math.hypot((nx - 0.78) * 0.9, (ny - 0.76) * 1.4);
      const b2 = Math.exp(-dBloom2 * dBloom2 * 5.8);
      r = lerp(r, 10, b2 * 0.34);
      g = lerp(g, 95, b2 * 0.34);
      b = lerp(b, 78, b2 * 0.34);

      const dx = (px + 0.5) - cx;
      const dy = (py + 0.5) - cy;
      const distCenter = Math.hypot(dx, dy);

      if (distCenter <= circleR + 36) {
        // Soft ambient glow ring around the circular medallion
        const haloDist = Math.max(0, distCenter - circleR);
        const haloGlow = Math.exp(-Math.pow(haloDist / 26, 2)) * 0.28;
        r = lerp(r, 16, haloGlow);
        g = lerp(g, 185, haloGlow);
        b = lerp(b, 129, haloGlow);

        const circleAlpha = 1 - smoothstep(circleR - 1.1, circleR + 0.5, distCenter);
        if (circleAlpha > 0.001) {
          const mx = 0.5 + dx / (circleR * 2);
          const my = 0.5 + dy / (circleR * 2);
          let [mr, mg, mb] = sampleMedallionSurface(mx, my, medallionSize, px, py);

          const rimDist = Math.abs(distCenter - (circleR - 1.5));
          const rimFactor = 1 - smoothstep(0.6, 2.2, rimDist);
          const topLeftHighlight = lerp(0.62, 0.16, clamp((mx + my) * 0.5, 0, 1));
          if (rimFactor > 0) {
            mr = lerp(mr, 167, rimFactor * topLeftHighlight);
            mg = lerp(mg, 243, rimFactor * topLeftHighlight);
            mb = lerp(mb, 208, rimFactor * topLeftHighlight);
          }

          const vx = (dx + iconPxSize * 0.5) / iconPxSize * 24;
          const vy = (dy + iconPxSize * 0.5 - medallionSize * 0.005) / iconPxSize * 24;
          const aa = (24 / iconPxSize) * 0.85;

          const dShadow = distBookOpen(vx, vy - 0.35);
          const shadowAlpha = (1 - smoothstep(halfStroke - aa, halfStroke + aa + 0.3, dShadow)) * 0.42;
          if (shadowAlpha > 0) {
            mr = lerp(mr, 2, shadowAlpha);
            mg = lerp(mg, 18, shadowAlpha);
            mb = lerp(mb, 14, shadowAlpha);
          }

          const d = distBookOpen(vx, vy);
          const iconAlpha = 1 - smoothstep(halfStroke - aa, halfStroke + aa, d);
          if (iconAlpha > 0) {
            mr = lerp(mr, 255, iconAlpha);
            mg = lerp(mg, 255, iconAlpha);
            mb = lerp(mb, 255, iconAlpha);
          }

          r = lerp(r, mr, circleAlpha);
          g = lerp(g, mg, circleAlpha);
          b = lerp(b, mb, circleAlpha);
        }
      }

      const idx = (py * width + px) * 4;
      rgba[idx] = Math.round(clamp(r, 0, 255));
      rgba[idx + 1] = Math.round(clamp(g, 0, 255));
      rgba[idx + 2] = Math.round(clamp(b, 0, 255));
      rgba[idx + 3] = 255;
    }
  }

  return encodePNG(width, height, rgba);
}

const targets = [
  { file: 'icon-512.png', size: 512, mode: 'circle-transparent', medallionRadiusRatio: 0.478, iconScale: 0.45, iconOffsetY: 0.005 },
  { file: 'icon-192.png', size: 192, mode: 'circle-transparent', medallionRadiusRatio: 0.478, iconScale: 0.45, iconOffsetY: 0.005 },
  { file: 'icon-512-maskable.png', size: 512, mode: 'maskable-circle-on-bg', medallionRadiusRatio: 0.385, iconScale: 0.37, iconOffsetY: 0.004 },
  { file: 'icon-192-maskable.png', size: 192, mode: 'maskable-circle-on-bg', medallionRadiusRatio: 0.385, iconScale: 0.37, iconOffsetY: 0.004 },
  { file: 'apple-touch-icon.png', size: 180, mode: 'full-bleed-apple', medallionRadiusRatio: 0.5, iconScale: 0.46, iconOffsetY: 0.005 },
];

for (const t of targets) {
  const png = renderMedallionIcon(t.size, t);
  fs.writeFileSync(path.join(publicDir, t.file), png);
  console.log(`Generated ${t.file} (${t.size}x${t.size}, ${png.length} bytes)`);
}

const splashPng = renderSplashScreen(750, 1334);
fs.writeFileSync(path.join(publicDir, 'apple-splash.png'), splashPng);
console.log(`Generated apple-splash.png (750x1334, ${splashPng.length} bytes)`);
