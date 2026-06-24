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
function firstDelimiter(line) {
  let inCode = false;
  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    if (ch === "`") inCode = !inCode;
    else if (!inCode && ch === ":" && line[i + 1] === ":") return i;
  }
  return -1;
}
var HEADING_RE = /^#{1,6}\s/;
var FENCE_RE = /^(```|~~~)/;
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
    let curQuestion = null;
    let answerLines = [];
    let inFence = false;
    const flush = () => {
      if (curQuestion === null || !deck || !tier) {
        curQuestion = null;
        answerLines = [];
        return;
      }
      const answer = answerLines.join("\n").replace(/^\s+|\s+$/g, "");
      const abbr = TIER_ABBR[tier];
      seq[abbr] = (seq[abbr] || 0) + 1;
      cards.push({
        id: `${slug}-${abbr}${seq[abbr]}`,
        deck,
        tier,
        question: curQuestion,
        answer,
        sourceFile: file.name,
        sourceHash: hashContent(`${curQuestion}\0${answer}`)
      });
      curQuestion = null;
      answerLines = [];
    };
    for (const raw of file.content.split("\n")) {
      const line = raw.trim();
      if (!inSection) {
        if (ANCHOR_RE.test(line)) inSection = true;
        continue;
      }
      if (FENCE_RE.test(line)) {
        inFence = !inFence;
        if (curQuestion !== null) answerLines.push(raw);
        continue;
      }
      if (inFence) {
        if (curQuestion !== null) answerLines.push(raw);
        continue;
      }
      if (line.startsWith("#flashcard/")) {
        flush();
        deck = line.slice(1).split(/\s+/)[0];
        continue;
      }
      const tierMatch = line.match(TIER_RE);
      if (tierMatch) {
        flush();
        tier = (_a = TIER_BY_HEADING[tierMatch[1].toLowerCase()]) != null ? _a : tier;
        continue;
      }
      if (HEADING_RE.test(line)) {
        flush();
        continue;
      }
      const di = firstDelimiter(line);
      if (di !== -1 && line.slice(0, di).trim().length > 0 && deck && tier) {
        flush();
        curQuestion = line.slice(0, di).trim();
        answerLines = [line.slice(di + 2)];
        continue;
      }
      if (curQuestion !== null) answerLines.push(raw);
    }
    flush();
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
function parseVaultFiles(files, version) {
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
  return { data, warnings };
}
function finalizeJson(data) {
  return JSON.stringify(data, null, 2) + "\n";
}

// src/lib/images.ts
var EMBED_RE = /!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
var STD_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
function isExternal(target) {
  return /^(https?:|data:)/i.test(target);
}
function findImageRefs(answer) {
  var _a, _b;
  const refs = [];
  for (const m of answer.matchAll(EMBED_RE)) {
    const target = m[1].trim();
    if (!isExternal(target)) refs.push({ raw: m[0], target, alt: ((_a = m[2]) != null ? _a : "").trim() });
  }
  for (const m of answer.matchAll(STD_RE)) {
    const target = m[2].trim();
    if (!isExternal(target)) refs.push({ raw: m[0], target, alt: ((_b = m[1]) != null ? _b : "").trim() });
  }
  return refs;
}
async function replaceImageRefs(answer, resolver) {
  let result = answer;
  for (const ref of findImageRefs(answer)) {
    const replacement = await resolver(ref);
    if (replacement !== null) result = result.replace(ref.raw, () => replacement);
  }
  return result;
}

// src/lib/imageOptimize.ts
var MAX_WIDTH = 800;
var WEBP_QUALITY = 0.8;
function isSvgName(name) {
  return name.toLowerCase().endsWith(".svg");
}
function computeTargetWidth(naturalWidth, max = MAX_WIDTH) {
  return naturalWidth > max ? max : naturalWidth;
}
function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 32768;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function toDataUri(mime, bytes) {
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}
function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => b ? resolve(b) : reject(new Error("canvas.toBlob \uC2E4\uD328")), type, quality);
  });
}
async function optimizeImageToDataUri(bytes, name) {
  if (isSvgName(name)) return toDataUri("image/svg+xml", bytes);
  const bitmap = await createImageBitmap(new Blob([bytes]));
  try {
    const width = computeTargetWidth(bitmap.width);
    const height = Math.max(1, Math.round(bitmap.height * (width / bitmap.width || 1)));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D \uCEE8\uD14D\uC2A4\uD2B8\uB97C \uB9CC\uB4E4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const out = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
    return toDataUri("image/webp", new Uint8Array(await out.arrayBuffer()));
  } finally {
    bitmap.close();
  }
}

// obsidian-plugin/main.ts
var DEFAULT_SETTINGS = { outputPath: "" };
var IMAGE_EXT = /* @__PURE__ */ new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);
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
  /** 볼트의 이미지 파일을 basename→TFile로 인덱싱(첫 매치 우선, CLI collectImageFiles와 동일 정책). */
  indexImages() {
    const map = /* @__PURE__ */ new Map();
    for (const f of this.app.vault.getFiles()) {
      if (IMAGE_EXT.has(f.extension.toLowerCase()) && !map.has(f.name)) map.set(f.name, f);
    }
    return map;
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
      const { data, warnings } = parseVaultFiles(files, (/* @__PURE__ */ new Date()).toISOString());
      for (const w of warnings) new import_obsidian2.Notice(`\u26A0 ${w}`);
      const images = this.indexImages();
      let inlined = 0;
      for (const card of data.cards) {
        card.answer = await replaceImageRefs(card.answer, async (ref) => {
          const tf = images.get(import_node_path.default.basename(ref.target));
          if (!tf) {
            new import_obsidian2.Notice(`\u26A0 \uC774\uBBF8\uC9C0\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC74C: ${ref.target}`);
            return null;
          }
          try {
            const buf = await this.app.vault.readBinary(tf);
            const uri = await optimizeImageToDataUri(new Uint8Array(buf), tf.name);
            inlined++;
            return `![${ref.alt}](${uri})`;
          } catch (e) {
            new import_obsidian2.Notice(`\u26A0 \uC774\uBBF8\uC9C0 \uCC98\uB9AC \uC2E4\uD328(${ref.target}): ${e instanceof Error ? e.message : String(e)}`);
            return null;
          }
        });
      }
      (0, import_node_fs.mkdirSync)(import_node_path.default.dirname(out), { recursive: true });
      (0, import_node_fs.writeFileSync)(out, finalizeJson(data));
      const imgPart = inlined ? ` / \uC774\uBBF8\uC9C0 ${inlined}\uC7A5` : "";
      new import_obsidian2.Notice(`\u2713 ${data.decks.length} decks / ${data.cards.length} cards${imgPart} \u2192 ${out}`);
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
