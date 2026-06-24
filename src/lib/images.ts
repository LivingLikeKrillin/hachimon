export interface ImageRef {
  raw: string;
  target: string;
  alt: string;
}

const EMBED_RE = /!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
const STD_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function isExternal(target: string): boolean {
  return /^(https?:|data:)/i.test(target);
}

/** 답변에서 인라인 대상 이미지 ref를 찾는다(http(s)·data: 제외). */
export function findImageRefs(answer: string): ImageRef[] {
  const refs: ImageRef[] = [];
  for (const m of answer.matchAll(EMBED_RE)) {
    const target = m[1].trim();
    if (!isExternal(target)) refs.push({ raw: m[0], target, alt: (m[2] ?? '').trim() });
  }
  for (const m of answer.matchAll(STD_RE)) {
    const target = m[2].trim();
    if (!isExternal(target)) refs.push({ raw: m[0], target, alt: (m[1] ?? '').trim() });
  }
  return refs;
}

/** 각 ref를 resolver 반환값으로 치환(비동기 순차). null이면 원본 유지.
 *  함수형 replace로 데이터 URI/alt 안의 `$` 특수처리를 방지.
 *  전제: resolver 반환값은 ref.raw를 포함하지 않아야 한다(CLI 리졸버는 `![alt](data:…)` 반환이라 안전). */
export async function replaceImageRefs(
  answer: string,
  resolver: (ref: ImageRef) => Promise<string | null>,
): Promise<string> {
  let result = answer;
  for (const ref of findImageRefs(answer)) {
    const replacement = await resolver(ref);
    if (replacement !== null) result = result.replace(ref.raw, () => replacement);
  }
  return result;
}
