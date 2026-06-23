import { useState, useRef } from 'react';
import { FolderOpen, FileText, Check, AlertTriangle, Copy, X } from 'lucide-react';
import type { CardsData } from '@/types';
import type { VaultFile } from '@/lib/obsidian';
import { previewVault, commitVaultImport } from '@/lib/data';
import SectionLabel from '@/components/shared/SectionLabel';
import ActionButton from '@/components/shared/ActionButton';

const FORMAT_EXAMPLE = `## Self-Test Anchors
#flashcard/spring/core

### Foundation
트랜잭션 전파란?::경계가 만났을 때 동작을 정하는 규칙.

### Mechanism
REQUIRES_NEW와 NESTED 차이는?::REQUIRES_NEW는 독립 트랜잭션이다.

### Diagnosis
롤백이 전파되지 않는 원인은?::별도 트랜잭션이라 전파되지 않는다.`;

const supportsDirPicker = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

async function readDirectory(): Promise<VaultFile[]> {
  const dir = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
  const out: VaultFile[] = [];
  async function walk(handle: FileSystemDirectoryHandle) {
    for await (const entry of (handle as unknown as { values: () => AsyncIterable<FileSystemHandle> }).values()) {
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.md')) {
        const file = await (entry as FileSystemFileHandle).getFile();
        out.push({ name: entry.name, content: await file.text() });
      } else if (entry.kind === 'directory') {
        await walk(entry as FileSystemDirectoryHandle);
      }
    }
  }
  await walk(dir);
  return out;
}

async function readFileList(list: FileList): Promise<VaultFile[]> {
  const out: VaultFile[] = [];
  for (const f of Array.from(list)) {
    if (!f.name.toLowerCase().endsWith('.md')) continue;
    out.push({ name: f.name, content: await f.text() });
  }
  return out;
}

interface ImportVaultModalProps {
  onClose: () => void;
}

export default function ImportVaultModal({ onClose }: ImportVaultModalProps) {
  const [preview, setPreview] = useState<CardsData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: VaultFile[]) => {
    setError(null);
    if (files.length === 0) { setError('.md 파일을 찾지 못했습니다.'); setPreview(null); return; }
    const data = previewVault(files);
    if (data.cards.length === 0) { setError(`${files.length}개 파일을 읽었지만 카드를 찾지 못했습니다. 노트 포맷을 확인하세요.`); setPreview(null); return; }
    setPreview(data);
  };

  const pickDirectory = async () => {
    try { setBusy(true); await handleFiles(await readDirectory()); }
    catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : '폴더를 읽지 못했습니다.'); }
    finally { setBusy(false); }
  };

  const onInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setBusy(true);
    try { await handleFiles(await readFileList(e.target.files)); } finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!preview) return;
    setBusy(true); setError(null);
    try { await commitVaultImport(preview); window.location.reload(); }
    catch (e) { setError(e instanceof Error ? e.message : '가져오기에 실패했습니다.'); setBusy(false); }
  };

  const copyExample = async () => {
    try { await navigator.clipboard.writeText(FORMAT_EXAMPLE); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center animate-overlay" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[393px] max-h-[88svh] overflow-y-auto bg-[#15171D] rounded-t-[24px] p-5 pb-8 space-y-4 animate-sheet border-t border-white/[0.08]"
        style={{ boxShadow: '0 -8px 40px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-[#2A2F38] mx-auto" />
        <div className="flex items-center justify-between">
          <p className="font-display text-[17px] font-semibold text-[#F4F5F7]">Obsidian Vault 가져오기</p>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-[#969BA6]"><X size={18} /></button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel tight upper>노트 작성 포맷</SectionLabel>
            <button onClick={copyExample} className="flex items-center gap-1 text-[11px] text-[#969BA6]">
              {copied ? <Check size={12} className="text-[#6FC4A0]" /> : <Copy size={12} />}
              {copied ? '복사됨' : '복사'}
            </button>
          </div>
          <pre className="text-[11px] leading-relaxed text-[#C7CCD4] bg-[#0D0F14] border border-white/[0.06] rounded-[12px] p-3.5 overflow-x-auto whitespace-pre font-mono">{FORMAT_EXAMPLE}</pre>
        </div>

        <div className="space-y-2">
          {supportsDirPicker && (
            <ActionButton variant="primary" icon={<FolderOpen size={18} />} onClick={pickDirectory}>Vault 폴더 선택</ActionButton>
          )}
          <ActionButton variant="secondary" icon={<FileText size={18} />} onClick={() => fileInput.current?.click()}>
            {supportsDirPicker ? '또는 .md 파일 직접 선택' : '.md 파일 선택'}
          </ActionButton>
          <input ref={fileInput} type="file" accept=".md" multiple className="hidden" onChange={onInputChange} />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-[12px] bg-[#CD746C]/[0.06] border border-[#CD746C]/25">
            <AlertTriangle size={15} className="text-[#DD8C85] mt-0.5 shrink-0" />
            <p className="text-[12px] text-[#DD8C85] leading-relaxed">{error}</p>
          </div>
        )}

        {preview && (
          <div className="space-y-3 animate-up">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="text-center p-3.5 rounded-[12px] bg-[#181B21] border border-white/[0.07]">
                <p className="font-num text-[22px] font-semibold text-[#E9A94C]">{preview.decks.length}</p>
                <p className="text-[11px] text-[#5D636F]">덱</p>
              </div>
              <div className="text-center p-3.5 rounded-[12px] bg-[#181B21] border border-white/[0.07]">
                <p className="font-num text-[22px] font-semibold text-[#6FC4A0]">{preview.cards.length}</p>
                <p className="text-[11px] text-[#5D636F]">카드</p>
              </div>
            </div>
            <p className="text-[11.5px] text-[#5D636F] leading-relaxed">기존 데모 카드는 교체됩니다. 같은 카드의 복습 일정은 유지되고, 내용이 바뀐 카드만 갱신됩니다.</p>
            <ActionButton variant="primary" icon={<Check size={18} />} onClick={confirm}>
              {busy ? '가져오는 중…' : `${preview.cards.length}장 가져오기`}
            </ActionButton>
          </div>
        )}
      </div>
    </div>
  );
}
