// 手順ガイド（data/guides/*.json）→ site/guide/<id>.html
// 使い方: node scripts/guides.cjs
//
// 考え方：読者は既に「自分の県」と「種別」を選んでいる。だから調べさせない。
// その県で確定していること（提出先・様式の直リンク・期限・電話番号）をそのまま出す。
// 未収録の県は、正直に「まだ用意できていません」と出す（推測で書かない）。

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const GDIR = path.join(ROOT, 'data', 'guides');
const CFG = (() => { const f = path.join(ROOT, 'data', 'config.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}; })();
const SITE_URL = (CFG.siteUrl || '').replace(/\/?$/, '/');
const SITE_NAME = '福祉行政アップデート';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nl = (s) => esc(s).replace(/\n/g, '<br>');

if (!fs.existsSync(GDIR)) { console.log('data/guides が無いので何もしない'); process.exit(0); }
fs.mkdirSync(path.join(SITE, 'guide'), { recursive: true });

const files = fs.readdirSync(GDIR).filter((f) => f.endsWith('.json'));
for (const file of files) {
  const g = JSON.parse(fs.readFileSync(path.join(GDIR, file), 'utf8'));
  const url = SITE_URL ? `${SITE_URL}guide/${g.id}.html` : '';
  const free = g.steps.filter((s) => s.n <= g.freeSteps);
  const paid = g.steps.filter((s) => s.n > g.freeSteps);
  const prefNames = Object.keys(g.prefs || {});

  // 県ごとのパネル（JSで表示を切り替える。選ばれていない県は hidden）
  const panels = prefNames.map((pref) => {
    const kinds = g.prefs[pref];
    return Object.entries(kinds).map(([kind, d]) => `
    <div class="panel" data-pref="${esc(pref)}" data-kind="${esc(kind)}" hidden>
      <div class="pan-head"><b>${esc(pref)}</b><span>${esc(d.label)}</span></div>
      <dl class="facts">
        <dt>いつまで</dt><dd>${esc(d.deadline)}</dd>
        <dt>出し方</dt><dd>${esc(d.method)}${d.fileNameRule ? `<br><span class="hint">${esc(d.fileNameRule)}</span>` : ''}</dd>
        <dt>提出先</dt><dd>${esc(d.contact.name)}<br><span class="hint">${esc(d.contact.tel)}${d.contact.fax ? ' ／ FAX ' + esc(d.contact.fax) : ''}${d.contact.note ? '<br>' + esc(d.contact.note) : ''}</span></dd>
      </dl>
      <div class="dl">
        ${d.forms.map((f) => `<a class="btn-dl" href="${esc(f.url)}" download>⬇ ${esc(f.name)}<span>${esc(f.size || '')}</span></a>`).join('')}
      </div>
      <p><a class="btn-go" href="${esc(d.submitUrl)}" target="_blank" rel="noopener">${esc(d.submitLabel)} →</a></p>
      ${(d.notes || []).length ? `<ul class="notes">${d.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      <p class="src">出所：<a href="${esc(d.sourcePage)}" target="_blank" rel="noopener">${esc(pref)}のページ</a>（${esc(g.asof)}確認）</p>
    </div>`).join('');
  }).join('');

  const body = `
<h1>${esc(g.title)}</h1>
<p class="lead"><b>${esc(g.lead)}</b></p>

<div class="picker">
  <label>都道府県
    <select id="pref">
      <option value="">選んでください</option>
      ${prefNames.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}
    </select>
  </label>
  <label>制度
    <select id="kind">
      <option value="介護">介護保険</option>
      <option value="障害">障害福祉</option>
    </select>
  </label>
</div>
<p class="notyet" id="notyet" hidden>この組み合わせはまだ用意できていません。<a href="${SITE_URL || '../'}">一覧に戻る</a>から「ご意見」でお知らせいただければ、優先して用意します。</p>

<h2 class="sec">先に用意するもの</h2>
<ul class="prep">${g.prepare.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>

${panels}

<h2 class="sec">手順</h2>
<ol class="steps">
  ${free.map((s) => `<li><b>${esc(s.title)}</b>${s.body ? `<p>${nl(s.body)}</p>` : ''}${s.showForms ? '<p class="here">↑ 上のボタンから落とせます</p>' : ''}${s.showNotes ? '<p class="here">↑ 上の「提出先」を見てください</p>' : ''}</li>`).join('')}
</ol>

<div class="paywall">
  <p class="pw-title">ここから先は手順ガイド（準備中）</p>
  <ol class="steps locked" start="${g.freeSteps + 1}">
    ${paid.map((s) => `<li>${esc(s.title)}</li>`).join('')}
  </ol>
  <p class="pw-note">様式の記入を上から順にたどれる形で用意しています。公開したらお知らせします。</p>
</div>

<h2 class="sec">詰まりやすいところ</h2>
<dl class="tr">
  ${g.troubles.map((t) => `<dt>${esc(t.q)}</dt><dd>${esc(t.a)}</dd>`).join('')}
</dl>`;

  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(g.title)}｜${SITE_NAME}</title>
<meta name="description" content="${esc(g.lead)}都道府県と制度を選ぶと、様式のダウンロード・提出先・期限がそのまま出ます。">
${url ? `<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(g.title)}"><meta property="og:description" content="${esc(g.lead)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(SITE_URL)}assets/ogp.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap">
<style>
:root{--paper:#F4F6F8;--surface:#FFFFFF;--ink:#1A2230;--muted:#66707E;--line:#D6DBE2;--line-strong:#1A2230;--accent:#2A4D9B;--accent-ink:#fff;--accent-soft:#E4EBF8;--new:#C05621;--ok:#2F855A}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#12161C;--surface:#1A1F27;--ink:#E7EAEF;--muted:#98A2B0;--line:#2C333E;--line-strong:#E7EAEF;--accent:#8EB0F2;--accent-ink:#0F1A33;--accent-soft:#22304D;--new:#F6AD55;--ok:#68D391}}
:root[data-theme="dark"]{--paper:#12161C;--surface:#1A1F27;--ink:#E7EAEF;--muted:#98A2B0;--line:#2C333E;--line-strong:#E7EAEF;--accent:#8EB0F2;--accent-ink:#0F1A33;--accent-soft:#22304D;--new:#F6AD55;--ok:#68D391}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:"Zen Kaku Gothic New","Hiragino Kaku Gothic ProN","Yu Gothic UI",system-ui,sans-serif;font-size:15px;line-height:1.75}
a{color:inherit}.wrap{max-width:760px;margin:0 auto;padding:20px 20px 80px}
.top{font-size:13px;color:var(--muted);margin-bottom:18px}.top a{font-weight:900;color:var(--ink);text-decoration:none}
h1{font-size:24px;font-weight:900;line-height:1.35;margin:0 0 12px;text-wrap:balance}
.lead{margin:0 0 20px;padding:10px 14px;border-left:4px solid var(--accent);background:var(--surface);border-radius:0 8px 8px 0}
h2.sec{font-size:15px;font-weight:900;margin:28px 0 10px;padding-bottom:4px;border-bottom:2px solid var(--line-strong)}
.picker{display:flex;flex-wrap:wrap;gap:14px;padding:14px;background:var(--accent-soft);border-radius:10px}
.picker label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:var(--muted)}
.picker select{border:2px solid var(--line);background:var(--surface);color:var(--ink);border-radius:8px;padding:8px 10px;font:inherit;font-size:15px;font-weight:700}
.notyet{background:var(--surface);border:2px dashed var(--line);border-radius:10px;padding:12px 14px;font-size:14px}
.prep{margin:0;padding-left:1.2em}.prep li{margin:2px 0}
.panel{border:4px solid var(--line-strong);border-radius:12px;background:var(--surface);padding:16px 18px;margin:18px 0}
.pan-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px;margin-bottom:10px}
.pan-head b{font-size:18px;font-weight:900}.pan-head span{font-size:13px;color:var(--muted)}
.facts{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 14px;margin:0 0 14px}
.facts dt{font-size:12px;font-weight:900;color:var(--muted);padding-top:3px;white-space:nowrap}
.facts dd{margin:0}
.hint{font-size:13px;color:var(--muted)}
.dl{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.btn-dl{display:flex;align-items:center;gap:8px;border:2px solid var(--accent);border-radius:10px;padding:12px 14px;text-decoration:none;font-weight:900;background:var(--surface)}
.btn-dl span{margin-left:auto;font-size:12px;font-weight:400;color:var(--muted)}
.btn-dl:hover{background:var(--accent-soft)}
.btn-go{display:inline-block;background:var(--accent);color:var(--accent-ink);border-radius:10px;padding:12px 18px;font-weight:900;text-decoration:none}
.btn-go:hover{filter:brightness(1.08)}
.notes{margin:12px 0 0;padding-left:1.2em;font-size:13px;color:var(--muted)}
.src{font-size:12px;color:var(--muted);margin:12px 0 0}
.steps{margin:0;padding-left:1.4em}.steps li{margin:0 0 14px}.steps li b{font-weight:900}
.steps p{margin:4px 0 0}
.here{font-size:13px;color:var(--ok);font-weight:700}
.paywall{border:3px solid var(--new);border-radius:12px;padding:16px 18px;margin:22px 0;background:var(--surface)}
.pw-title{margin:0 0 10px;font-weight:900;color:var(--new)}
.steps.locked li{color:var(--muted);margin:0 0 6px}
.pw-note{font-size:13px;color:var(--muted);margin:10px 0 0}
.tr{margin:0}.tr dt{font-weight:900;margin-top:12px}.tr dd{margin:2px 0 0}
.foot{margin-top:40px;font-size:12px;color:var(--muted);border-top:1px solid var(--line);padding-top:12px}
</style>
</head>
<body>
<div class="wrap">
<div class="top"><a href="${SITE_URL || '../'}">${SITE_NAME}</a></div>
${body}
<p class="foot">このページは行政機関の公開情報をもとに、実務の順番に並べ直したものです。様式と提出方法は毎年変わります。手続きの前に必ずリンク先の一次情報を確認してください。（${esc(g.asof)}確認）</p>
</div>
<script>
(function(){
  var pref=document.getElementById('pref'), kind=document.getElementById('kind'), notyet=document.getElementById('notyet');
  var panels=[].slice.call(document.querySelectorAll('.panel'));
  // 一覧で選んだ県があれば、それを初期値にする（同じ localStorage を見る）
  try{ var saved=JSON.parse(localStorage.getItem('fukushi-prefs')||'[]'); if(saved.length) pref.value=saved[0]; }catch(e){}
  function apply(){
    var hit=false;
    panels.forEach(function(p){
      var ok = p.dataset.pref===pref.value && p.dataset.kind===kind.value;
      p.hidden=!ok; if(ok)hit=true;
    });
    notyet.hidden = !pref.value || hit;
  }
  pref.addEventListener('change',apply); kind.addEventListener('change',apply); apply();
})();
</script>
</body>
</html>`;
  fs.writeFileSync(path.join(SITE, 'guide', `${g.id}.html`), html);
  console.log(`ガイド ${g.id}（${prefNames.length}県）→ site/guide/${g.id}.html`);
}
