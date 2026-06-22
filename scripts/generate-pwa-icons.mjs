// PWA 아이콘 생성 스크립트
// public/logo.png → pwa-192.png, pwa-512.png (purpose: any)
//                 → maskable-512.png (purpose: maskable, 안전영역 패딩)
//
// 실행: node scripts/generate-pwa-icons.mjs
// 로고를 교체했을 때 다시 실행하면 된다.

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(__dirname, '../public');
const SRC = path.join(PUBLIC, 'logo.png');

// 다크 배경 (zinc-950) — 디자인 토큰과 일치
const BG = { r: 9, g: 9, b: 11, alpha: 1 };

async function resizeIcon(size) {
  await sharp(SRC)
    .resize(size, size, { fit: 'contain', background: BG })
    .png()
    .toFile(path.join(PUBLIC, `pwa-${size}.png`));
  console.log(`✓ pwa-${size}.png`);
}

async function maskableIcon(size) {
  // 안전영역: 마스크가 가장자리를 잘라내므로 로고를 ~80% 크기로 중앙 배치
  const logoSize = Math.round(size * 0.8);
  const logo = await sharp(SRC)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(PUBLIC, `maskable-${size}.png`));
  console.log(`✓ maskable-${size}.png`);
}

await resizeIcon(192);
await resizeIcon(512);
await maskableIcon(512);
console.log('PWA 아이콘 생성 완료');
