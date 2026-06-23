// 앱 아이콘 생성 — 골드 토리이(문) 마크
// favicon.svg + pwa-192/512 + maskable-512 + apple-touch-icon (sharp 래스터화)
// 실행: node scripts/generate-icons.mjs

import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(__dirname, '../public');

const TORII = `
  <line x1="130" y1="152" x2="382" y2="152" stroke-width="32"/>
  <line x1="166" y1="214" x2="346" y2="214" stroke-width="21"/>
  <line x1="186" y1="152" x2="186" y2="398" stroke-width="21"/>
  <line x1="326" y1="152" x2="326" y2="398" stroke-width="21"/>`;

function svg({ round = false, bg = '#15171D' } = {}) {
  const shape = round
    ? `<rect width="512" height="512" rx="116" fill="${bg}"/><rect x="5" y="5" width="502" height="502" rx="111" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>`
    : `<rect width="512" height="512" fill="${bg}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${shape}<g stroke="#E9A94C" fill="none" stroke-linecap="round">${TORII}</g></svg>`;
}

const roundedSvg = svg({ round: true });
const squareSvg = svg({ round: false });

// 브라우저 탭 favicon (SVG, 라운드 타일)
writeFileSync(path.join(PUBLIC, 'favicon.svg'), roundedSvg, 'utf8');
console.log('✓ favicon.svg');

async function png(src, size, name) {
  await sharp(Buffer.from(src)).resize(size, size).png().toFile(path.join(PUBLIC, name));
  console.log(`✓ ${name}`);
}

await png(roundedSvg, 180, 'apple-touch-icon.png'); // iOS가 자체 라운딩
await png(squareSvg, 192, 'pwa-192.png');
await png(squareSvg, 512, 'pwa-512.png');
await png(squareSvg, 512, 'maskable-512.png'); // 토리이가 80% 안전영역 내
await png(roundedSvg, 64, 'favicon-64.png'); // 구형 브라우저 폴백
console.log('아이콘 생성 완료');
