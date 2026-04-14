interface ProgressBarProps {
  value: number;
  max: number;
  color: string;
  h?: string;
}

export default function ProgressBar({ value, max, color, h = 'h-1' }: ProgressBarProps) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className={`w-full ${h} bg-zinc-800/60 rounded-full overflow-hidden`}>
      <div
        className={`${h} rounded-full transition-all duration-700 ease-out relative`}
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}, ${color}dd)`,
          boxShadow: pct > 0 ? `0 0 6px ${color}20` : 'none',
        }}
      />
    </div>
  );
}
