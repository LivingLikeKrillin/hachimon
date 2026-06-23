interface ScreenContainerProps {
  children: React.ReactNode;
  /** 컨테이너 내부 레이아웃 클래스 (패딩/flex 등) */
  className?: string;
}

/** 모바일 화면 공통 컨테이너 — max-w-[393px] 중앙 정렬 + safe area */
export default function ScreenContainer({ children, className = '' }: ScreenContainerProps) {
  return (
    <div className={`w-full max-w-[393px] mx-auto min-h-svh pt-safe ${className}`}>
      {children}
    </div>
  );
}
