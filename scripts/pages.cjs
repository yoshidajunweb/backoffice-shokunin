// 1件1ページ化：更新（items）・カレンダー（events）ごとに小さなHTMLを作り、sitemap.xml / robots.txt も出す。
// 使い方: node scripts/pages.cjs   （build.cjs のあとに走らせる）
// 出力: site/n/<id>.html（更新）、site/cal/<id>.html（締切）、site/sitemap.xml、site/robots.txt
// 検索エンジンの入口を増やすのが目的。会社名・判定（match/judge）は一切出さない。

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'items.json'), 'utf8'));
const CAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'calendar.json'), 'utf8'));
const FLAGS = (() => { const f = path.join(ROOT, 'data', 'flags.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).flags : {}; })();
const CFG = (() => { const f = path.join(ROOT, 'data', 'config.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}; })();
const SITE_URL = (CFG.siteUrl || '').replace(/\/?$/, '/');   // 例 https://backoffice-shokunin.jp/update/
const SITE_NAME = '福祉行政アップデート';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const idOf = (link) => crypto.createHash('sha1').update(link).digest('hex').slice(0, 10);
const jpDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return `${y}年${m}月${d}日`; };
const MONTH = ['毎月・随時', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const TABS = ['訪問看護', '訪問介護', '障害福祉', 'グループホーム', '障害児通所', '労務・社保'];

// 直近1年の更新だけページにする（古すぎるものは検索に出しても迷惑）
const cutoff = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
const items = data.items.filter((it) => (it.date || it.firstSeen) >= cutoff);
for (const it of items) { it.id = idOf(it.link); it.flag = FLAGS[it.link] || null; it.tabs = it.flag ? [...new Set([...it.tags, ...it.flag.for])] : it.tags; }
const events = CAL.events.map((ev) => ({ ...ev, pageId: ev.id }));

// ---- 共通の枠 -----------------------------------------------------------
function shell({ title, description, canonical, body, breadcrumb }) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}｜${SITE_NAME}</title>
<meta name="description" content="${esc(description)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{--paper:#F4F6F8;--surface:#FFFFFF;--ink:#1A2230;--muted:#66707E;--line:#D6DBE2;--line-strong:#1A2230;--accent:#2A4D9B;--accent-ink:#FFFFFF;--accent-soft:#E4EBF8;--new:#C05621;--amber:#B7791F;
--s-iryo:#9B2C2C;--s-kaigo:#2A4D9B;--s-shogai:#6B46C1;--s-roumu:#4A5568}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#12161C;--surface:#1A1F27;--ink:#E7EAEF;--muted:#98A2B0;--line:#2C333E;--line-strong:#E7EAEF;--accent:#8EB0F2;--accent-ink:#0F1A33;--accent-soft:#22304D;--new:#F6AD55;--amber:#F6C453;--s-iryo:#F98080;--s-kaigo:#8EB0F2;--s-shogai:#B794F4;--s-roumu:#A0AEC0}}
:root[data-theme="dark"]{--paper:#12161C;--surface:#1A1F27;--ink:#E7EAEF;--muted:#98A2B0;--line:#2C333E;--line-strong:#E7EAEF;--accent:#8EB0F2;--accent-ink:#0F1A33;--accent-soft:#22304D;--new:#F6AD55;--amber:#F6C453;--s-iryo:#F98080;--s-kaigo:#8EB0F2;--s-shogai:#B794F4;--s-roumu:#A0AEC0}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:"Zen Kaku Gothic New","Hiragino Kaku Gothic ProN","Yu Gothic UI",system-ui,sans-serif;font-size:15px;line-height:1.7}
a{color:inherit}.wrap{max-width:760px;margin:0 auto;padding:20px 20px 80px}
.top{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--muted);margin-bottom:18px}.top a{font-weight:900;color:var(--ink);text-decoration:none}
.top a:hover{text-decoration:underline}.crumb{margin-left:auto}
h1{font-size:24px;font-weight:900;line-height:1.35;margin:0 0 10px;text-wrap:balance}
.meta{display:flex;flex-wrap:wrap;gap:6px 10px;font-size:13px;color:var(--muted);margin:0 0 16px}
.chip{border:1px solid var(--line);border-radius:6px;padding:0 7px}
.sys{font-size:11px;font-weight:700;letter-spacing:.04em;border-radius:4px;padding:1px 6px;border:1px solid transparent}
.sys-医療{color:var(--s-iryo);border-color:var(--s-iryo)}.sys-介護{color:var(--s-kaigo);border-color:var(--s-kaigo)}.sys-障害{color:var(--s-shogai);border-color:var(--s-shogai)}.sys-労務{color:var(--s-roumu);border-color:var(--s-roumu)}.sys-補助金{color:var(--amber);border-color:var(--amber)}
.box{border:4px solid var(--line-strong);border-radius:12px;background:var(--surface);padding:14px 16px;margin:0 0 18px}
.box.act{border-color:var(--new)}.box h2{font-size:14px;font-weight:900;margin:0 0 6px}.box p{margin:0 0 6px}
.kicker{display:inline-block;font-size:11px;font-weight:900;letter-spacing:.06em;border-radius:4px;padding:1px 7px;background:var(--new);color:#fff;margin-right:6px}
.deadline{color:var(--new);font-weight:700}
.btn{display:inline-block;background:var(--accent);color:var(--accent-ink);border-radius:8px;padding:10px 16px;font-weight:900;text-decoration:none}
.btn:hover{filter:brightness(1.08)}
h2.sec{font-size:15px;font-weight:900;margin:26px 0 8px;padding-bottom:4px;border-bottom:2px solid var(--line-strong)}
ul.rel{list-style:none;margin:0;padding:0}ul.rel li{padding:8px 0;border-bottom:1px solid var(--line);display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px}
ul.rel li:last-child{border-bottom:0}.when{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;color:var(--muted);padding-top:3px;white-space:nowrap}
ul.rel a{text-decoration:none;font-weight:500}ul.rel a:hover{text-decoration:underline}
.foot{margin-top:40px;font-size:12px;color:var(--muted);border-top:1px solid var(--line);padding-top:12px}
.src{font-size:13px;color:var(--muted)}
</style>
</head>
<body>
<div class="wrap">
<div class="top"><a href="${SITE_URL || '../'}">${SITE_NAME}</a><span class="crumb">${esc(breadcrumb)}</span></div>
${body}
<p class="foot">このページは行政機関の公開情報を要約・整理したものです。必ずリンク先の一次情報を確認してください。国の機関のページは政府標準利用規約（第2.0版）に基づき、出典を明示して要約・リンクしています。</p>
</div>
</body>
</html>`;
}

const sysChips = (list) => (list || []).map((s) => `<span class="sys sys-${esc(s)}">${esc(s)}</span>`).join('');
const tagChips = (list) => (list || []).filter((t) => t !== '未分類').map((t) => `<span class="chip">${esc(t)}</span>`).join('');
const relatedEvents = (tabs) => events.filter((ev) => ev.for.some((f) => tabs.includes(f))).slice(0, 6);
const relatedItems = (tabs, exceptId) => items.filter((it) => it.id !== exceptId && it.tabs.some((t) => tabs.includes(t))).slice(0, 6);

// ---- 更新のページ -------------------------------------------------------
fs.mkdirSync(path.join(SITE, 'n'), { recursive: true });
fs.mkdirSync(path.join(SITE, 'cal'), { recursive: true });
let nItems = 0;
for (const it of items) {
  const url = SITE_URL ? `${SITE_URL}n/${it.id}.html` : '';
  const desc = it.flag ? `${it.flag.summary}。${it.flag.todo}` : `${jpDate(it.date)}に${it.source}が公開した「${it.title}」。${it.tabs.filter((t) => t !== '未分類').join('・') || '福祉'}の事業所向け。`;
  const body = `
<h1>${esc(it.title)}</h1>
<div class="meta">
  <span>${esc(jpDate(it.date))}</span><span>${esc(it.source)}${it.pref ? '・' + esc(it.pref) : ''}</span>
  ${sysChips(it.systems)}${tagChips(it.tabs)}
</div>
${it.flag ? `<div class="box act"><h2><span class="kicker">要対応</span>${esc(it.flag.summary)}</h2>
  <p>${esc(it.flag.todo)}${it.flag.deadline ? ` <span class="deadline">期限：${esc(it.flag.deadline)}</span>` : ''}</p>
  <p class="src">対象：${esc(it.flag.for.join('・'))}／${esc(it.flag.scope)}</p></div>` : ''}
${it.desc ? `<p>${esc(it.desc.replace(/…全文を読む$/, ''))}</p>` : ''}
<p><a class="btn" href="${esc(it.link)}" target="_blank" rel="noopener">一次情報を見る（${esc(it.source)}）</a></p>
${relatedEvents(it.tabs).length ? `<h2 class="sec">関係する締切・義務</h2><ul class="rel">${relatedEvents(it.tabs).map((ev) => `<li><span class="when">${esc(ev.when.slice(0, 14))}</span><a href="../cal/${esc(ev.pageId)}.html">${esc(ev.title)}</a></li>`).join('')}</ul>` : ''}
${relatedItems(it.tabs, it.id).length ? `<h2 class="sec">同じ種別の最近の更新</h2><ul class="rel">${relatedItems(it.tabs, it.id).map((r) => `<li><span class="when">${esc(r.date)}</span><a href="${esc(r.id)}.html">${esc(r.title)}</a></li>`).join('')}</ul>` : ''}`;
  fs.writeFileSync(path.join(SITE, 'n', `${it.id}.html`), shell({ title: it.title, description: desc.slice(0, 150), canonical: url, body, breadcrumb: it.tabs.filter((t) => t !== '未分類')[0] || '更新' }));
  nItems++;
}

// ---- 締切のページ -------------------------------------------------------
for (const ev of events) {
  const url = SITE_URL ? `${SITE_URL}cal/${ev.pageId}.html` : '';
  const label = ev.month === 99 ? '年1回・数年に1回' : MONTH[ev.month];
  const desc = `${ev.title}：${ev.when}。${ev.for.join('・')}の事業所向け。${ev.note || ''}`;
  const rel = items.filter((it) => it.tabs.some((t) => ev.for.includes(t))).slice(0, 6);
  const body = `
<h1>${esc(ev.title)}</h1>
<div class="meta"><span class="chip">${esc(ev.kind)}</span><span>${esc(label)}</span>${sysChips(ev.systems)}${tagChips(ev.for)}${ev.scope !== '全国' ? `<span class="chip">${esc(ev.scope)}</span>` : ''}</div>
<div class="box"><h2>いつ</h2><p><b>${esc(ev.when)}</b>${ev.to ? `　提出先：${esc(ev.to)}` : ''}</p>${ev.note ? `<p>${esc(ev.note)}</p>` : ''}
<p class="src">出所：<a href="${esc(ev.source.url)}" target="_blank" rel="noopener">${esc(ev.source.name)}</a>（${esc(CAL.asof)}時点）</p></div>
${rel.length ? `<h2 class="sec">関係する最近の更新</h2><ul class="rel">${rel.map((r) => `<li><span class="when">${esc(r.date)}</span><a href="../n/${esc(r.id)}.html">${esc(r.title)}</a></li>`).join('')}</ul>` : ''}`;
  fs.writeFileSync(path.join(SITE, 'cal', `${ev.pageId}.html`), shell({ title: ev.title, description: desc.slice(0, 150), canonical: url, body, breadcrumb: '年間カレンダー' }));
}

// ---- sitemap / robots ---------------------------------------------------
if (SITE_URL) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [`${SITE_URL}`, ...items.map((it) => `${SITE_URL}n/${it.id}.html`), ...events.map((ev) => `${SITE_URL}cal/${ev.pageId}.html`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(SITE, 'sitemap.xml'), xml);
  fs.writeFileSync(path.join(SITE, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}sitemap.xml\n`);
}
console.log(`更新ページ ${nItems} 件、締切ページ ${events.length} 件${SITE_URL ? '、sitemap.xml' : '（siteUrl 未設定なので sitemap は作らない）'} → site/n, site/cal`);
