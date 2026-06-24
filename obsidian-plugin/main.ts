import { Plugin, PluginSettingTab, Setting, Notice, type App } from 'obsidian';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { serializeCards } from './serialize.ts';

interface HachimonSettings {
  outputPath: string;
}
const DEFAULT_SETTINGS: HachimonSettings = { outputPath: '' };

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
      const result = serializeCards(files, new Date().toISOString());
      for (const w of result.warnings) new Notice(`⚠ ${w}`);
      mkdirSync(path.dirname(out), { recursive: true });
      writeFileSync(out, result.json);
      new Notice(`✓ ${result.decks} decks / ${result.cards} cards → ${out}`);
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
