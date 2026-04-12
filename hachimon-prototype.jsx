import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ChevronRight, ChevronDown, Flame, Sparkles,
  Folder, CreditCard, X, AlertTriangle, RotateCcw,
  Home, Monitor, BarChart3, Settings, ChevronLeft,
  Target, Zap,
} from "lucide-react";

/*  ═══ Spacing constants ═══
    px  = 16px  (page horizontal)
    gap = 16px  (between sections)
    cp  = 16px  (card internal padding)
    tab = 82px  (tab bar height incl. safe area)
    All pages: px-4 pt-1 pb-[88px]
    All CardContent: p-4
    All section labels: text-[11px] font-medium uppercase tracking-widest text-zinc-500 mb-3
    All touch targets: min-h-[44px]
*/

/* ═══════════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════════ */
const DECKS = [
  { id: "flashcard/spring/core", name: "Spring Core", path: ["flashcard","spring","core"], cardCount: 87, due: 12, mastered: 41 },
  { id: "flashcard/spring/batch", name: "Spring Batch", path: ["flashcard","spring","batch"], cardCount: 34, due: 5, mastered: 18 },
  { id: "flashcard/spring/security", name: "Spring Security", path: ["flashcard","spring","security"], cardCount: 28, due: 8, mastered: 9 },
  { id: "flashcard/spring/data", name: "Spring Data", path: ["flashcard","spring","data"], cardCount: 42, due: 3, mastered: 22 },
  { id: "flashcard/jpa/core", name: "JPA Core", path: ["flashcard","jpa","core"], cardCount: 65, due: 9, mastered: 30 },
  { id: "flashcard/jpa/querydsl", name: "QueryDSL", path: ["flashcard","jpa","querydsl"], cardCount: 23, due: 2, mastered: 12 },
  { id: "flashcard/java/concurrency", name: "Java Concurrency", path: ["flashcard","java","concurrency"], cardCount: 56, due: 7, mastered: 25 },
  { id: "flashcard/java/stream", name: "Java Stream", path: ["flashcard","java","stream"], cardCount: 31, due: 4, mastered: 19 },
  { id: "flashcard/java/gc", name: "Java GC", path: ["flashcard","java","gc"], cardCount: 19, due: 1, mastered: 11 },
  { id: "flashcard/k8s/core", name: "Kubernetes Core", path: ["flashcard","k8s","core"], cardCount: 48, due: 6, mastered: 20 },
  { id: "flashcard/k8s/networking", name: "K8s Networking", path: ["flashcard","k8s","networking"], cardCount: 22, due: 3, mastered: 8 },
  { id: "flashcard/db/mysql", name: "MySQL", path: ["flashcard","db","mysql"], cardCount: 38, due: 5, mastered: 17 },
  { id: "flashcard/db/redis", name: "Redis", path: ["flashcard","db","redis"], cardCount: 27, due: 2, mastered: 14 },
  { id: "flashcard/aws/core", name: "AWS Core", path: ["flashcard","aws","core"], cardCount: 44, due: 4, mastered: 21 },
  { id: "flashcard/aws/lambda", name: "AWS Lambda", path: ["flashcard","aws","lambda"], cardCount: 15, due: 1, mastered: 5 },
];

const MOCK_CARDS = [
  { id: "spring-tx-f1", deck: "flashcard/spring/core", tier: "foundation",
    question: "REQUIRES_NEW와 REQUIRED의 차이는?",
    answer: "`REQUIRED`는 기존 트랜잭션이 있으면 참여하고, 없으면 새로 생성한다.\n\n`REQUIRES_NEW`는 **항상 새 트랜잭션을 생성**하고 기존 트랜잭션을 일시 중단한다.\n\n```java\n@Transactional(propagation = Propagation.REQUIRES_NEW)\npublic void audit(String msg) {\n    // 외부 tx 실패해도 이 tx는 커밋됨\n}\n```" },
  { id: "spring-aop-m1", deck: "flashcard/spring/core", tier: "mechanism",
    question: "Spring AOP의 프록시 생성 방식 두 가지와 선택 기준은?",
    answer: "**JDK Dynamic Proxy**: 인터페이스 기반. `InvocationHandler` 사용.\n\n**CGLIB Proxy**: 클래스 상속 기반. 바이트코드 조작.\n\n선택 기준: 타겟이 인터페이스를 구현하면 JDK, 아니면 CGLIB. Spring Boot는 기본 CGLIB." },
  { id: "spring-bean-d1", deck: "flashcard/spring/core", tier: "diagnosis",
    question: "순환 참조(Circular Dependency) 에러 발생 시 해결 전략 3가지는?",
    answer: "1. **설계 리팩토링**: 의존 방향 정리 (가장 권장)\n2. `@Lazy` 어노테이션: 프록시로 지연 주입\n3. `ObjectProvider<T>`: 필요 시점에 조회\n\n⚠️ Spring Boot 2.6+부터 순환 참조 기본 금지" },
  { id: "jpa-nplusone-m1", deck: "flashcard/jpa/core", tier: "mechanism",
    question: "N+1 문제의 발생 원리와 해결 방법 3가지는?",
    answer: "**원리**: 컬렉션 연관 엔티티를 LAZY 로딩 시, 루프에서 개별 SELECT 발생.\n\n**해결**:\n1. `JOIN FETCH`: JPQL에서 한 방 쿼리\n2. `@EntityGraph`: 선언적 페치 전략\n3. `@BatchSize`: IN 절로 묶어서 조회\n\n```java\n@Query(\"SELECT o FROM Order o JOIN FETCH o.items\")\nList<Order> findAllWithItems();\n```" },
  { id: "java-volatile-f1", deck: "flashcard/java/concurrency", tier: "foundation",
    question: "volatile 키워드의 역할은?",
    answer: "**가시성 보장**: 변수를 메인 메모리에서 읽고 쓰도록 강제.\n\nCPU 캐시가 아닌 메인 메모리 직접 접근 → 모든 스레드가 최신 값을 봄.\n\n⚠️ 원자성은 보장하지 않음. `count++` 같은 복합 연산에는 `AtomicInteger` 사용." },
  { id: "k8s-probe-m1", deck: "flashcard/k8s/core", tier: "mechanism",
    question: "livenessProbe와 readinessProbe의 차이와 실패 시 동작은?",
    answer: "**livenessProbe**: 컨테이너 생존 확인.\n실패 → **컨테이너 재시작**\n\n**readinessProbe**: 트래픽 수신 준비 확인.\n실패 → **Service 엔드포인트에서 제거** (재시작 X)\n\n```yaml\nlivenessProbe:\n  httpGet:\n    path: /health\n    port: 8080\n  initialDelaySeconds: 30\n```" },
  { id: "redis-evict-f1", deck: "flashcard/db/redis", tier: "foundation",
    question: "Redis의 메모리 정책(eviction policy) 종류는?",
    answer: "• `noeviction`: 메모리 초과 시 에러 반환\n• `allkeys-lru`: 전체 키 중 LRU 제거\n• `volatile-lru`: TTL 설정된 키 중 LRU 제거\n• `allkeys-random`: 랜덤 제거\n• `volatile-ttl`: TTL 짧은 키 우선 제거\n\n기본값: `noeviction`" },
  { id: "mysql-index-d1", deck: "flashcard/db/mysql", tier: "diagnosis",
    question: "쿼리 실행 계획에서 type=ALL이 나왔을 때 튜닝 절차는?",
    answer: "1. `EXPLAIN`으로 풀스캔 확인\n2. WHERE 조건 컬럼에 인덱스 존재 여부 확인\n3. **복합 인덱스** 생성 (카디널리티 높은 컬럼 우선)\n4. 함수 적용(`DATE(col)`) → 인덱스 무효화 여부 체크\n5. `FORCE INDEX` 힌트로 인덱스 강제 후 성능 비교" },
];

const DECK_CARDS_PREVIEW = {
  "flashcard/spring/core": [
    { tier: "foundation", question: "REQUIRES_NEW와 REQUIRED의 차이는?", status: "mastered" },
    { tier: "foundation", question: "Spring Bean의 기본 스코프는?", status: "due" },
    { tier: "mechanism", question: "Spring AOP의 프록시 생성 방식 두 가지와 선택 기준은?", status: "learning" },
    { tier: "mechanism", question: "@Conditional 어노테이션의 동작 원리는?", status: "mastered" },
    { tier: "diagnosis", question: "순환 참조 에러 발생 시 해결 전략 3가지는?", status: "due" },
    { tier: "diagnosis", question: "BeanPostProcessor로 문제를 진단하는 방법은?", status: "new" },
  ],
};

const generateHeatmap = () => {
  const data = [];
  const today = new Date(2026, 3, 9);
  for (let i = 181; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const count = i < 3 ? Math.floor(Math.random() * 15) + 10 : Math.random() > 0.15 ? Math.floor(Math.random() * 25) : 0;
    data.push({ date: d, count });
  }
  return data;
};
const HEATMAP = generateHeatmap();

/* ═══════════════════════════════════════════════════════════════
   SYNTAX HIGHLIGHTING
   ═══════════════════════════════════════════════════════════════ */
const SYN = {
  keyword: "#ff7b72", type: "#79c0ff", string: "#a5d6ff",
  annotation: "#d2a8ff", comment: "#6e7681", number: "#79c0ff",
  property: "#7ee787", punctuation: "#b1bac4", plain: "#e6edf3",
  gutter: "#484f58",
};

const JAVA_KW = new Set(["abstract","assert","boolean","break","byte","case","catch","char","class","const","continue","default","do","double","else","enum","extends","final","finally","float","for","goto","if","implements","import","instanceof","int","interface","long","native","new","package","private","protected","public","return","short","static","strictfp","super","switch","synchronized","this","throw","throws","transient","try","var","void","volatile","while","true","false","null"]);
const SQL_KW = new Set(["SELECT","FROM","WHERE","JOIN","FETCH","LEFT","RIGHT","INNER","OUTER","ON","AND","OR","INSERT","UPDATE","DELETE","CREATE","DROP","ALTER","INDEX","TABLE","INTO","VALUES","ORDER","BY","GROUP","HAVING","LIMIT","OFFSET","AS","IN","NOT","IS","NULL","LIKE","DISTINCT","COUNT","SUM","AVG","MIN","MAX","EXPLAIN","FORCE","USE"]);

function tokenize(line, lang) {
  const t = [];
  const p = (text, color) => { if (text) t.push({ text, color }); };
  if (lang === "java" || lang === "kotlin") {
    let i = 0;
    while (i < line.length) {
      if (line[i] === '/' && line[i+1] === '/') { p(line.slice(i), SYN.comment); break; }
      if (line[i] === '@') { let j = i+1; while (j < line.length && /[\w.]/.test(line[j])) j++; p(line.slice(i,j), SYN.annotation); i = j; continue; }
      if (line[i] === '"') { let j = i+1; while (j < line.length && line[j] !== '"') { if (line[j] === '\\') j++; j++; } p(line.slice(i,j+1), SYN.string); i = j+1; continue; }
      if (/\d/.test(line[i]) && (i === 0 || /[\s(,=:<>+\-*/]/.test(line[i-1]))) { let j = i; while (j < line.length && /[\d.xXa-fA-FL]/.test(line[j])) j++; p(line.slice(i,j), SYN.number); i = j; continue; }
      if (/[a-zA-Z_$]/.test(line[i])) { let j = i; while (j < line.length && /[\w$]/.test(line[j])) j++; const w = line.slice(i,j); JAVA_KW.has(w) ? p(w, SYN.keyword) : (w[0] >= 'A' && w[0] <= 'Z') ? p(w, SYN.type) : p(w, SYN.plain); i = j; continue; }
      p(line[i], SYN.punctuation); i++;
    }
  } else if (lang === "yaml" || lang === "yml") {
    if (line.trimStart().startsWith('#')) { p(line, SYN.comment); return t; }
    const ci = line.indexOf(':');
    if (ci > 0 && !line.trimStart().startsWith('-')) {
      p(line.slice(0,ci), SYN.property); p(':', SYN.punctuation);
      const rest = line.slice(ci+1), trimmed = rest.trim();
      if (!trimmed) return t;
      if (/^\d+$/.test(trimmed)) { p(rest.replace(trimmed,''), SYN.plain); p(trimmed, SYN.number); }
      else if (trimmed.startsWith('"') || trimmed.startsWith("'") || trimmed.startsWith('/')) { p(rest.replace(trimmed,''), SYN.plain); p(trimmed, SYN.string); }
      else { p(rest, SYN.plain); }
    } else { p(line, SYN.plain); }
  } else if (lang === "sql" || lang === "jpql") {
    let i = 0;
    while (i < line.length) {
      if (line[i] === '-' && line[i+1] === '-') { p(line.slice(i), SYN.comment); break; }
      if (line[i] === '"' || line[i] === "'") { const q = line[i]; let j = i+1; while (j < line.length && line[j] !== q) j++; p(line.slice(i,j+1), SYN.string); i = j+1; continue; }
      if (/[a-zA-Z_]/.test(line[i])) { let j = i; while (j < line.length && /[\w.]/.test(line[j])) j++; const w = line.slice(i,j); SQL_KW.has(w.toUpperCase()) ? p(w, SYN.keyword) : p(w, SYN.plain); i = j; continue; }
      if (/\d/.test(line[i])) { let j = i; while (j < line.length && /\d/.test(line[j])) j++; p(line.slice(i,j), SYN.number); i = j; continue; }
      p(line[i], SYN.punctuation); i++;
    }
  } else { p(line, SYN.plain); }
  return t;
}

/* ═══════════════════════════════════════════════════════════════
   MARKDOWN RENDERER
   ═══════════════════════════════════════════════════════════════ */
const CodeBlock = ({ code, lang }) => {
  const lines = code.split('\n');
  const gw = String(lines.length).length * 10 + 16;
  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden my-3" style={{ fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" }}>
      {lang && (
        <div className="flex items-center px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/80">
          <span className="text-[11px] font-medium tracking-wider uppercase" style={{ color: SYN.gutter }}>{lang}</span>
        </div>
      )}
      <div className="overflow-x-auto py-2.5 bg-zinc-950/50" style={{ fontSize: 13, lineHeight: 1.7 }}>
        {lines.map((line, i) => (
          <div key={i} className="flex" style={{ minHeight: 23 }}>
            <span className="select-none shrink-0 text-right pr-3" style={{ minWidth: gw, color: SYN.gutter, fontSize: 12 }}>{i + 1}</span>
            <span className="pr-4 whitespace-pre">
              {tokenize(line, lang).map((tok, j) => <span key={j} style={{ color: tok.color }}>{tok.text}</span>)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

function renderMd(text) {
  const blocks = [];
  const re = /```(\w*)\n([\s\S]*?)```/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) blocks.push({ type: "t", content: text.slice(last, m.index) });
    blocks.push({ type: "c", lang: m[1] || "", content: m[2].replace(/\n$/, "") });
    last = m.index + m[0].length;
  }
  if (last < text.length) blocks.push({ type: "t", content: text.slice(last) });

  const renderInline = (str) => {
    const parts = [];
    const rx = /(\*\*[^*]+\*\*)|(`[^`]+`)/g;
    let l = 0, x;
    while ((x = rx.exec(str)) !== null) {
      if (x.index > l) parts.push(<span key={`t${l}`}>{str.slice(l, x.index)}</span>);
      if (x[1]) parts.push(<strong key={`b${x.index}`} className="text-zinc-100 font-semibold">{x[1].slice(2,-2)}</strong>);
      if (x[2]) parts.push(<code key={`c${x.index}`} className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded text-[13px] font-mono">{x[2].slice(1,-1)}</code>);
      l = x.index + x[0].length;
    }
    if (l < str.length) parts.push(<span key={`t${l}`}>{str.slice(l)}</span>);
    return parts;
  };

  return blocks.map((b, bi) => {
    if (b.type === "c") return <CodeBlock key={bi} code={b.content} lang={b.lang} />;
    return b.content.split(/\n\n+/).filter(Boolean).map((para, pi) => (
      <div key={`${bi}-${pi}`} className="mb-2 text-[14px] text-zinc-400 leading-relaxed">
        {para.split('\n').map((line, li) => <div key={li}>{renderInline(line)}</div>)}
      </div>
    ));
  });
}

/* ═══════════════════════════════════════════════════════════════
   CSS
   ═══════════════════════════════════════════════════════════════ */
const STYLE_ID = "hachimon-v1";
const injectCSS = () => {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style"); s.id = STYLE_ID;
  s.textContent = `
    :root {
      --background: 240 10% 3.9%;
      --foreground: 0 0% 98%;
      --card: 240 10% 5.5%;
      --card-foreground: 0 0% 98%;
      --popover: 240 10% 3.9%;
      --popover-foreground: 0 0% 98%;
      --primary: 0 0% 98%;
      --primary-foreground: 240 5.9% 10%;
      --secondary: 240 3.7% 15.9%;
      --secondary-foreground: 0 0% 98%;
      --muted: 240 3.7% 15.9%;
      --muted-foreground: 240 5% 64.9%;
      --accent: 240 3.7% 15.9%;
      --accent-foreground: 0 0% 98%;
      --destructive: 0 62.8% 30.6%;
      --destructive-foreground: 0 0% 98%;
      --border: 240 3.7% 15.9%;
      --input: 240 3.7% 15.9%;
      --ring: 217.2 91.2% 59.8%;
      --radius: 0.75rem;
    }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    @keyframes fg-slide { from { opacity:0; transform:translateX(14px) } to { opacity:1; transform:translateX(0) } }
    @keyframes fg-up    { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
    @keyframes fg-flip  { from { opacity:0; transform:perspective(600px) rotateX(-4deg) translateY(4px) } to { opacity:1; transform:perspective(600px) rotateX(0) translateY(0) } }
    @keyframes fg-scale { from { opacity:0; transform:scale(0.97) } to { opacity:1; transform:scale(1) } }
    @keyframes fg-pulse { 0%,100% { opacity:0.35 } 50% { opacity:0.7 } }
    @keyframes fg-press { 0% { transform:scale(1) } 50% { transform:scale(0.96) } 100% { transform:scale(1) } }
    .fg-slide  { animation: fg-slide .22s cubic-bezier(.22,1,.36,1) both }
    .fg-up     { animation: fg-up .24s cubic-bezier(.22,1,.36,1) both }
    .fg-flip   { animation: fg-flip .24s cubic-bezier(.22,1,.36,1) both }
    .fg-scale  { animation: fg-scale .28s cubic-bezier(.22,1,.36,1) both }
    .fg-pulse  { animation: fg-pulse 2.5s ease-in-out infinite }
    .fg-press  { animation: fg-press .12s ease }
    input[type=range] { -webkit-appearance:none; appearance:none; height:4px; border-radius:2px; background:#27272a; outline:none; width:100% }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:20px; height:20px; border-radius:50%; background:#fafafa; cursor:pointer; border:2px solid #09090b; box-shadow:0 0 0 3px rgba(250,250,250,.08) }
  `;
  document.head.appendChild(s);
};

/* ═══════════════════════════════════════════════════════════════
   SHARED — Section label + Tier badge + Stat row
   ═══════════════════════════════════════════════════════════════ */
const SectionLabel = ({ children }) => (
  <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">{children}</p>
);

const tierCfg = {
  foundation: { label: "F", full: "Foundation", fg: "text-blue-400", bg: "bg-blue-500/15" },
  mechanism:  { label: "M", full: "Mechanism",  fg: "text-amber-400", bg: "bg-amber-500/15" },
  diagnosis:  { label: "D", full: "Diagnosis",  fg: "text-red-400", bg: "bg-red-500/15" },
};

const TierBadge = ({ tier, full = false }) => {
  const c = tierCfg[tier];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${c.fg} ${c.bg}`}>{full ? c.full : c.label}</span>;
};

const StatRow = ({ items }) => (
  <Card>
    <CardContent className="p-4">
      <div className="grid divide-x divide-zinc-800" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((s, i) => (
          <div key={i} className="text-center px-2">
            <div className={`text-xl font-bold tabular-nums leading-tight ${s.color || "text-zinc-100"} flex items-center justify-center gap-1`}>
              {s.icon}{s.value}
            </div>
            <div className="text-[11px] text-zinc-500 mt-1.5">{s.label}</div>
            {s.sub && <div className="text-[11px] text-zinc-600">{s.sub}</div>}
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

const ProgressBar = ({ value, max, color, h = "h-1" }) => (
  <div className={`w-full ${h} bg-zinc-800 rounded-full overflow-hidden`}>
    <div className={`${h} rounded-full transition-all duration-500`} style={{ width: `${Math.min((value / max) * 100, 100)}%`, background: color }} />
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   HOME
   ═══════════════════════════════════════════════════════════════ */
const HomeTab = ({ onReview, onInterview }) => {
  const due = 23, streak = 47, total = 1235, newCards = 8;
  const goal = 30, doneToday = 12;
  const goalPct = Math.round((doneToday / goal) * 100);

  const topDueDecks = useMemo(
    () => [...DECKS].sort((a, b) => b.due - a.due).slice(0, 3),
    []
  );

  const leeches = [
    { tier: "diagnosis", question: "순환 참조 에러 발생 시 해결 전략 3가지는?", fails: 5, deck: "Spring Core" },
    { tier: "mechanism", question: "N+1 문제의 발생 원리와 해결 방법 3가지는?", fails: 4, deck: "JPA Core" },
    { tier: "diagnosis", question: "쿼리 실행 계획에서 type=ALL이 나왔을 때 튜닝 절차는?", fails: 4, deck: "MySQL" },
  ];

  return (
    <div className="px-4 pt-2 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between py-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-50">Hachimon</h1>
          <p className="text-[13px] text-zinc-500 mt-0.5">4월 9일 수요일</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
          <span className="text-sm font-bold text-white">J</span>
        </div>
      </div>

      {/* Stats */}
      <StatRow items={[
        { label: "오늘 복습", value: due, color: "text-blue-400" },
        { label: "연속일", value: streak, color: "text-amber-400", icon: <Flame className="w-4 h-4" /> },
        { label: "전체 카드", value: total.toLocaleString() },
      ]} />

      {/* Today's goal */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              <span className="text-[13px] font-semibold text-zinc-200">오늘의 목표</span>
            </div>
            <span className="text-[12px] tabular-nums text-zinc-500">
              <span className="text-zinc-100 font-bold">{doneToday}</span>
              <span className="text-zinc-600"> / {goal}장</span>
            </span>
          </div>
          <ProgressBar value={doneToday} max={goal} color="#60a5fa" h="h-2" />
          <p className="text-[11px] text-zinc-600 mt-2">
            {goal - doneToday > 0 ? `${goal - doneToday}장 더 복습하면 목표 달성` : "🎉 오늘 목표 달성!"}
          </p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="space-y-2">
        <Button className="w-full h-12 text-[15px] font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl" onClick={onReview}>
          오늘의 복습 시작 · {due}장
        </Button>
        <Button variant="outline" className="w-full h-11 text-[14px] font-semibold rounded-xl" onClick={onInterview}>
          면접 훈련 모드
        </Button>
      </div>

      {/* New cards */}
      {newCards > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-500/8 border border-violet-500/15 min-h-[52px]">
          <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
          <div>
            <p className="text-[13px] font-semibold text-violet-400">새 카드 {newCards}장</p>
            <p className="text-[12px] text-zinc-500 mt-0.5">Spring Security에서 추가됨</p>
          </div>
        </div>
      )}

      {/* Due Top 3 decks */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 pt-4 pb-2">
            <SectionLabel>Due 많은 덱</SectionLabel>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {topDueDecks.map((d) => (
              <button
                key={d.id}
                className="w-full flex items-center justify-between px-4 min-h-[48px] hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Folder className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-[13px] text-zinc-200 truncate">{d.name}</span>
                  <span className="text-[11px] text-zinc-600 shrink-0">{d.cardCount}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-0 text-[11px] font-semibold tabular-nums">
                    {d.due} due
                  </Badge>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-700" />
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Leech cards */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-red-400" />
              <SectionLabel>약한 카드</SectionLabel>
            </div>
            <span className="text-[10px] text-zinc-600">3회+ 오답</span>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {leeches.map((c, i) => (
              <button
                key={i}
                className="w-full flex items-center gap-2.5 px-4 py-3 min-h-[56px] text-left hover:bg-zinc-800/30 transition-colors"
              >
                <TierBadge tier={c.tier} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-zinc-200 truncate">{c.question}</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5 truncate">{c.deck}</p>
                </div>
                <span className="text-[11px] font-bold text-red-400 shrink-0 tabular-nums">×{c.fails}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   DECK DETAIL SHEET
   ═══════════════════════════════════════════════════════════════ */
const DeckDetail = ({ deck, onClose }) => {
  const cards = DECK_CARDS_PREVIEW[deck.id] || [];
  const sc = { mastered: "text-emerald-400", due: "text-amber-400", learning: "text-blue-400", new: "text-violet-400" };
  const sl = { mastered: "마스터", due: "복습 예정", learning: "학습 중", new: "신규" };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fg-up relative bg-zinc-950 rounded-t-2xl max-h-[75vh] overflow-auto">
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mt-3" />
        <div className="px-4 pt-4 pb-8 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-zinc-50">{deck.name}</h3>
              <p className="text-[13px] text-zinc-500 mt-0.5">{deck.path.join(" / ")}</p>
            </div>
            <button onClick={onClose} className="p-2 -mr-2 text-zinc-600 hover:text-zinc-400 transition-colors rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <StatRow items={[
            { label: "전체", value: deck.cardCount },
            { label: "Due", value: deck.due, color: "text-amber-400" },
            { label: "마스터", value: deck.mastered, color: "text-emerald-400" },
          ]} />

          <div>
            <ProgressBar value={deck.mastered} max={deck.cardCount} color="#34d399" />
            <p className="text-[11px] text-zinc-600 text-right mt-1.5">{Math.round(deck.mastered / deck.cardCount * 100)}% 마스터</p>
          </div>

          {cards.length > 0 && (
            <div>
              <SectionLabel>카드 미리보기</SectionLabel>
              <div className="divide-y divide-zinc-800/60">
                {cards.map((c, i) => (
                  <div key={i} className="flex items-center gap-2.5 py-3 min-h-[44px]">
                    <TierBadge tier={c.tier} />
                    <span className="flex-1 text-[13px] text-zinc-300 truncate">{c.question}</span>
                    <span className={`text-[11px] font-medium shrink-0 ${sc[c.status]}`}>{sl[c.status]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   DECKS
   ═══════════════════════════════════════════════════════════════ */
const DecksTab = () => {
  const [exp, setExp] = useState({ spring: true, jpa: false, java: false, k8s: false, db: false, aws: false });
  const [sel, setSel] = useState(null);
  const tree = useMemo(() => { const t = {}; DECKS.forEach(d => { const [,g] = d.path; if (!t[g]) t[g] = []; t[g].push(d); }); return t; }, []);
  const gDue = g => tree[g].reduce((s, d) => s + d.due, 0);
  const gCnt = g => tree[g].reduce((s, d) => s + d.cardCount, 0);

  return (
    <div className="px-4 pt-2 pb-24">
      <div className="py-2 mb-4">
        <h1 className="text-xl font-bold text-zinc-50">Decks</h1>
        <p className="text-[13px] text-zinc-500 mt-0.5">{Object.keys(tree).length}개 그룹 · {DECKS.length}개 덱 · 1,235장</p>
      </div>

      <div className="space-y-2">
        {Object.entries(tree).map(([g, decks]) => {
          const open = exp[g];
          return (
            <div key={g} className="rounded-xl border border-zinc-800 overflow-hidden">
              {/* Group header */}
              <button
                onClick={() => setExp(p => ({ ...p, [g]: !p[g] }))}
                className="w-full flex items-center justify-between px-4 min-h-[48px] bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <ChevronDown className={`w-4 h-4 text-zinc-600 transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
                  <Folder className="w-4 h-4 text-blue-400" />
                  <span className="text-[14px] font-semibold text-zinc-200 capitalize">{g}</span>
                  <span className="text-[12px] text-zinc-600">{gCnt(g)}</span>
                </div>
                {gDue(g) > 0 && (
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-0 text-[11px] font-semibold">
                    {gDue(g)} due
                  </Badge>
                )}
              </button>

              {/* Deck items */}
              {open && (
                <div className="divide-y divide-zinc-800/50">
                  {decks.map(d => (
                    <button
                      key={d.id}
                      onClick={() => setSel(d)}
                      className="w-full flex items-center justify-between pl-12 pr-4 min-h-[44px] hover:bg-zinc-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-zinc-600" />
                        <span className="text-[14px] text-zinc-300">{d.name}</span>
                        <span className="text-[12px] text-zinc-600">{d.cardCount}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {d.due > 0 && <span className="text-[12px] font-semibold text-amber-400">{d.due}</span>}
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-700" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {sel && <DeckDetail deck={sel} onClose={() => setSel(null)} />}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   STATS
   ═══════════════════════════════════════════════════════════════ */
const StatsTab = () => {
  const daily = [12,18,22,15,20,25,19,23,17,21,24,16,20,28,14,22,26,18,15,23,27,20,22,25,19,21,24,17,23,20];
  const maxD = Math.max(...daily);
  const hc = c => c === 0 ? "#27272a" : c <= 5 ? "#0e4429" : c <= 10 ? "#006d32" : c <= 15 ? "#26a641" : "#39d353";
  // 최근 20주 (140일) 만 표시 — 모바일 폭에 딱 맞게
  const HEAT_WEEKS = 20;
  const heatDays = HEATMAP.slice(-HEAT_WEEKS * 7);

  return (
    <div className="px-4 pt-2 pb-24 space-y-4">
      <div className="py-2">
        <h1 className="text-xl font-bold text-zinc-50">Statistics</h1>
      </div>

      {/* Summary */}
      <StatRow items={[
        { label: "총 복습", value: "4,287", color: "text-blue-400" },
        { label: "마스터", value: "312", sub: "EF ≥ 2.5", color: "text-emerald-400" },
        { label: "평균 정답률", value: "74%", color: "text-amber-400" },
      ]} />

      {/* Heatmap */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>복습 히트맵</SectionLabel>
            <span className="text-[10px] text-zinc-600 -translate-y-1">최근 {HEAT_WEEKS}주</span>
          </div>
          <div
            className="grid gap-[3px]"
            style={{
              gridTemplateColumns: `repeat(${HEAT_WEEKS}, minmax(0, 1fr))`,
              gridTemplateRows: "repeat(7, auto)",
              gridAutoFlow: "column",
            }}
          >
            {heatDays.map((d, i) => (
              <div
                key={i}
                className="rounded-[2px] aspect-square w-full"
                style={{ background: hc(d.count) }}
                title={`${d.date.toLocaleDateString()} — ${d.count}장`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1 mt-3 justify-end">
            <span className="text-[11px] text-zinc-600">Less</span>
            {["#27272a","#0e4429","#006d32","#26a641","#39d353"].map((c,i) => (
              <div key={i} className="rounded-[2px] shrink-0" style={{ width: 10, height: 10, background: c }} />
            ))}
            <span className="text-[11px] text-zinc-600">More</span>
          </div>
        </CardContent>
      </Card>

      {/* Daily chart */}
      <Card>
        <CardContent className="p-4">
          <SectionLabel>일별 복습량 (30일)</SectionLabel>
          <div className="flex items-end gap-[2px] h-16">
            {daily.map((v, i) => (
              <div key={i} className="flex-1 rounded-sm transition-all" style={{
                height: `${(v / maxD) * 100}%`,
                background: i === daily.length - 1 ? "#60a5fa" : "rgba(96,165,250,0.18)",
                minWidth: 3,
              }} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tier trend */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <SectionLabel>티어별 정답률 추이</SectionLabel>
          {[
            { t: "foundation", v: [88,90,92,95], color: "#60a5fa" },
            { t: "mechanism", v: [65,70,74,78], color: "#fbbf24" },
            { t: "diagnosis", v: [30,35,38,42], color: "#f87171" },
          ].map(({ t, v, color }) => (
            <div key={t}>
              <div className="flex items-center justify-between mb-2">
                <TierBadge tier={t} full />
                <div className="flex items-center gap-2">
                  {v.map((x, i) => (
                    <span key={i} className="text-[11px] tabular-nums" style={{
                      color: i === v.length - 1 ? color : "#52525b",
                      fontWeight: i === v.length - 1 ? 700 : 400,
                    }}>
                      {i === 0 && "W1 "}{x}%
                    </span>
                  ))}
                </div>
              </div>
              <ProgressBar value={v[v.length - 1]} max={100} color={color} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   SETTINGS
   ═══════════════════════════════════════════════════════════════ */
const SettingsTab = () => {
  const [s, setS] = useState({ dailyNew: 10, dailyReview: 50, sessionSize: 15, initEF: 2.5, minEF: 1.3 });
  const [confirm, setConfirm] = useState(false);
  const u = (k, v) => setS(p => ({ ...p, [k]: v }));

  const Slider = ({ label, value, min, max, step = 1, unit = "", k }) => (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[14px] text-zinc-300">{label}</span>
        <span className="text-[14px] font-bold text-blue-400 tabular-nums">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => u(k, parseFloat(e.target.value))} />
      <div className="flex justify-between mt-1">
        <span className="text-[11px] text-zinc-600">{min}{unit}</span>
        <span className="text-[11px] text-zinc-600">{max}{unit}</span>
      </div>
    </div>
  );

  return (
    <div className="px-4 pt-2 pb-24 space-y-4">
      <div className="py-2">
        <h1 className="text-xl font-bold text-zinc-50">Settings</h1>
      </div>

      {/* Session */}
      <div>
        <SectionLabel>세션 설정</SectionLabel>
        <Card><CardContent className="p-4 divide-y divide-zinc-800/50">
          <Slider label="일일 신규 카드" value={s.dailyNew} min={5} max={30} unit="장" k="dailyNew" />
          <Slider label="일일 복습 상한" value={s.dailyReview} min={20} max={100} unit="장" k="dailyReview" />
          <Slider label="세션당 카드 수" value={s.sessionSize} min={5} max={30} unit="장" k="sessionSize" />
        </CardContent></Card>
      </div>

      {/* SM-2 */}
      <div>
        <SectionLabel>SM-2 파라미터</SectionLabel>
        <Card><CardContent className="p-4 divide-y divide-zinc-800/50">
          <Slider label="초기 Ease Factor" value={s.initEF} min={1.3} max={3.0} step={0.1} k="initEF" />
          <Slider label="최소 Ease Factor" value={s.minEF} min={1.0} max={2.0} step={0.1} k="minEF" />
        </CardContent></Card>
      </div>

      {/* Presets */}
      <div>
        <SectionLabel>면접 훈련 프리셋</SectionLabel>
        <Card><CardContent className="p-2">
          {[
            { n: "D-7: 전 범위 복습", d: "모든 티어, 15장", a: false },
            { n: "D-3: 심화 집중", d: "Mechanism + Diagnosis, 20장", a: true },
            { n: "D-1: 최종 점검", d: "Diagnosis only, 10장", a: false },
          ].map((p, i) => (
            <div key={i} className={`flex items-center justify-between rounded-lg px-3 min-h-[48px] cursor-pointer transition-colors ${p.a ? "bg-blue-500/10" : "hover:bg-zinc-800/50"}`}>
              <div className="py-2">
                <p className={`text-[14px] font-medium ${p.a ? "text-blue-400" : "text-zinc-300"}`}>{p.n}</p>
                <p className="text-[12px] text-zinc-500 mt-0.5">{p.d}</p>
              </div>
              {p.a && <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />}
            </div>
          ))}
        </CardContent></Card>
      </div>

      {/* Data */}
      <div>
        <SectionLabel>데이터</SectionLabel>
        <Card><CardContent className="p-2">
          <button className="w-full text-left px-3 min-h-[44px] flex items-center rounded-lg text-[14px] text-zinc-300 hover:bg-zinc-800/50 transition-colors">cards.json 수동 갱신</button>
          <button className="w-full text-left px-3 min-h-[44px] flex items-center rounded-lg text-[14px] text-zinc-300 hover:bg-zinc-800/50 transition-colors">복습 기록 내보내기 (JSON)</button>
          <button onClick={() => setConfirm(true)} className="w-full text-left px-3 min-h-[44px] flex items-center rounded-lg text-[14px] text-red-400 hover:bg-red-500/10 transition-colors">모든 학습 데이터 초기화</button>
        </CardContent></Card>
      </div>

      {/* Confirm */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirm(false)} />
          <div className="fg-scale relative bg-zinc-900 border border-zinc-800 rounded-2xl p-5 max-w-[320px] w-full">
            <div className="flex items-center gap-2.5 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <h3 className="text-[15px] font-bold text-zinc-100">데이터 초기화</h3>
            </div>
            <p className="text-[14px] text-zinc-400 leading-relaxed mb-5">모든 SM-2 스케줄, 복습 기록, 설정이 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-11" onClick={() => setConfirm(false)}>취소</Button>
              <Button variant="destructive" className="flex-1 h-11" onClick={() => setConfirm(false)}>초기화</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   INTERVIEW FILTER
   ═══════════════════════════════════════════════════════════════ */
const InterviewFilter = ({ onBack, onStart }) => {
  const [decks, setDecks] = useState(new Set(["flashcard/spring/core", "flashcard/spring/batch"]));
  const [tiers, setTiers] = useState(new Set(["mechanism", "diagnosis"]));
  const [size, setSize] = useState(20);
  const td = id => setDecks(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const tt = t => setTiers(p => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; });
  const tree = {}; DECKS.forEach(d => { const [, g] = d.path; if (!tree[g]) tree[g] = []; tree[g].push(d); });
  const ok = decks.size > 0 && tiers.size > 0;

  return (
    <div className="pb-28">
      {/* Nav header — same px-4 as pages */}
      <div className="flex items-center gap-2 px-4 h-12">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-zinc-50">면접 훈련</h2>
      </div>

      <div className="px-4 space-y-5 mt-2">
        {/* Tier */}
        <div>
          <SectionLabel>티어 선택</SectionLabel>
          <div className="flex gap-2">
            {["foundation", "mechanism", "diagnosis"].map(t => {
              const on = tiers.has(t);
              const c = tierCfg[t];
              return (
                <button key={t} onClick={() => tt(t)} className={`flex-1 min-h-[44px] rounded-xl text-[13px] font-semibold border transition-all ${on ? `${c.bg} ${c.fg} border-transparent` : "border-zinc-800 text-zinc-600 hover:border-zinc-700"}`}>
                  {c.full}
                </button>
              );
            })}
          </div>
        </div>

        {/* Size */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>세션 크기</SectionLabel>
            <span className="text-[14px] font-bold text-blue-400 tabular-nums -mt-1">{size}장</span>
          </div>
          <input type="range" min={5} max={30} value={size} onChange={e => setSize(+e.target.value)} />
        </div>

        {/* Decks */}
        <div>
          <SectionLabel>덱 선택 ({decks.size})</SectionLabel>
          <div className="space-y-4">
            {Object.entries(tree).map(([g, ds]) => (
              <div key={g}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-600 mb-2">{g}</p>
                <div className="space-y-1.5">
                  {ds.map(d => {
                    const on = decks.has(d.id);
                    return (
                      <button key={d.id} onClick={() => td(d.id)} className={`w-full flex items-center justify-between px-3 min-h-[44px] rounded-xl border transition-all ${on ? "bg-blue-500/10 border-blue-500/20" : "border-zinc-800 hover:border-zinc-700"}`}>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-all ${on ? "bg-blue-500 border-blue-500" : "border-zinc-600"}`}>
                            {on && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><polyline points="20 6 9 17 4 12" /></svg>}
                          </div>
                          <span className={`text-[14px] ${on ? "text-blue-400 font-medium" : "text-zinc-300"}`}>{d.name}</span>
                        </div>
                        <span className="text-[12px] text-zinc-600">{d.cardCount}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky bottom — matches page px */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] px-4 pt-3 pb-8 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800/50">
        <Button className={`w-full h-12 text-[15px] font-bold rounded-xl ${ok ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`} disabled={!ok} onClick={onStart}>
          세션 시작 · {size}장
        </Button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   REVIEW SESSION
   ═══════════════════════════════════════════════════════════════ */
const ReviewSession = ({ onBack, onComplete }) => {
  const [idx, setIdx] = useState(0);
  const [flip, setFlip] = useState(false);
  const [res, setRes] = useState([]);
  const [anim, setAnim] = useState(0);
  const [pressed, setPressed] = useState(null);
  const cards = MOCK_CARDS.slice(0, 6);
  const cur = cards[idx];

  const rate = (q) => {
    setPressed(q);
    setTimeout(() => {
      const nr = [...res, { card: cur, quality: q }];
      setRes(nr);
      if (idx < cards.length - 1) { setIdx(idx + 1); setFlip(false); setAnim(a => a + 1); setPressed(null); }
      else onComplete(nr);
    }, 150);
  };

  const ratingBtns = [
    { label: "Again", sub: "<1m", q: 0, color: "#f87171" },
    { label: "Hard", sub: "6m", q: 2, color: "#fbbf24" },
    { label: "Good", sub: "10m", q: 4, color: "#34d399" },
    { label: "Easy", sub: "4d", q: 5, color: "#60a5fa" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header — consistent px-4 */}
      <div className="flex items-center gap-2 px-4 h-12">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[13px] text-zinc-500">{cur.deck.split("/").pop()}</span>
            <TierBadge tier={cur.tier} />
          </div>
          <ProgressBar value={idx + 1} max={cards.length} color="#60a5fa" />
        </div>
        <span className="text-[14px] font-semibold text-zinc-500 tabular-nums ml-2">{idx + 1}/{cards.length}</span>
      </div>

      {/* Card */}
      <div key={anim} className={`fg-slide flex-1 flex flex-col px-4 mt-2 ${flip ? "justify-start overflow-auto pb-28" : "justify-center"}`}>
        <Card className={`${flip ? "" : "cursor-pointer hover:border-zinc-700"} transition-colors`} onClick={() => !flip && setFlip(true)}>
          <CardContent className="p-4">
            <p className={`text-[16px] font-semibold text-zinc-100 leading-relaxed ${flip ? "text-left" : "text-center py-4"}`}>
              {cur.question}
            </p>

            {!flip && (
              <div className="fg-pulse flex items-center justify-center gap-2 mt-4 text-zinc-600">
                <ChevronRight className="w-4 h-4" />
                <span className="text-[13px]">탭하여 답변 보기</span>
              </div>
            )}

            {flip && (
              <div className="fg-flip">
                <Separator className="my-4" />
                {renderMd(cur.answer)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rating buttons — same px-4 */}
      {flip && (
        <div className="fg-up fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] px-4 pb-6 pt-3 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent">
          <div className="flex gap-2">
            {ratingBtns.map(({ label, sub, q, color }) => (
              <button
                key={q}
                onClick={() => rate(q)}
                className={`${pressed === q ? "fg-press" : ""} flex-1 flex flex-col items-center gap-0.5 min-h-[52px] justify-center rounded-xl border border-zinc-800 transition-all bg-zinc-900/90 backdrop-blur-sm`}
                style={pressed === q ? { borderColor: color, background: `${color}15` } : {}}
              >
                <span className="text-[13px] font-bold" style={{ color }}>{label}</span>
                <span className="text-[11px] text-zinc-600">{sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   SESSION COMPLETE
   ═══════════════════════════════════════════════════════════════ */
const SessionComplete = ({ results, onHome, onRetry }) => {
  const tot = results.length;
  const cor = results.filter(r => r.quality >= 4).length;
  const acc = Math.round((cor / tot) * 100);
  const wrong = results.filter(r => r.quality < 4);
  const tr = {};
  results.forEach(r => { if (!tr[r.card.tier]) tr[r.card.tier] = { t: 0, c: 0 }; tr[r.card.tier].t++; if (r.quality >= 4) tr[r.card.tier].c++; });
  const radius = 52, circ = 2 * Math.PI * radius, off = circ - (acc / 100) * circ;
  const rc = acc >= 80 ? "#34d399" : acc >= 50 ? "#fbbf24" : "#f87171";

  return (
    <div className="fg-scale px-4 pt-8 pb-24 text-center space-y-4">
      {/* Score ring */}
      <div className="relative w-36 h-36 mx-auto">
        <svg width="144" height="144" viewBox="0 0 144 144" className="block">
          <circle cx="72" cy="72" r={radius} fill="none" stroke="#27272a" strokeWidth="6" />
          <circle cx="72" cy="72" r={radius} fill="none" stroke={rc} strokeWidth="6" strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" transform="rotate(-90 72 72)" style={{ transition: "stroke-dashoffset .8s cubic-bezier(.22,1,.36,1)" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-extrabold tabular-nums" style={{ color: rc }}>{acc}%</span>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-zinc-50">세션 완료!</h2>
        <p className="text-[14px] text-zinc-500 mt-1">{tot}장 · 3:42 소요</p>
      </div>

      {/* Tier results */}
      <Card className="text-left">
        <CardContent className="p-4 space-y-3">
          <SectionLabel>티어별 결과</SectionLabel>
          {Object.entries(tr).map(([tier, { t, c }]) => {
            const p = Math.round((c / t) * 100);
            const color = p >= 80 ? "#34d399" : p >= 50 ? "#fbbf24" : "#f87171";
            const tc = p >= 80 ? "text-emerald-400" : p >= 50 ? "text-amber-400" : "text-red-400";
            return (
              <div key={tier}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <TierBadge tier={tier} full />
                    <span className="text-[12px] text-zinc-600">{c}/{t}</span>
                  </div>
                  <span className={`text-[14px] font-bold tabular-nums ${tc}`}>{p}%</span>
                </div>
                <ProgressBar value={c} max={t} color={color} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Wrong cards */}
      {wrong.length > 0 && (
        <Card className="text-left">
          <CardContent className="p-4">
            <SectionLabel><span className="text-red-400">틀린 카드 ({wrong.length})</span></SectionLabel>
            <div className="divide-y divide-zinc-800/60">
              {wrong.map((r, i) => (
                <div key={i} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <TierBadge tier={r.card.tier} />
                    <span className="text-[12px] text-zinc-600">{r.quality === 0 ? "Again" : "Hard"}</span>
                  </div>
                  <p className="text-[14px] text-zinc-300">{r.card.question}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-2">
        {wrong.length > 0 && (
          <Button variant="destructive" className="w-full h-12 font-semibold rounded-xl text-[14px]" onClick={onRetry}>
            <RotateCcw className="w-4 h-4 mr-2" />
            틀린 카드만 재복습 · {wrong.length}장
          </Button>
        )}
        <Button variant="outline" className="w-full h-11 font-semibold rounded-xl text-[14px]" onClick={onHome}>
          홈으로
        </Button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════ */
export default function ForgeApp() {
  const [tab, setTab] = useState("home");
  const [screen, setScreen] = useState("tabs");
  const [results, setResults] = useState([]);
  useEffect(() => { injectCSS(); }, []);

  const go = {
    review: () => setScreen("review"),
    interview: () => setScreen("interview"),
    session: () => setScreen("review"),
    complete: r => { setResults(r); setScreen("complete"); },
    home: () => { setScreen("tabs"); setTab("home"); },
    retry: () => setScreen("review"),
  };

  const navItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "decks", label: "Decks", icon: Monitor },
    { id: "stats", label: "Stats", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="max-w-[393px] mx-auto min-h-screen bg-zinc-950 text-zinc-50 relative overflow-hidden" style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',sans-serif" }}>
      {/* Status bar */}
      <div className="h-11 flex items-center justify-between px-4 bg-zinc-950">
        <span className="text-[14px] font-semibold text-zinc-50">9:41</span>
        <div className="flex items-center gap-1.5">
          <svg width="16" height="12" viewBox="0 0 16 12" fill="#fafafa"><rect x="0" y="8" width="3" height="4" rx=".5" /><rect x="4.5" y="5" width="3" height="7" rx=".5" /><rect x="9" y="2" width="3" height="10" rx=".5" /><rect x="13.5" y="0" width="3" height="12" rx=".5" opacity=".3" /></svg>
          <svg width="24" height="12" viewBox="0 0 24 12" fill="none"><rect x=".5" y=".5" width="21" height="11" rx="2" stroke="#fafafa" strokeOpacity=".35" /><rect x="2" y="2" width="16" height="8" rx="1" fill="#34d399" /><path d="M23 4v4" stroke="#fafafa" strokeOpacity=".4" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto" style={{ height: "calc(100vh - 44px)" }}>
        {screen === "tabs" && tab === "home" && <HomeTab onReview={go.review} onInterview={go.interview} />}
        {screen === "tabs" && tab === "decks" && <DecksTab />}
        {screen === "tabs" && tab === "stats" && <StatsTab />}
        {screen === "tabs" && tab === "settings" && <SettingsTab />}
        {screen === "interview" && <InterviewFilter onBack={go.home} onStart={go.session} />}
        {screen === "review" && <ReviewSession onBack={go.home} onComplete={go.complete} />}
        {screen === "complete" && <SessionComplete results={results} onHome={go.home} onRetry={go.retry} />}
      </div>

      {/* Tab bar — 48px content + 34px safe area = 82px */}
      {screen === "tabs" && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] bg-zinc-900/90 backdrop-blur-xl border-t border-zinc-800/50">
          <div className="flex justify-around h-12">
            {navItems.map(item => {
              const on = tab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  aria-label={item.label}
                  className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[48px] transition-colors ${on ? "text-blue-400" : "text-zinc-600 hover:text-zinc-400"}`}
                >
                  <Icon className="w-5 h-5" strokeWidth={on ? 2 : 1.5} />
                  <span className={`text-[10px] ${on ? "font-semibold" : "font-normal"}`}>{item.label}</span>
                </button>
              );
            })}
          </div>
          {/* Home indicator safe area */}
          <div className="h-[34px]" />
        </div>
      )}
    </div>
  );
}
