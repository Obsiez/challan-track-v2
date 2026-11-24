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

function sampleCircleGradient(nx, ny) {
  // Rich, high-contrast emerald medallion gradient
  const t1 = clamp(Math.hypot(nx - 0.32, ny - 0.24) / 0.85, 0, 1);
  let r, g, b;
  if (t1 < 0.35) {
    const k = t1 / 0.35;
    r = lerp(0x10, 0x05, k);
    g = lerp(0xb9, 0x96, k);
    b = lerp(0x81, 0x69, k);
  } else if (t1 < 0.70) {
    const k = (t1 - 0.35) / 0.35;
    r = lerp(0x05, 0x04, k);
    g = lerp(0x96, 0x78, k);
    b = lerp(0x69, 0x57, k);
  } else {
    const k = (t1 - 0.70) / 0.30;
    r = lerp(0x04, 0x06, k);
    g = lerp(0x78, 0x4e, k);
    b = lerp(0x57, 0x3b, k);
  }

  return [r, g, b];
}

function renderIcon(size, { circularMask, iconScale, iconOffsetY }) {
  const rgba = Buffer.alloc(size * size * 4);
  const halfStroke = 1.25; // Pronounced stroke-width ~2.50 in 24x24 viewBox

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const nx = (px + 0.5) / size;
      const ny = (py + 0.5) / size;

      let bgAlpha = 1;
      const distCenter = Math.hypot((nx - 0.5) * size, (ny - 0.5) * size);
      const circleR = size * (248 / 512);
      if (circularMask) {
        bgAlpha = 1 - smoothstep(circleR - 1.1, circleR + 0.4, distCenter);
      }

      if (bgAlpha <= 0.001) {
        continue;
      }

      let [r, g, b] = sampleCircleGradient(nx, ny);

      // Fine tactile micro-texture (subtle guilloche diamond mesh & micro-grain)
      const gx = (px % 12) - 6;
      const gy = (py % 12) - 6;
      const diamondMesh = (Math.abs(gx) + Math.abs(gy) === 6) ? 3.5 : 0;
      const grain = (((px * 41 + py * 83) % 23) / 23 - 0.5) * 4;
      const texture = diamondMesh + grain;
      r = clamp(r + texture * 0.8, 0, 255);
      g = clamp(g + texture * 1.1, 0, 255);
      b = clamp(b + texture * 0.8, 0, 255);

      // Pronounced specular rim highlight
      if (circularMask) {
        const rimDist = Math.abs(distCenter - (circleR - size * (2.8 / 512)));
        const rimW = size * (2.8 / 512);
        const rimAlpha = (1 - smoothstep(rimW * 0.5, rimW + 1.2, rimDist)) *
          lerp(0.70, 0.20, clamp((nx + ny) * 0.5, 0, 1));
        if (rimAlpha > 0) {
          r = r * (1 - rimAlpha) + 255 * rimAlpha;
          g = g * (1 - rimAlpha) + 255 * rimAlpha;
          b = b * (1 - rimAlpha) + 255 * rimAlpha;
        }

        // Inner subtle bezel shadow
        const innerBezelDist = Math.abs(distCenter - (circleR - size * (8 / 512)));
        if (innerBezelDist < 1.5) {
          const bezelDark = (1 - innerBezelDist / 1.5) * 0.18;
          r *= (1 - bezelDark);
          g *= (1 - bezelDark);
          b *= (1 - bezelDark);
        }
      }

      // Map pixel into 24x24 BookOpen viewBox
      const iconPxSize = size * iconScale;
      const vx = ((px + 0.5) - (size - iconPxSize) * 0.5) / iconPxSize * 24;
      const vy = ((py + 0.5) - (size - iconPxSize) * 0.5 - size * iconOffsetY) / iconPxSize * 24;

      // Drop shadow for pronounced 3D relief
      const shadowOffsetY = 0.32;
      const dShadow = distBookOpen(vx, vy - shadowOffsetY);
      const aa = 24 / iconPxSize * 0.85;
      const shadowAlpha = (1 - smoothstep(halfStroke - aa, halfStroke + aa + 0.35, dShadow)) * 0.55;
      if (shadowAlpha > 0) {
        r = r * (1 - shadowAlpha) + 2 * shadowAlpha;
        g = g * (1 - shadowAlpha) + 40 * shadowAlpha;
        b = b * (1 - shadowAlpha) + 30 * shadowAlpha;
      }

      // Sharp white icon mark
      const d = distBookOpen(vx, vy);
      const iconAlpha = 1 - smoothstep(halfStroke - aa, halfStroke + aa, d);

      if (iconAlpha > 0) {
        r = r * (1 - iconAlpha) + 255 * iconAlpha;
        g = g * (1 - iconAlpha) + 255 * iconAlpha;
        b = b * (1 - iconAlpha) + 255 * iconAlpha;
      }

      const idx = (py * size + px) * 4;
      rgba[idx] = Math.round(clamp(r, 0, 255));
      rgba[idx + 1] = Math.round(clamp(g, 0, 255));
      rgba[idx + 2] = Math.round(clamp(b, 0, 255));
      rgba[idx + 3] = Math.round(clamp(bgAlpha * 255, 0, 255));
    }
  }

  return encodePNG(size, size, rgba);
}

const targets = [
  { file: 'icon-512.png', size: 512, circularMask: true, iconScale: 0.5625, iconOffsetY: 0.01 },
  { file: 'icon-192.png', size: 192, circularMask: true, iconScale: 0.5625, iconOffsetY: 0.01 },
  { file: 'icon-512-maskable.png', size: 512, circularMask: false, iconScale: 0.47, iconOffsetY: 0.01 },
  { file: 'icon-192-maskable.png', size: 192, circularMask: false, iconScale: 0.47, iconOffsetY: 0.01 },
  { file: 'apple-touch-icon.png', size: 180, circularMask: false, iconScale: 0.52, iconOffsetY: 0.01 },
];

for (const t of targets) {
  const png = renderIcon(t.size, t);
  fs.writeFileSync(path.join(publicDir, t.file), png);
  console.log(`Generated ${t.file} (${t.size}x${t.size}, ${png.length} bytes)`);
}
