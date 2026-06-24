import { Plugin, PluginSettingTab, Setting, Notice, TFile, type App } from 'obsidian';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { parseVaultFiles, finalizeJson } from './serialize.ts';
import { replaceImageRefs } from '../src/lib/images.ts';
import { optimizeImageToDataUri } from '../src/lib/imageOptimize.ts';

interface HachimonSettings {
  outputPath: string;
}
const DEFAULT_SETTINGS: HachimonSettings = { outputPath: '' };

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

export default class HachimonPlugin extends Plugin {
  settings: HachimonSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addRibbonIcon('download', 'Generate Hachimon cards.json', () => {
      void this.exportCards();
    });
    this.addCommand({
      id: 'export-cards',
      name: 'Generate cards.json',
      callback: () => {
        void this.exportCards();
      },
    });
    this.addSettingTab(new HachimonSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** 볼트의 이미지 파일을 basename→TFile로 인덱싱(첫 매치 우선, CLI collectImageFiles와 동일 정책). */
  private indexImages(): Map<string, TFile> {
    const map = new Map<string, TFile>();
    for (const f of this.app.vault.getFiles()) {
      if (IMAGE_EXT.has(f.extension.toLowerCase()) && !map.has(f.name)) map.set(f.name, f);
    }
    return map;
  }

  async exportCards(): Promise<void> {
    try {
      const out = this.settings.outputPath.trim();
      if (!out || !path.isAbsolute(out)) {
        new Notice('Hachimon: 설정에서 출력 절대 경로를 지정하세요.');
        return;
      }
      const tfiles = this.app.vault.getMarkdownFiles();
      const files = await Promise.all(
        tfiles.map(async (f) => ({ name: f.name, content: await this.app.vault.read(f) })),
      );
      const { data, warnings } = parseVaultFiles(files, new Date().toISOString());
      for (const w of warnings) new Notice(`⚠ ${w}`);

      // 이미지 인라인 — CLI sharp 경로와 동일 정책을 Canvas 최적화로 수행.
      const images = this.indexImages();
      let inlined = 0;
      for (const card of data.cards) {
        card.answer = await replaceImageRefs(card.answer, async (ref) => {
          const tf = images.get(path.basename(ref.target));
          if (!tf) {
            new Notice(`⚠ 이미지를 찾을 수 없음: ${ref.target}`);
            return null;
          }
          try {
            const buf = await this.app.vault.readBinary(tf);
            const uri = await optimizeImageToDataUri(new Uint8Array(buf), tf.name);
            inlined++;
            return `![${ref.alt}](${uri})`;
          } catch (e) {
            new Notice(`⚠ 이미지 처리 실패(${ref.target}): ${e instanceof Error ? e.message : String(e)}`);
            return null;
          }
        });
      }

      mkdirSync(path.dirname(out), { recursive: true });
      writeFileSync(out, finalizeJson(data));
      const imgPart = inlined ? ` / 이미지 ${inlined}장` : '';
      new Notice(`✓ ${data.decks.length} decks / ${data.cards.length} cards${imgPart} → ${out}`);
    } catch (e) {
      new Notice(`✗ ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

class HachimonSettingTab extends PluginSettingTab {
  plugin: HachimonPlugin;

  constructor(app: App, plugin: HachimonPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName('출력 경로 (절대)')
      .setDesc('cards.json을 쓸 절대 경로. 예: C:/Users/you/hachimon/public/cards.json')
      .addText((t) =>
        t
          .setPlaceholder('/abs/path/to/public/cards.json')
          .setValue(this.plugin.settings.outputPath)
          .onChange(async (v) => {
            this.plugin.settings.outputPath = v;
            await this.plugin.saveSettings();
          }),
      );
  }
}
