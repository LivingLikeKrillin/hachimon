"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// obsidian-plugin/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => HachimonPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");
var import_node_fs = require("node:fs");
var import_node_path = __toESM(require("node:path"), 1);

// src/lib/obsidian.ts
var TIER_ABBR = {
  foundation: "f",
  mechanism: "m",
  diagnosis: "d"
};
var TIER_BY_HEADING = {
  foundation: "foundation",
  mechanism: "mechanism",
  diagnosis: "diagnosis"
};
var ANCHOR_RE = /^##\s+Self-Test Anchors\s*$/i;
var TIER_RE = /^###\s+(\w+)/;
function slugify(filename) {
  return filename.replace(/\.md$/i, "").trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "");
}
function hashContent(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 6);
}
function parseVault(files, version = (/* @__PURE__ */ new Date()).toISOString()) {
  var _a;
  const cards = [];
  for (const file of files) {
    const slug = slugify(file.name);
    const seq = {};
    let inSection = false;
    let deck = null;
    let tier = null;
    for (const raw of file.content.split("\n")) {
      const line = raw.trim();
      if (!inSection) {
        if (ANCHOR_RE.test(line)) inSection = true;
        continue;
      }
      if (line.startsWith("#flashcard/")) {
        deck = line.slice(1).split(/\s+/)[0];
        continue;
      }
      const tierMatch = line.match(TIER_RE);
      if (tierMatch) {
        tier = (_a = TIER_BY_HEADING[tierMatch[1].toLowerCase()]) != null ? _a : tier;
        continue;
      }
      const idx = line.indexOf("::");
      if (idx === -1 || !deck || !tier) continue;
      const question = line.slice(0, idx).trim();
      const answer = line.slice(idx + 2).trim();
      if (!question) continue;
      const abbr = TIER_ABBR[tier];
      seq[abbr] = (seq[abbr] || 0) + 1;
      cards.push({
        id: `${slug}-${abbr}${seq[abbr]}`,
        deck,
        tier,
        question,
        answer,
        sourceFile: file.name,
        sourceHash: hashContent(`${question}\0${answer}`)
      });
    }
  }
  const deckMap = /* @__PURE__ */ new Map();
  for (const card of cards) {
    let d = deckMap.get(card.deck);
    if (!d) {
      const path2 = card.deck.split("/");
      d = { id: card.deck, name: path2[path2.length - 1], path: path2, cardCount: 0 };
      deckMap.set(card.deck, d);
    }
    d.cardCount++;
  }
  return { version, decks: Array.from(deckMap.values()), cards };
}

// obsidian-plugin/serialize.ts
function serializeCards(files, version) {
  const warnings = [];
  const seen = /* @__PURE__ */ new Set();
  for (const f of files) {
    if (seen.has(f.name)) warnings.push(`\uC911\uBCF5 \uD30C\uC77C\uBA85 \u2014 id \uCDA9\uB3CC \uAC00\uB2A5: ${f.name}`);
    seen.add(f.name);
  }
  const data = parseVault(files, version);
  if (data.cards.length === 0) {
    throw new Error("\uCE74\uB4DC\uB97C \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. ## Self-Test Anchors / #flashcard/\u2026 / ### Tier / \uC9C8\uBB38?::\uB2F5\uBCC0 \uD3EC\uB9F7\uC744 \uD655\uC778\uD558\uC138\uC694.");
  }
  return {
    json: JSON.stringify(data, null, 2) + "\n",
    decks: data.decks.length,
    cards: data.cards.length,
    warnings
  };
}

// obsidian-plugin/main.ts
var DEFAULT_SETTINGS = { outputPath: "" };
var HachimonPlugin = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "settings", DEFAULT_SETTINGS);
  }
  async onload() {
    await this.loadSettings();
    this.addRibbonIcon("download", "Generate Hachimon cards.json", () => {
      void this.exportCards();
    });
    this.addCommand({
      id: "export-cards",
      name: "Generate cards.json",
      callback: () => {
        void this.exportCards();
      }
    });
    this.addSettingTab(new HachimonSettingTab(this.app, this));
  }
  async loadSettings() {
    this.settings = { ...DEFAULT_SETTINGS, ...await this.loadData() };
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async exportCards() {
    try {
      const out = this.settings.outputPath.trim();
      if (!out || !import_node_path.default.isAbsolute(out)) {
        new import_obsidian2.Notice("Hachimon: \uC124\uC815\uC5D0\uC11C \uCD9C\uB825 \uC808\uB300 \uACBD\uB85C\uB97C \uC9C0\uC815\uD558\uC138\uC694.");
        return;
      }
      const tfiles = this.app.vault.getMarkdownFiles();
      const files = await Promise.all(
        tfiles.map(async (f) => ({ name: f.name, content: await this.app.vault.read(f) }))
      );
      const result = serializeCards(files, (/* @__PURE__ */ new Date()).toISOString());
      for (const w of result.warnings) new import_obsidian2.Notice(`\u26A0 ${w}`);
      (0, import_node_fs.mkdirSync)(import_node_path.default.dirname(out), { recursive: true });
      (0, import_node_fs.writeFileSync)(out, result.json);
      new import_obsidian2.Notice(`\u2713 ${result.decks} decks / ${result.cards} cards \u2192 ${out}`);
    } catch (e) {
      new import_obsidian2.Notice(`\u2717 ${e instanceof Error ? e.message : String(e)}`);
    }
  }
};
var HachimonSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    __publicField(this, "plugin");
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian2.Setting(containerEl).setName("\uCD9C\uB825 \uACBD\uB85C (\uC808\uB300)").setDesc("cards.json\uC744 \uC4F8 \uC808\uB300 \uACBD\uB85C. \uC608: C:/Users/you/hachimon/public/cards.json").addText(
      (t) => t.setPlaceholder("/abs/path/to/public/cards.json").setValue(this.plugin.settings.outputPath).onChange(async (v) => {
        this.plugin.settings.outputPath = v;
        await this.plugin.saveSettings();
      })
    );
  }
};
