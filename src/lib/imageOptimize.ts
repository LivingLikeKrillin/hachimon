/**
 * 브라우저(Obsidian Electron 렌더러) 환경용 이미지 최적화.
 *
 * CLI(`scripts/parse-vault.ts`)의 sharp 경로와 동일한 정책을 네이티브 의존성 없이
 * Canvas로 수행한다: 가로 800px 리사이즈(확대 금지) + WebP q80, SVG는 벡터 passthrough.
 * sharp 는 네이티브 모듈이라 Obsidian 플러그인에 번들할 수 없어 이 경로를 쓴다.
 */

export const MAX_WIDTH = 800;
export const WEBP_QUALITY = 0.8;
/** 인라인 결과가 이보다 크면 호출 측에서 경고할 수 있는 임계값(바이트). */
export const LARGE_WARN_BYTES = 200_000;

export function isSvgName(name: string): boolean {
  return name.toLowerCase().endsWith('.svg');
}

/** withoutEnlargement: 원본이 max 이하이면 원본 폭 유지. */
export function computeTargetWidth(naturalWidth: number, max = MAX_WIDTH): number {
  return naturalWidth > max ? max : naturalWidth;
}

/** Uint8Array → base64 (브라우저/Node 공통). 큰 배열은 청크로 끊어 스택 초과를 막는다. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function toDataUri(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob 실패'))), type, quality);
  });
}

/**
 * 이미지 바이트 → 최적화된 data URI.
 * SVG는 원본 벡터를 그대로 base64 인라인하고, 그 외는 Canvas로 리사이즈 후 WebP 인코딩한다.
 * 브라우저 전용(createImageBitmap·document·canvas 필요).
 */
export async function optimizeImageToDataUri(bytes: Uint8Array, name: string): Promise<string> {
  if (isSvgName(name)) return toDataUri('image/svg+xml', bytes);

  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart]));
  try {
    const width = computeTargetWidth(bitmap.width);
    const height = Math.max(1, Math.round(bitmap.height * (width / bitmap.width || 1)));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D 컨텍스트를 만들 수 없습니다');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const out = await canvasToBlob(canvas, 'image/webp', WEBP_QUALITY);
    return toDataUri('image/webp', new Uint8Array(await out.arrayBuffer()));
  } finally {
    bitmap.close();
  }
}
