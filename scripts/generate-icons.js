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
    raw[rowOut] = 1; // Sub filter
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

// Signed distance to Lucide BookOpen icon stroke in 24x24 viewBox
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

// Soft interior check for translucent frosted folio page fill
function insideBookPages(x, y) {
  if (x < 2 || x > 22 || y < 3 || y > 20) return false;
  if (x <= 12) {
    // Left page top curve at right edge (cx=8,cy=7,r=4)
    if (x > 8 && y < 7 && Math.hypot(x - 8, y - 7) > 4) return false;
    // Left page bottom curve at right edge (cx=9,cy=21,r=3)
    if (x <= 9 && y > 18) return false;
    if (x > 9 && Math.hypot(x - 9, y - 21) < 3) return false;
    return true;
  } else {
    // Right page top curve at left edge (cx=16,cy=7,r=4)
    if (x < 16 && y < 7 && Math.hypot(x - 16, y - 7) > 4) return false;
    if (x >= 15 && y > 18) return false;
    if (x < 15 && Math.hypot(x - 15, y - 21) < 3) return false;
    return true;
  }
}

/**
 * Multi-layered smoked-glass & refractive emerald-obsidian aurora surface.
 * Matches Challan Track's signature ambient glass aesthetic with spherical depth.
 */
function sampleMedallionSurface(mx, my) {
  const dx = mx - 0.5;
  const dy = my - 0.5;
  const radCenter = clamp(Math.hypot(dx, dy) * 2.0, 0, 1);

  // Deep smoked-obsidian glass base with spherical edge vignette
  const edgeShade = Math.pow(radCenter, 1.85);
  let r = lerp(13, 5, edgeShade);
  let g = lerp(31, 10, edgeShade);
  let b = lerp(33, 17, edgeShade);

  // Primary luminous emerald aurora orb (top-left)
  const dOrb1 = Math.hypot((mx - 0.27) * 1.08, (my - 0.24) * 1.08);
  const glow1 = Math.exp(-dOrb1 * dOrb1 * 4.0);
  r = lerp(r, 16, glow1 * 0.90);
  g = lerp(g, 185, glow1 * 0.90);
  b = lerp(b, 129, glow1 * 0.90);

  // Inner bright mint core inside aurora orb for luminous depth
  const dCore = Math.hypot((mx - 0.25) * 1.25, (my - 0.22) * 1.25);
  const coreGlow = Math.exp(-dCore * dCore * 11.5);
  r = lerp(r, 52, coreGlow * 0.42);
  g = lerp(g, 211, coreGlow * 0.42);
  b = lerp(b, 153, coreGlow * 0.42);

  // Secondary cyan-teal ambient refraction (lower-right, echoing app backdrop)
  const dOrb2 = Math.hypot((mx - 0.78) * 1.1, (my - 0.76) * 1.1);
  const glow2 = Math.exp(-dOrb2 * dOrb2 * 3.8);
  r = lerp(r, 6, glow2 * 0.50);
  g = lerp(g, 138, glow2 * 0.50);
  b = lerp(b, 122, glow2 * 0.50);

  // Center subtle emerald depth glow behind the floating folio icon
  const dCenterGlow = Math.hypot(dx * 1.3, dy * 1.3);
  const centerLuma = Math.exp(-dCenterGlow * dCenterGlow * 7.5);
  r = lerp(r, 20, centerLuma * 0.26);
  g = lerp(g, 148, centerLuma * 0.26);
  b = lerp(b, 112, centerLuma * 0.26);

  // Convex smoked-glass upper-left specular dome reflection
  const sheenDist = Math.hypot((mx - 0.34) * 0.85, (my - 0.12) * 1.65);
  const sheen = Math.exp(-sheenDist * sheenDist * 5.6) * (1 - smoothstep(0.38, 0.72, my));
  if (sheen > 0.002) {
    r = lerp(r, 220, sheen * 0.14);
    g = lerp(g, 252, sheen * 0.14);
    b = lerp(b, 240, sheen * 0.14);
  }

  // Subtle curved bottom rim bounce-light (glass thickness refraction)
  const bottomArcDist = Math.hypot((mx - 0.56) * 1.1, (my - 0.90) * 2.2);
  const bounce = Math.exp(-bottomArcDist * bottomArcDist * 6.5) * smoothstep(0.55, 0.95, my);
  if (bounce > 0.002) {
    r = lerp(r, 45, bounce * 0.22);
    g = lerp(g, 212, bounce * 0.22);
    b = lerp(b, 168, bounce * 0.22);
  }

  return [r, g, b];
}

// 4x4 stratified supersample offsets inside [-0.5, 0.5)
const SS_OFFSETS = [-0.375, -0.125, 0.125, 0.375];

function sampleBookMark(r, g, b, dx, dy, iconPxSize, iconOffsetPxY, halfStroke) {
  const vx = (dx + iconPxSize * 0.5) / iconPxSize * 24;
  const vy = (dy + iconPxSize * 0.5 - iconOffsetPxY) / iconPxSize * 24;
  if (vx >= -3.5 && vx <= 27.5 && vy >= -3.5 && vy <= 27.5) {
    const aa = (24 / iconPxSize) * 0.45;

    // 1. Soft wide ambient elevation shadow below the floating folio
    const dAmbient = distBookOpen(vx, vy - 0.85);
    const ambientAlpha = (1 - smoothstep(halfStroke - aa, halfStroke + aa + 1.35, dAmbient)) * 0.36;
    if (ambientAlpha > 0.001) {
      r = lerp(r, 2, ambientAlpha);
      g = lerp(g, 12, ambientAlpha);
      b = lerp(b, 10, ambientAlpha);
    }

    // 2. Crisp close contact relief shadow
    const dShadow = distBookOpen(vx, vy - 0.32);
    const shadowAlpha = (1 - smoothstep(halfStroke - aa, halfStroke + aa + 0.30, dShadow)) * 0.48;
    if (shadowAlpha > 0.001) {
      r = lerp(r, 2, shadowAlpha);
      g = lerp(g, 14, shadowAlpha);
      b = lerp(b, 12, shadowAlpha);
    }

    // 3. Subtle frosted translucent page fill inside open book leaves
    if (insideBookPages(vx, vy)) {
      const pageTint = lerp(0.11, 0.04, clamp((vy - 3) / 16, 0, 1));
      r = lerp(r, 236, pageTint);
      g = lerp(g, 253, pageTint);
      b = lerp(b, 245, pageTint);
    }

    // 4. Crisp luminous white BookOpen stroke with subtle vertical pearl gradient
    const d = distBookOpen(vx, vy);
    const iconAlpha = 1 - smoothstep(halfStroke - aa, halfStroke + aa, d);
    if (iconAlpha > 0.001) {
      const topSheen = clamp(1 - (vy - 3) / 18, 0, 1);
      const strokeR = lerp(236, 255, topSheen);
      const strokeG = lerp(250, 255, topSheen);
      const strokeB = lerp(245, 255, topSheen);
      r = lerp(r, strokeR, iconAlpha);
      g = lerp(g, strokeG, iconAlpha);
      b = lerp(b, strokeB, iconAlpha);
    }
  }
  return [r, g, b];
}

/**
 * Evaluates a single subpixel inside the circular medallion (strictly clipped within circleR).
 */
function sampleMedallionInterior(dx, dy, circleR, iconPxSize, iconOffsetPxY, rimInset, rimHalfW, halfStroke) {
  const distCenter = Math.hypot(dx, dy);
  const mx = 0.5 + dx / (circleR * 2);
  const my = 0.5 + dy / (circleR * 2);

  let [r, g, b] = sampleMedallionSurface(mx, my);

  // Recessed inner depth bevel ring (~3.2% inside edge)
  const grooveR = circleR - rimInset * 4.2;
  const grooveHalfW = Math.max(0.75, circleR * 0.006);
  const grooveDist = Math.abs(distCenter - grooveR);
  const grooveFactor = 1 - smoothstep(grooveHalfW * 0.3, grooveHalfW * 1.7, grooveDist);
  if (grooveFactor > 0.001) {
    r = lerp(r, 3, grooveFactor * 0.38);
    g = lerp(g, 14, grooveFactor * 0.38);
    b = lerp(b, 12, grooveFactor * 0.38);
  }

  // Secondary subtle inner glass rim highlight right inside the groove
  const innerRimR = grooveR - grooveHalfW * 1.8;
  const innerRimDist = Math.abs(distCenter - innerRimR);
  const innerRimFactor = 1 - smoothstep(rimHalfW * 0.25, rimHalfW * 1.25, innerRimDist);
  if (innerRimFactor > 0.001) {
    const directional = lerp(0.28, 0.06, clamp((mx + my) * 0.5, 0, 1));
    r = lerp(r, 167, innerRimFactor * directional);
    g = lerp(g, 243, innerRimFactor * directional);
    b = lerp(b, 208, innerRimFactor * directional);
  }

  // Outer crisp specular glass rim strictly inside the circular boundary
  const rimCenterR = circleR - rimInset;
  const rimDist = Math.abs(distCenter - rimCenterR);
  const rimFactor = 1 - smoothstep(rimHalfW * 0.35, rimHalfW * 1.45, rimDist);
  if (rimFactor > 0.001) {
    const topLeftHighlight = lerp(0.72, 0.18, clamp((mx + my) * 0.5, 0, 1));
    r = lerp(r, 209, rimFactor * topLeftHighlight);
    g = lerp(g, 250, rimFactor * topLeftHighlight);
    b = lerp(b, 229, rimFactor * topLeftHighlight);
  }

  return sampleBookMark(r, g, b, dx, dy, iconPxSize, iconOffsetPxY, halfStroke);
}

function renderMedallionIcon(
  size,
  {
    mode, // 'circle-transparent' | 'full-bleed-apple'
    medallionRadiusRatio = 0.49,
    surfaceScaleRatio = 1.0,
    iconScale = 0.45,
    iconOffsetY = 0.005,
  }
) {
  const rgba = Buffer.alloc(size * size * 4);
  const halfStroke = 0.96;

  const cx = size * 0.5;
  const cy = size * 0.5;
  const circleR = size * medallionRadiusRatio;
  const surfaceSpan = size * surfaceScaleRatio;
  const iconPxSize = size * iconScale;
  const iconOffsetPxY = size * iconOffsetY;
  const rimInset = Math.max(1.25, size * 0.0045);
  const rimHalfW = Math.max(0.85, size * 0.003);

  const iconHalfBound = iconPxSize * 0.62;

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
              const mx = 0.5 + dx / surfaceSpan;
              const my = 0.5 + dy / surfaceSpan;
              let [r, g, b] = sampleMedallionSurface(mx, my);
              [r, g, b] = sampleBookMark(r, g, b, dx, dy, iconPxSize, iconOffsetPxY, halfStroke);
              sumR += r; sumG += g; sumB += b;
            }
          }
          rgba[idx] = Math.round(clamp(sumR / 16, 0, 255));
          rgba[idx + 1] = Math.round(clamp(sumG / 16, 0, 255));
          rgba[idx + 2] = Math.round(clamp(sumB / 16, 0, 255));
          rgba[idx + 3] = 255;
        } else {
          const [r, g, b] = sampleMedallionSurface(0.5 + dxC / surfaceSpan, 0.5 + dyC / surfaceSpan);
          rgba[idx] = Math.round(clamp(r, 0, 255));
          rgba[idx + 1] = Math.round(clamp(g, 0, 255));
          rgba[idx + 2] = Math.round(clamp(b, 0, 255));
          rgba[idx + 3] = 255;
        }
        continue;
      }

      // Completely outside the circle -> 100% transparent (ZERO dark background/halo)
      if (distC >= circleR + 1.0) {
        continue;
      }

      const circleCov = clamp(circleR + 0.5 - distC, 0, 1);
      const nearBoundary = distC > circleR - rimInset * 5.5 - rimHalfW * 3 - 2.0;
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

      if (circleCov <= 0.001) continue;
      rgba[idx] = Math.round(clamp(mr, 0, 255));
      rgba[idx + 1] = Math.round(clamp(mg, 0, 255));
      rgba[idx + 2] = Math.round(clamp(mb, 0, 255));
      rgba[idx + 3] = Math.round(clamp(circleCov * 255, 0, 255));
    }
  }

  return encodePNG(size, size, rgba);
}

function renderSplashScreen(width, height) {
  const rgba = Buffer.alloc(width * height * 4);
  const outerBg = [7, 11, 19]; // Pure #070B13
  const cx = width * 0.5;
  const cy = height * 0.5;
  const medallionSize = Math.round(Math.min(width, height) * 0.285);
  const circleR = medallionSize * 0.5;
  const iconPxSize = medallionSize * 0.455;
  const iconOffsetPxY = medallionSize * 0.005;
  const rimInset = Math.max(1.5, medallionSize * 0.0045);
  const rimHalfW = Math.max(0.95, medallionSize * 0.003);
  const halfStroke = 0.96;
  const iconHalfBound = iconPxSize * 0.62;

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
      const nearBoundary = distC > circleR - rimInset * 5.5 - rimHalfW * 3 - 2.0;
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
  { file: 'icon-512.png', size: 512, mode: 'circle-transparent', medallionRadiusRatio: 0.49, iconScale: 0.45, iconOffsetY: 0.005 },
  { file: 'icon-192.png', size: 192, mode: 'circle-transparent', medallionRadiusRatio: 0.49, iconScale: 0.45, iconOffsetY: 0.005 },
  { file: 'icon-512-maskable.png', size: 512, mode: 'full-bleed-apple', medallionRadiusRatio: 0.5, surfaceScaleRatio: 0.78, iconScale: 0.36, iconOffsetY: 0.004 },
  { file: 'icon-192-maskable.png', size: 192, mode: 'full-bleed-apple', medallionRadiusRatio: 0.5, surfaceScaleRatio: 0.78, iconScale: 0.36, iconOffsetY: 0.004 },
  { file: 'apple-touch-icon.png', size: 180, mode: 'full-bleed-apple', medallionRadiusRatio: 0.5, surfaceScaleRatio: 0.96, iconScale: 0.45, iconOffsetY: 0.005 },
];

for (const t of targets) {
  const png = renderMedallionIcon(t.size, t);
  fs.writeFileSync(path.join(publicDir, t.file), png);
  console.log(`Generated ${t.file} (${t.size}x${t.size}, ${png.length} bytes)`);
}

const splashPng = renderSplashScreen(1170, 2532);
fs.writeFileSync(path.join(publicDir, 'apple-splash.png'), splashPng);
console.log(`Generated apple-splash.png (1170x2532, ${splashPng.length} bytes)`);
