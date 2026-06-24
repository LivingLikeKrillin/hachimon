import { extractCodeMeta, formatLang, type HastNode } from '@/lib/codeblock';

interface CodeBlockProps {
  /** react-markdown 이 넘기는 `pre` hast 노드 (언어/줄 수 추출용) */
  node?: HastNode;
  /** 하이라이트된 `<code>` 엘리먼트 */
  children?: React.ReactNode;
}

/**
 * 답변 마크다운의 코드블록을 언어 라벨 + 줄 번호 거터로 감싼다.
 * react-markdown `components.pre` 로 연결한다. 줄 번호는 코드와 동일한
 * line-height(1.75)/font-size(12.5px)를 공유해 정렬된다 (줄바꿈 없음 전제).
 */
export default function CodeBlock({ node, children }: CodeBlockProps) {
  const { lang, lineCount } = extractCodeMeta(node);
  const label = formatLang(lang);

  return (
    <div className="code-card">
      {label && <div className="code-lang">{label}</div>}
      <div className="code-scroll">
        {lineCount > 1 && (
          <pre className="code-gutter" aria-hidden="true">
            {Array.from({ length: lineCount }, (_, i) => i + 1).join('\n')}
          </pre>
        )}
        <pre className="code-pre">{children}</pre>
      </div>
    </div>
  );
}
