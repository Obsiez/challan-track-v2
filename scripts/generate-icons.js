import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const publicDir = path.resolve('public');

// Zero-dependency RGBA8 PNG encoder with Sub filtering for compact, lossless high-res output
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
    const rowOut = y * (stride + 1);
    const rowIn = y * stride;
    raw[rowOut] = 1; // Sub filter for superior gradient/solid compression
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? rgba[rowIn + x - 4] : 0;
      raw[rowOut + 1 + x] = (rgba[rowIn + x] - left) & 0xff;
    }
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

// Signed distance to Lucide BookOpen icon in 24x24 viewBox
function distBookOpen(x, y) {
  let d = Infinity;
  // Left page
  d = Math.min(d, distSegment(x, y, 2, 3, 8, 3));
  d = Math.min(d, distArc(x, y, 8, 7, 4, -Math.PI / 2, 0));
  d = Math.min(d, distSegment(x, y, 12, 7, 12, 21));
  d = Math.min(d, distArc(x, y, 9, 21, 3, -Math.PI / 2, 0));
  d = Math.min(d, distSegment(x, y, 9, 18, 2, 18));
  d = Math.min(d, distSegment(x, y, 2, 18, 2, 3));

  // Right page
  d = Math.min(d, distSegment(x, y, 22, 3, 16, 3));
  d = Math.min(d, distArc(x, y, 16, 7, 4, Math.PI, 1.5 * Math.PI));
  d = Math.min(d, distArc(x, y, 15, 21, 3, Math.PI, 1.5 * Math.PI));
  d = Math.min(d, distSegment(x, y, 15, 18, 22, 18));
  d = Math.min(d, distSegment(x, y, 22, 18, 22, 3));
  return d;
}

/**
 * Pure, noise-free emerald-obsidian medallion gradient.
 * Zero artificial grain so there is never speckling or banding.
 */
function sampleMedallionSurface(mx, my) {
  const radCenter = clamp(Math.hypot(mx - 0.5, my - 0.5) * 2.0, 0, 1);
  let r = lerp(15, 7, radCenter);
  let g = lerp(31, 13, radCenter);
  let b = lerp(34, 21, radCenter);

  // Top-left luminous emerald aurora orb (#10B981)
  const dOrb1 = Math.hypot((mx - 0.28) * 1.1, (my - 0.24) * 1.1);
  const glow1 = Math.exp(-dOrb1 * dOrb1 * 4.2);
  r = lerp(r, 16, glow1 * 0.88);
  g = lerp(g, 185, glow1 * 0.88);
  b = lerp(b, 129, glow1 * 0.88);

  // Secondary lower-right deep teal depth (#047857)
  const dOrb2 = Math.hypot(mx - 0.72, my - 0.76);
  const glow2 = Math.exp(-dOrb2 * dOrb2 * 3.4);
  r = lerp(r, 4, glow2 * 0.45);
  g = lerp(g, 120, glow2 * 0.45);
  b = lerp(b, 87, glow2 * 0.45);

  return [r, g, b];
}

// 4x4 stratified supersample offsets inside [-0.5, 0.5)
const SS_OFFSETS = [-0.375, -0.125, 0.125, 0.375];

/**
 * Evaluates a single subpixel inside the circular medallion (strictly clipped within circleR).
 */
function sampleMedallionInterior(dx, dy, circleR, iconPxSize, iconOffsetPxY, rimInset, rimHalfW, halfStroke) {
  const distCenter = Math.hypot(dx, dy);
  const mx = 0.5 + dx / (circleR * 2);
  const my = 0.5 + dy / (circleR * 2);

  let [r, g, b] = sampleMedallionSurface(mx, my);

  // Specular rim strictly inside the circular boundary (zero outward bleed)
  const rimCenterR = circleR - rimInset;
  const rimDist = Math.abs(distCenter - rimCenterR);
  const rimFactor = 1 - smoothstep(rimHalfW * 0.4, rimHalfW * 1.45, rimDist);
  if (rimFactor > 0.001) {
    const topLeftHighlight = lerp(0.58, 0.14, clamp((mx + my) * 0.5, 0, 1));
    r = lerp(r, 167, rimFactor * topLeftHighlight);
    g = lerp(g, 243, rimFactor * topLeftHighlight);
    b = lerp(b, 208, rimFactor * topLeftHighlight);
  }

  // Crisp BookOpen stroke + subtle dark relief shadow
  const vx = (dx + iconPxSize * 0.5) / iconPxSize * 24;
  const vy = (dy + iconPxSize * 0.5 - iconOffsetPxY) / iconPxSize * 24;
  if (vx >= -2.5 && vx <= 26.5 && vy >= -2.5 && vy <= 26.5) {
    const aa = (24 / iconPxSize) * 0.45;
    const dShadow = distBookOpen(vx, vy - 0.32);
    const shadowAlpha = (1 - smoothstep(halfStroke - aa, halfStroke + aa + 0.25, dShadow)) * 0.42;
    if (shadowAlpha > 0.001) {
      r = lerp(r, 2, shadowAlpha);
      g = lerp(g, 18, shadowAlpha);
      b = lerp(b, 14, shadowAlpha);
    }

    const d = distBookOpen(vx, vy);
    const iconAlpha = 1 - smoothstep(halfStroke - aa, halfStroke + aa, d);
    if (iconAlpha > 0.001) {
      r = lerp(r, 255, iconAlpha);
      g = lerp(g, 255, iconAlpha);
      b = lerp(b, 255, iconAlpha);
    }
  }

  return [r, g, b];
}

function renderMedallionIcon(
  size,
  {
    mode, // 'circle-transparent' | 'maskable-circle-on-bg' | 'full-bleed-apple'
    medallionRadiusRatio = 0.478,
    iconScale = 0.45,
    iconOffsetY = 0.005,
  }
) {
  const rgba = Buffer.alloc(size * size * 4);
  const halfStroke = 0.96;
  const outerBg = [7, 11, 19]; // Exact #070B13

  const cx = size * 0.5;
  const cy = size * 0.5;
  const circleR = size * medallionRadiusRatio;
  const iconPxSize = size * iconScale;
  const iconOffsetPxY = size * iconOffsetY;
  const rimInset = Math.max(1.25, size * 0.0045);
  const rimHalfW = Math.max(0.85, size * 0.003);

  const iconHalfBound = iconPxSize * 0.55;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dxC = (px + 0.5) - cx;
      const dyC = (py + 0.5) - cy;
      const distC = Math.hypot(dxC, dyC);

      const idx = (py * size + px) * 4;

      if (mode === 'full-bleed-apple') {
        const nearIcon = Math.abs(dxC) <= iconHalfBound && Math.abs(dyC) <= iconHalfBound;
        if (nearIcon) {
          let sumR = 0, sumG = 0, sumB = 0;
          for (let sy = 0; sy < 4; sy++) {
            for (let sx = 0; sx < 4; sx++) {
              const dx = dxC + SS_OFFSETS[sx];
              const dy = dyC + SS_OFFSETS[sy];
              const mx = 0.5 + dx / size;
              const my = 0.5 + dy / size;
              let [r, g, b] = sampleMedallionSurface(mx, my);
              const vx = (dx + iconPxSize * 0.5) / iconPxSize * 24;
              const vy = (dy + iconPxSize * 0.5 - iconOffsetPxY) / iconPxSize * 24;
              const aa = (24 / iconPxSize) * 0.45;
              const dShadow = distBookOpen(vx, vy - 0.32);
              const shadowAlpha = (1 - smoothstep(halfStroke - aa, halfStroke + aa + 0.25, dShadow)) * 0.42;
              if (shadowAlpha > 0.001) {
                r = lerp(r, 2, shadowAlpha);
                g = lerp(g, 18, shadowAlpha);
                b = lerp(b, 14, shadowAlpha);
              }
              const d = distBookOpen(vx, vy);
              const iconAlpha = 1 - smoothstep(halfStroke - aa, halfStroke + aa, d);
              if (iconAlpha > 0.001) {
                r = lerp(r, 255, iconAlpha);
                g = lerp(g, 255, iconAlpha);
                b = lerp(b, 255, iconAlpha);
              }
              sumR += r; sumG += g; sumB += b;
            }
          }
          rgba[idx] = Math.round(clamp(sumR / 16, 0, 255));
          rgba[idx + 1] = Math.round(clamp(sumG / 16, 0, 255));
          rgba[idx + 2] = Math.round(clamp(sumB / 16, 0, 255));
          rgba[idx + 3] = 255;
        } else {
          const [r, g, b] = sampleMedallionSurface(0.5 + dxC / size, 0.5 + dyC / size);
          rgba[idx] = Math.round(clamp(r, 0, 255));
          rgba[idx + 1] = Math.round(clamp(g, 0, 255));
          rgba[idx + 2] = Math.round(clamp(b, 0, 255));
          rgba[idx + 3] = 255;
        }
        continue;
      }

      // Completely outside the circle -> 100% pure solid #070B13 or 100% transparent (ZERO noise/halo)
      if (distC >= circleR + 1.0) {
        if (mode === 'maskable-circle-on-bg') {
          rgba[idx] = outerBg[0];
          rgba[idx + 1] = outerBg[1];
          rgba[idx + 2] = outerBg[2];
          rgba[idx + 3] = 255;
        }
        // For circle-transparent, buffer is already 0,0,0,0
        continue;
      }

      // Analytical pixel coverage for a silky-smooth, perfectly round circle perimeter
      const circleCov = clamp(circleR + 0.5 - distC, 0, 1);
      const nearBoundary = distC > circleR - rimInset - rimHalfW * 2 - 2.0;
      const nearIcon = Math.abs(dxC) <= iconHalfBound && Math.abs(dyC) <= iconHalfBound;

      let mr = 0, mg = 0, mb = 0;
      if (nearBoundary || nearIcon) {
        let sumR = 0, sumG = 0, sumB = 0;
        for (let sy = 0; sy < 4; sy++) {
          for (let sx = 0; sx < 4; sx++) {
            const dx = dxC + SS_OFFSETS[sx];
            const dy = dyC + SS_OFFSETS[sy];
            const [sr, sg, sb] = sampleMedallionInterior(
              dx, dy, circleR, iconPxSize, iconOffsetPxY, rimInset, rimHalfW, halfStroke
            );
            sumR += sr; sumG += sg; sumB += sb;
          }
        }
        mr = sumR / 16;
        mg = sumG / 16;
        mb = sumB / 16;
      } else {
        const mx = 0.5 + dxC / (circleR * 2);
        const my = 0.5 + dyC / (circleR * 2);
        [mr, mg, mb] = sampleMedallionSurface(mx, my);
      }

      if (mode === 'circle-transparent') {
        if (circleCov <= 0.001) continue;
        // Straight alpha with clean interior RGB prevents dark fringe around transparent edge
        rgba[idx] = Math.round(clamp(mr, 0, 255));
        rgba[idx + 1] = Math.round(clamp(mg, 0, 255));
        rgba[idx + 2] = Math.round(clamp(mb, 0, 255));
        rgba[idx + 3] = Math.round(clamp(circleCov * 255, 0, 255));
      } else {
        // maskable-circle-on-bg: sharp circular medallion over pure #070B13
        const outR = lerp(outerBg[0], mr, circleCov);
        const outG = lerp(outerBg[1], mg, circleCov);
        const outB = lerp(outerBg[2], mb, circleCov);
        rgba[idx] = Math.round(clamp(outR, 0, 255));
        rgba[idx + 1] = Math.round(clamp(outG, 0, 255));
        rgba[idx + 2] = Math.round(clamp(outB, 0, 255));
        rgba[idx + 3] = 255;
      }
    }
  }

  return encodePNG(size, size, rgba);
}

function renderSplashScreen(width, height) {
  const rgba = Buffer.alloc(width * height * 4);
  const outerBg = [7, 11, 19]; // Pure #070B13 — zero background blooms or halo banding
  const cx = width * 0.5;
  const cy = height * 0.5;
  const medallionSize = Math.round(Math.min(width, height) * 0.285); // ~333px on 1170x2532
  const circleR = medallionSize * 0.5;
  const iconPxSize = medallionSize * 0.455;
  const iconOffsetPxY = medallionSize * 0.005;
  const rimInset = Math.max(1.5, medallionSize * 0.0045);
  const rimHalfW = Math.max(0.95, medallionSize * 0.003);
  const halfStroke = 0.96;
  const iconHalfBound = iconPxSize * 0.55;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const idx = (py * width + px) * 4;
      const dxC = (px + 0.5) - cx;
      const dyC = (py + 0.5) - cy;
      const distC = Math.hypot(dxC, dyC);

      if (distC >= circleR + 1.0) {
        rgba[idx] = outerBg[0];
        rgba[idx + 1] = outerBg[1];
        rgba[idx + 2] = outerBg[2];
        rgba[idx + 3] = 255;
        continue;
      }

      const circleCov = clamp(circleR + 0.5 - distC, 0, 1);
      const nearBoundary = distC > circleR - rimInset - rimHalfW * 2 - 2.0;
      const nearIcon = Math.abs(dxC) <= iconHalfBound && Math.abs(dyC) <= iconHalfBound;

      let mr = 0, mg = 0, mb = 0;
      if (nearBoundary || nearIcon) {
        let sumR = 0, sumG = 0, sumB = 0;
        for (let sy = 0; sy < 4; sy++) {
          for (let sx = 0; sx < 4; sx++) {
            const dx = dxC + SS_OFFSETS[sx];
            const dy = dyC + SS_OFFSETS[sy];
            const [sr, sg, sb] = sampleMedallionInterior(
              dx, dy, circleR, iconPxSize, iconOffsetPxY, rimInset, rimHalfW, halfStroke
            );
            sumR += sr; sumG += sg; sumB += sb;
          }
        }
        mr = sumR / 16;
        mg = sumG / 16;
        mb = sumB / 16;
      } else {
        const mx = 0.5 + dxC / (circleR * 2);
        const my = 0.5 + dyC / (circleR * 2);
        [mr, mg, mb] = sampleMedallionSurface(mx, my);
      }

      const r = lerp(outerBg[0], mr, circleCov);
      const g = lerp(outerBg[1], mg, circleCov);
      const b = lerp(outerBg[2], mb, circleCov);
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

const splashPng = renderSplashScreen(1170, 2532);
fs.writeFileSync(path.join(publicDir, 'apple-splash.png'), splashPng);
console.log(`Generated apple-splash.png (1170x2532, ${splashPng.length} bytes)`);
