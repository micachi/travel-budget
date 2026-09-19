#!/usr/bin/env node
/**
 * 旅行予算シミュレーター 静的サイト生成
 * 為替は ECB(Frankfurter) から毎日自動取得。APIキー不要・無料。
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "dist");

const FX_API = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=JPY,EUR,KRW,CNY,TWD,AUD,THB,GBP";

async function fetchRates() {
  const res = await fetch(FX_API, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`FX API ${res.status}`);
  const json = await res.json();
  if (!json.rates?.JPY) throw new Error("JPY rate missing");
  return json;
}

const yen = (n) => Math.round(n).toLocaleString("ja-JP");

// 共通ナビ（tools.wicachi.com と同一デザイン）。全ページに注入する。
const NAV = `<nav class="nav"><div class="nav-in">
  <a class="nav-brand" href="https://tools.wicachi.com/">🧰 便利ツール</a>
  <div class="dd">
    <button type="button" class="dd-btn" id="ddBtn" aria-expanded="false" aria-controls="ddMenu">ツールメニュー <span class="caret">▾</span></button>
    <div class="dd-menu" id="ddMenu" role="menu" hidden>
      <div class="dd-group"><span class="dd-cat">作成・生成</span>
        <a href="https://tools.wicachi.com/qr/">QRコード生成</a>
        <a href="https://tools.wicachi.com/intunestart/">Intune スタートレイアウト</a>
        <a href="https://micachi.github.io/pwgen/">パスワード一括生成</a>
      </div>
      <div class="dd-group"><span class="dd-cat">検査・整形</span>
        <a href="https://tools.wicachi.com/mojicount/">文字数カウンター</a>
        <a href="https://tools.wicachi.com/color/">色・コントラスト検査</a>
        <a href="https://tools.wicachi.com/json/">JSON 整形・検証</a>
      </div>
      <div class="dd-group"><span class="dd-cat">計算</span>
        <a href="https://tools.wicachi.com/unit/">単位変換</a>
        <a href="https://tools.wicachi.com/datecalc/">日付計算</a>
        <a href="https://micachi.github.io/travel-budget/" class="on" aria-current="page">旅行予算シミュレーター</a>
      </div>
    </div>
  </div>
  <span class="nav-cur">旅行予算シミュレーター</span>
</div></nav>
<script>
(function(){
  var btn=document.getElementById("ddBtn"), menu=document.getElementById("ddMenu");
  if(!btn||!menu)return;
  var open=function(){menu.hidden=false;btn.setAttribute("aria-expanded","true");};
  var close=function(){menu.hidden=true;btn.setAttribute("aria-expanded","false");};
  btn.addEventListener("click",function(e){e.stopPropagation();menu.hidden?open():close();});
  document.addEventListener("click",function(e){if(!menu.contains(e.target)&&e.target!==btn)close();});
  document.addEventListener("keydown",function(e){if(e.key==="Escape"){close();btn.focus();}});
})();
</script>`;

// 共通ナビ CSS（メイン／都市別ページで共有）
const NAV_CSS = `
  .nav{position:sticky;top:0;z-index:50;background:rgba(15,17,21,.95);backdrop-filter:blur(8px);
       border-bottom:1px solid #232a36;margin:0 0 24px}
  .nav-in{max-width:__W__px;margin:0 auto;padding:10px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
  .nav-brand{font-weight:700;font-size:.92rem;letter-spacing:.04em;color:#e8eaed;text-decoration:none;white-space:nowrap}
  .nav-brand:hover{color:#4f9cff;text-decoration:none}
  .nav-cur{margin-left:auto;font-size:.85rem;color:#4f9cff;font-weight:600;white-space:nowrap}
  @media(max-width:560px){.nav-cur{display:none}}
  .dd{position:relative}
  .dd-btn{display:inline-flex;align-items:center;gap:7px;padding:7px 14px;border-radius:9px;
    border:1px solid #232a36;background:#1c2330;color:#e8eaed;font-size:.86rem;cursor:pointer;font-family:inherit}
  .dd-btn:hover{background:#242c3a;border-color:#33405a}
  .dd-btn .caret{font-size:.7rem;opacity:.8;transition:transform .18s}
  .dd-btn[aria-expanded="true"] .caret{transform:rotate(180deg)}
  .dd-menu{position:absolute;top:calc(100% + 8px);left:0;z-index:60;min-width:260px;
    background:#161b24;border:1px solid #2b333f;border-radius:12px;padding:10px;box-shadow:0 12px 32px rgba(0,0,0,.5)}
  .dd-group{padding:6px 0}
  .dd-group + .dd-group{border-top:1px solid #232a36}
  .dd-cat{display:block;font-size:.7rem;color:#9aa0a6;letter-spacing:.08em;margin:0 0 4px 8px}
  .dd-menu a{display:block;padding:7px 10px;border-radius:8px;font-size:.87rem;color:#e8eaed;text-decoration:none}
  .dd-menu a:hover{background:#212a37;color:#4f9cff;text-decoration:none}
  .dd-menu a.on{background:#4f9cff;color:#08101e;font-weight:600}
  .dd-menu a.on:hover{background:#6cabff;color:#08101e}`;

function render({ rates, fxDate, countries, generated }) {
  const jpy = rates.JPY;
  const rows = countries.map((c) => {
    const daily = c.dailyUSD * jpy;
    const min = daily * c.days[0];
    const max = daily * c.days[1];
    return `      <tr data-usd="${c.dailyUSD}" data-id="${c.id}">
        <td><a href="/${c.id}/">${c.name}</a></td>
        <td>${c.region}</td>
        <td class="num">${yen(daily)}</td>
        <td class="num">${yen(min)} 〜 ${yen(max)}</td>
        <td class="num">${c.days[0]}〜${c.days[1]}日</td>
      </tr>`;
  }).join("\n");

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>海外旅行 予算シミュレーター｜今日の為替で自動計算</title>
<meta name="description" content="${fxDate} 時点のECB公式為替で、主要都市の1日あたり旅行予算と総額を自動計算します。毎日自動更新。">
<style>
  :root { --bg:#0f1115; --fg:#e8eaed; --mut:#9aa0a6; --acc:#4f9cff; --card:#171a21; }
  ${NAV_CSS.replace("__W__", "920")}
  * { box-sizing:border-box }
  body { margin:0; background:var(--bg); color:var(--fg);
         font-family:"Hiragino Kaku Gothic ProN","Meiryo",system-ui,sans-serif; line-height:1.7 }
  .wrap { max-width:920px; margin:0 auto; padding:32px 16px }
  h1 { font-size:1.6rem; margin:0 0 4px }
  .sub { color:var(--mut); font-size:.9rem }
  .fx { background:var(--card); border-radius:12px; padding:16px 20px; margin:20px 0;
        display:flex; flex-wrap:wrap; gap:18px; align-items:baseline }
  .fx b { color:var(--acc); font-size:1.3rem; font-variant-numeric:tabular-nums }
  table { width:100%; border-collapse:collapse; background:var(--card); border-radius:12px; overflow:hidden }
  th,td { padding:12px 14px; text-align:left; border-bottom:1px solid #262b34; font-size:.95rem }
  th { color:var(--mut); font-weight:600; font-size:.85rem }
  .num { text-align:right; font-variant-numeric:tabular-nums }
  a { color:var(--acc); text-decoration:none }
  a:hover { text-decoration:underline }
  .calc { background:var(--card); border-radius:12px; padding:20px; margin:24px 0 }
  input,select { padding:10px; border-radius:8px; border:1px solid #2b313c; background:#0f1115;
                color:var(--fg); font-size:1rem }
  #out { font-size:1.5rem; color:var(--acc); font-variant-numeric:tabular-nums; margin-top:10px }
  footer { color:var(--mut); font-size:.8rem; margin-top:36px; border-top:1px solid #262b34; padding-top:16px }
  .xlinks a { margin-right:14px; color:var(--acc); }
</style>
</head>
<body>
${NAV}
<div class="wrap">
  <h1>海外旅行 予算シミュレーター</h1>
  <p class="sub">${fxDate} 時点の ECB（欧州中央銀行）公式為替で自動計算 ・ 毎日自動更新</p>

  <div class="fx">
    <span>1 USD = <b>${jpy.toFixed(2)}</b> JPY</span>
    <span>出典: European Central Bank</span>
  </div>

  <div class="calc">
    <label>行き先
      <select id="dest">${countries.map((c) => `<option value="${c.dailyUSD}">${c.name}</option>`).join("")}</select>
    </label>
    <label>日数 <input id="days" type="number" value="7" min="1" max="60" style="width:80px"></label>
    <label>人数 <input id="ppl" type="number" value="2" min="1" max="10" style="width:70px"></label>
    <div id="out"></div>
    <p class="sub">※ 中間グレード（ホテル3つ星相当・食事・市内交通・観光込み）の目安です。航空券は含みません。</p>
  </div>

  <table>
    <thead><tr><th>都市</th><th>地域</th><th class="num">1日/人</th><th class="num">推奨期間の総額(1人)</th><th class="num">目安</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>

  <footer>
    <p class="xlinks">
      <a href="https://micachi.github.io/tools/">🧰 便利ツール一覧</a>
      <a href="https://micachi.github.io/tools/qr/">QRコード生成</a>
      <a href="https://micachi.github.io/tools/mojicount/">文字数カウンター</a>
      <a href="https://micachi.github.io/tools/color/">色・コントラスト検査</a>
      <a href="https://micachi.github.io/pwgen/">パスワード一括生成</a>
    </p>
    最終更新: ${generated} JST ・ データ: ECB Frankfurter API<br>
    本サイトは概算です。実際の料金は時期・為替変動により大きく変わります。
  </footer>
</div>
<script>
const FX = ${jpy.toFixed(2)};
const calc = () => {
  const usd = +document.getElementById("dest").value;
  const d = +document.getElementById("days").value || 0;
  const p = +document.getElementById("ppl").value || 0;
  const total = usd * FX * d * p;
  document.getElementById("out").textContent =
    total.toLocaleString("ja-JP") + " 円（1人 " + Math.round(usd * FX * d).toLocaleString("ja-JP") + " 円）";
};
["dest","days","ppl"].forEach((id) => document.getElementById(id).addEventListener("input", calc));
calc();
</script>
</body>
</html>`;
}

const cfg = JSON.parse(readFileSync(join(ROOT, "data/countries.json"), "utf8"));
const { rates, date } = await fetchRates();
const generated = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace("T", " ");

mkdirSync(join(OUT, "api"), { recursive: true });
writeFileSync(join(OUT, "index.html"), render({ rates, fxDate: date, countries: cfg.countries, generated }));
writeFileSync(join(OUT, "api/rates.json"), JSON.stringify({ date, rates, generated }, null, 2));

// 都市別ページ（SEO用の個別ランディングページ）
for (const c of cfg.countries) {
  mkdirSync(join(OUT, c.id), { recursive: true });
  const daily = c.dailyUSD * rates.JPY;
  writeFileSync(join(OUT, c.id, "index.html"), `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${c.name} 旅行 予算の目安｜${c.days[0]}〜${c.days[1]}日</title>
<meta name="description" content="${date} 時点の為替で算出。${c.name}の1日あたり予算は約${yen(daily)}円、${c.days[0]}〜${c.days[1]}日なら約${yen(daily * c.days[0])}〜${yen(daily * c.days[1])}円。">
<link rel="canonical" href="/${c.id}/">
<style>body{background:#0f1115;color:#e8eaed;font-family:"Hiragino Kaku Gothic ProN",Meiryo,sans-serif;line-height:1.8}
.wrap{max-width:720px;margin:0 auto;padding:40px 16px}h1{font-size:1.5rem}
.big{font-size:2rem;color:#4f9cff;font-variant-numeric:tabular-nums}
a{color:#4f9cff}table{width:100%;border-collapse:collapse;margin:20px 0}td,th{padding:10px;border-bottom:1px solid #262b34;text-align:left}
${NAV_CSS.replace("__W__", "720")}</style>
</head><body>${NAV}<div class="wrap">
<h1>${c.name} 旅行 予算の目安</h1>
<p>${date} 時点の ECB 公式為替（1ドル = ${rates.JPY.toFixed(2)}円）で算出しています。</p>
<p class="big">1日あたり 約${yen(daily)}円</p>
<table>
<tr><th>推奨日数</th><td>${c.days[0]}〜${c.days[1]}日</td></tr>
<tr><th>1人の総額目安</th><td>${yen(daily * c.days[0])}〜${yen(daily * c.days[1])}円</td></tr>
<tr><th>2人の総額目安</th><td>${yen(daily * c.days[0] * 2)}〜${yen(daily * c.days[1] * 2)}円</td></tr>
<tr><th>地域</th><td>${c.region}</td></tr>
</table>
<p><a href="/">← 他の都市と比較する</a></p>
<p style="color:#9aa0a6;font-size:.85rem">※ 中間グレード（ホテル3つ星相当・食事・市内交通・観光込み）の概算です。航空券は含みません。為替により変動します。</p>
</div></body></html>`);
}

console.log(`OK  ${cfg.countries.length}都市 + 為替(${date}) を生成 → dist/`);
