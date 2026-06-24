/**
 * 코드블록 크롬(언어 라벨 + 줄 번호) 헬퍼.
 * react-markdown 이 `pre` 컴포넌트에 넘기는 hast 노드에서
 * 언어와 줄 수를 추출한다. rehype-highlight 가 `<code class="hljs language-xxx">`
 * 형태로 변환한 뒤 호출된다.
 */

/** react-markdown 이 넘기는 hast 노드의 최소 형태 (hast 의존성 없이 로컬 정의). */
export interface HastNode {
  type?: string;
  tagName?: string;
  value?: string;
  properties?: { className?: unknown };
  children?: HastNode[];
}

/** 소문자 언어 키 → 표시 라벨. 미등록 언어는 대문자로 fallback. */
const LANG_LABELS: Record<string, string> = {
  java: 'Java',
  kotlin: 'Kotlin',
  kt: 'Kotlin',
  sql: 'SQL',
  jpql: 'JPQL',
  yaml: 'YAML',
  yml: 'YAML',
  json: 'JSON',
  xml: 'XML',
  properties: 'Properties',
  gradle: 'Gradle',
  groovy: 'Groovy',
  bash: 'Bash',
  sh: 'Shell',
  shell: 'Shell',
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  jsx: 'JSX',
  html: 'HTML',
  css: 'CSS',
  python: 'Python',
  py: 'Python',
  go: 'Go',
  http: 'HTTP',
};

/** 언어 키를 표시용 라벨로. 빈 값/미인식은 빈 문자열 또는 대문자 fallback. */
export function formatLang(lang: string): string {
  if (!lang) return '';
  return LANG_LABELS[lang.toLowerCase()] ?? lang.toUpperCase();
}

function classList(node?: HastNode): string[] {
  const c = node?.properties?.className;
  if (Array.isArray(c)) return c.map(String);
  if (typeof c === 'string') return c.split(/\s+/).filter(Boolean);
  return [];
}

function textOf(node?: HastNode): string {
  if (!node) return '';
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textOf).join('');
}

/**
 * `pre` hast 노드에서 코드 언어와 줄 수를 추출한다.
 * 줄 수는 후행 개행 1개를 제거한 뒤 계산한다(펜스 닫힘 직전의 개행 보정).
 */
export function extractCodeMeta(preNode?: HastNode): { lang: string; lineCount: number } {
  const code = preNode?.children?.find((c) => c.tagName === 'code');
  const lang =
    classList(code)
      .filter((c) => c.startsWith('language-'))
      .map((c) => c.slice('language-'.length))[0] ?? '';
  const raw = textOf(code).replace(/\n$/, '');
  const lineCount = raw.length === 0 ? 0 : raw.split('\n').length;
  return { lang, lineCount };
}
