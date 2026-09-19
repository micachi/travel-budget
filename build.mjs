#!/usr/bin/env node
/**
 * 旧 travel-budget リポジトリ — 統合先へのリダイレクト専用ページを生成する。
 * 都市別ページも対応する都市へ振り向ける。
 */
import { writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "dist");
const BASE = "https://tools.wicachi.com/travel/";

const page = (label, target) => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0; url=${target}">
<link rel="canonical" href="${target}">
<meta name="robots" content="noindex">
<title>${label} — 移動しました</title>
<style>body{background:#0f1115;color:#e8eaed;font-family:"Hiragino Kaku Gothic ProN",Meiryo,system-ui,sans-serif;
display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;line-height:1.8}
.box{max-width:520px;padding:32px;text-align:center}a{color:#4f9cff}</style>
</head>
<body>
<div class="box">
  <p><b>${label}</b> は統合により新しい場所へ引っ越しました。</p>
  <p>移動しない場合は <a href="${target}">こちらをクリック</a> してください。</p>
</div>
<script>location.replace("${target}");</script>
</body>
</html>`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "index.html"), page("海外旅行 予算シミュレーター", BASE));

// 都市別ページも各都市へ
const cfg = JSON.parse(readFileSync(join(ROOT, "data", "countries.json"), "utf8"));
for (const c of cfg.countries) {
  mkdirSync(join(OUT, c.id), { recursive: true });
  writeFileSync(join(OUT, c.id, "index.html"), page(`${c.name} 旅行予算`, `${BASE}${c.id}/`));
}
console.log(`OK  リダイレクト生成 → dist/ （メイン + ${cfg.countries.length}都市）⇒ ${BASE}`);
