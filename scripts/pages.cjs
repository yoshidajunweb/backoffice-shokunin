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

// Lucideアイコン（ISC）。使うものだけ埋め込む
const LUCIDE_DIR = path.join(ROOT, 'node_modules', 'lucide-static', 'icons');
function lucide(name, cls = '') {
  const f = path.join(LUCIDE_DIR, name + '.svg');
  if (!fs.existsSync(f)) return '';
  const inner = fs.readFileSync(f, 'utf8')
    .replace(/[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*/, '').replace(/\n\s*/g, '');
  return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const idOf = (link) => crypto.createHash('sha1').update(link).digest('hex').slice(0, 10);
const jpDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return `${y}年${m}月${d}日`; };
const MONTH = ['毎月・随時', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const TABS = ['訪問看護', '訪問介護', '障害福祉', 'グループホーム', '障害児通所', '労務・社保'];

// 直近1年の更新をページにする。ただし **種別が付いたものだけ**。
// ※ 2026-09-05：全件ページ化していたため「薬事審議会 血液事業部会 議事録」のような
//   福祉事業所に関係ない記事まで個別ページ＋サイトマップに載っていた。
//   中身の薄いページが大量にあると検索評価が下がり、選別していないサイトに見える。
//   一覧（index.html）の「未分類」タブには今までどおり出るので、取りこぼしにはならない。
//   要対応フラグが付いているものは、種別が無くてもページを作る（分類漏れの保険）。
const cutoff = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
const all = data.items.filter((it) => (it.date || it.firstSeen) >= cutoff);
for (const it of all) { it.id = idOf(it.link); it.flag = FLAGS[it.link] || null; it.tabs = it.flag ? [...new Set([...it.tags, ...it.flag.for])] : it.tags; }
const skipped = all.filter((it) => !it.flag && !it.tabs.some((t) => TABS.includes(t)));
const items = all.filter((it) => it.flag || it.tabs.some((t) => TABS.includes(t)));
const events = CAL.events.map((ev) => ({ ...ev, pageId: ev.id }));

// ---- 共通の枠 -----------------------------------------------------------
function shell({ title, description, canonical, body, breadcrumb, jsonld }) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}｜${SITE_NAME}</title>
<meta name="description" content="${esc(description)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
${SITE_URL ? `<meta property="og:type" content="article">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ''}
<meta property="og:image" content="${esc(SITE_URL)}assets/ogp.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
${CFG.xUrl ? `<meta name="twitter:site" content="@${esc(String(CFG.xUrl).split('/').pop())}">` : ''}` : ''}
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{--paper:#F4F6F8;--surface:#FFFFFF;--ink:#1A2230;--muted:#66707E;--line:#D6DBE2;--line-strong:#1A2230;--accent:#2A4D9B;--accent-ink:#FFFFFF;--accent-soft:#E4EBF8;--new:#C05621;--amber:#B7791F;
--s-iryo:#9B2C2C;--s-kaigo:#2A4D9B;--s-shogai:#6B46C1;--s-roumu:#4A5568}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#12161C;--surface:#1A1F27;--ink:#E7EAEF;--muted:#98A2B0;--line:#2C333E;--line-strong:#E7EAEF;--accent:#8EB0F2;--accent-ink:#0F1A33;--accent-soft:#22304D;--new:#F6AD55;--amber:#F6C453;--s-iryo:#F98080;--s-kaigo:#8EB0F2;--s-shogai:#B794F4;--s-roumu:#A0AEC0}}
:root[data-theme="dark"]{--paper:#12161C;--surface:#1A1F27;--ink:#E7EAEF;--muted:#98A2B0;--line:#2C333E;--line-strong:#E7EAEF;--accent:#8EB0F2;--accent-ink:#0F1A33;--accent-soft:#22304D;--new:#F6AD55;--amber:#F6C453;--s-iryo:#F98080;--s-kaigo:#8EB0F2;--s-shogai:#B794F4;--s-roumu:#A0AEC0}
/* スクロールバー：細く、色はサイトの線色に合わせる。
   標準プロパティのみ（Chrome/Safari/Firefox/Edge すべて対応）。
   軌道を transparent にすると背景に馴染む。ダークは変数で自動的に切り替わる */
html{scrollbar-width:thin;scrollbar-color:var(--line) transparent}
/* 中でスクロールする箱（モーダル・情報源の枠・横スクロールする表）も同じ見た目に */
.modal-box,.slist,.list,.panel,pre,table{scrollbar-width:thin;scrollbar-color:var(--line) transparent}
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
.foot{font-size:12px;color:var(--muted);margin:8px 0 0}
.site-foot{margin-top:48px;padding-top:18px;border-top:6px solid color-mix(in srgb,var(--line-strong) 20%,transparent);border-radius:3px 3px 0 0}
.sf-nav{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:13px;margin-bottom:10px}.sf-nav a{color:var(--ink);text-decoration:none;border-bottom:1px solid var(--line)}.sf-nav a:hover{border-bottom-color:var(--ink)}
.src{font-size:13px;color:var(--muted)}
.lead{font-size:15px;line-height:1.75;margin:0 0 16px;padding:10px 14px;border-left:4px solid var(--accent);background:var(--surface);border-radius:0 8px 8px 0}
.to-top{position:fixed;right:18px;bottom:18px;z-index:20;width:46px;height:46px;border-radius:50%;border:2px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(26,34,48,.18)}
.to-top svg{width:22px;height:22px}
.to-top:hover,.to-top:focus-visible{outline:none;border-color:var(--accent);color:var(--accent)}
@media (max-width:600px){.to-top{right:12px;bottom:12px;width:44px;height:44px}}
@media print{.to-top{display:none}}
</style>
</head>
<body>
<div class="wrap">
<div class="top"><a href="${SITE_URL || '../'}">${SITE_NAME}</a><span class="crumb">${esc(breadcrumb)}</span></div>
${body}
<footer class="site-foot">
  <nav class="sf-nav" aria-label="フッター">
    <a href="${SITE_URL || '../'}">更新一覧</a>
    <a href="${SITE_URL || '../'}about.html">運営者情報</a>
    ${CFG.xUrl ? `<a href="${esc(CFG.xUrl)}" target="_blank" rel="noopener">X @fukushi_update</a>` : ''}
    ${CFG.noteUrl ? `<a href="${esc(CFG.noteUrl)}" target="_blank" rel="noopener">note記事</a>` : ''}
  </nav>
  <p class="foot">このページは行政機関の公開情報を要約・整理したものです。必ずリンク先の一次情報を確認してください。国の機関のページは政府標準利用規約（第2.0版）に基づき、出典を明示して要約・リンクしています。</p>
  <p class="foot">© ${new Date().getFullYear()} バックオフィス職人</p>
</footer>
</div>
<button class="to-top" id="to-top" type="button" aria-label="ページの先頭に戻る" title="先頭に戻る" hidden>${lucide("arrow-up")}</button>
<script>(function(){var b=document.getElementById("to-top");function t(){b.hidden=(window.scrollY||document.documentElement.scrollTop)<400;}window.addEventListener("scroll",t,{passive:true});b.addEventListener("click",function(){var r=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;window.scrollTo({top:0,behavior:r?"auto":"smooth"});});t();})();</script>
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
  const who = it.tabs.filter((t) => t !== '未分類').join('・') || '福祉';
  // AI・検索が最初に読む「答え」の1文：何が・いつ・誰向け（・やること）
  const lead = it.flag
    ? `${jpDate(it.date)}、${it.source}が「${it.title}」を公開。${it.flag.for.join('・')}の事業所（${it.flag.scope}）は${it.flag.todo}${it.flag.deadline ? `（期限：${it.flag.deadline}）` : ''}。`
    : `${jpDate(it.date)}、${it.source}が「${it.title}」を公開。${who}の事業所向けの${it.region === '国' ? '国' : it.region === '厚生局' ? '地方厚生局' : it.pref || '都道府県'}の情報。`;
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: it.title, datePublished: it.date || undefined, inLanguage: 'ja',
    description: lead, about: it.tabs.filter((t) => t !== '未分類'),
    isBasedOn: it.link, publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL || undefined },
    sourceOrganization: { '@type': 'GovernmentOrganization', name: it.source },
    ...(url ? { mainEntityOfPage: url } : {}),
  };
  const body = `
<h1>${esc(it.title)}</h1>
<div class="meta">
  <span>${esc(jpDate(it.date))}</span><span>${esc(it.source)}${it.pref ? '・' + esc(it.pref) : ''}</span>
  ${sysChips(it.systems)}${tagChips(it.tabs)}
</div>
<p class="lead"><b>${esc(lead)}</b></p>
${it.flag ? `<div class="box act"><h2><span class="kicker">要対応</span>${esc(it.flag.summary)}</h2>
  <p>${esc(it.flag.todo)}${it.flag.deadline ? ` <span class="deadline">期限：${esc(it.flag.deadline)}</span>` : ''}</p>
  <p class="src">対象：${esc(it.flag.for.join('・'))}／${esc(it.flag.scope)}</p></div>` : ''}
${it.desc ? `<p>${esc(it.desc.replace(/…全文を読む$/, ''))}</p>` : ''}
<p><a class="btn" href="${esc(it.link)}" target="_blank" rel="noopener">一次情報を見る（${esc(it.source)}）</a></p>
${relatedEvents(it.tabs).length ? `<h2 class="sec">関係する締切・義務</h2><ul class="rel">${relatedEvents(it.tabs).map((ev) => `<li><span class="when">${esc(ev.when.slice(0, 14))}</span><a href="../cal/${esc(ev.pageId)}.html">${esc(ev.title)}</a></li>`).join('')}</ul>` : ''}
${relatedItems(it.tabs, it.id).length ? `<h2 class="sec">同じ種別の最近の更新</h2><ul class="rel">${relatedItems(it.tabs, it.id).map((r) => `<li><span class="when">${esc(r.date)}</span><a href="${esc(r.id)}.html">${esc(r.title)}</a></li>`).join('')}</ul>` : ''}`;
  fs.writeFileSync(path.join(SITE, 'n', `${it.id}.html`), shell({ title: it.title, description: lead.slice(0, 150), canonical: url, body, breadcrumb: it.tabs.filter((t) => t !== '未分類')[0] || '更新', jsonld }));
  nItems++;
}

// ---- 締切のページ -------------------------------------------------------
for (const ev of events) {
  const url = SITE_URL ? `${SITE_URL}cal/${ev.pageId}.html` : '';
  const label = ev.month === 99 ? '年1回・数年に1回' : MONTH[ev.month];
  const desc = `${ev.title}：${ev.when}。${ev.for.join('・')}の事業所向け。${ev.note || ''}`;
  const rel = items.filter((it) => it.tabs.some((t) => ev.for.includes(t))).slice(0, 6);
  const lead = `${ev.title}は${ev.when}${ev.to ? `、${ev.to}へ${ev.kind}` : ''}。対象は${ev.for.join('・')}の事業所${ev.scope !== '全国' ? `（${ev.scope}）` : ''}。${ev.note ? ev.note + '。' : ''}出所：${ev.source.name}。`;
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: ev.title, inLanguage: 'ja', description: lead, about: ev.for,
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL || undefined },
    citation: { '@type': 'CreativeWork', name: ev.source.name, url: ev.source.url },
    dateModified: CAL.asof, ...(url ? { mainEntityOfPage: url } : {}),
  };
  const body = `
<h1>${esc(ev.title)}</h1>
<p class="lead"><b>${esc(lead)}</b></p>
<div class="meta"><span class="chip">${esc(ev.kind)}</span><span>${esc(label)}</span>${sysChips(ev.systems)}${tagChips(ev.for)}${ev.scope !== '全国' ? `<span class="chip">${esc(ev.scope)}</span>` : ''}</div>
<div class="box"><h2>いつ</h2><p><b>${esc(ev.when)}</b>${ev.to ? `　提出先：${esc(ev.to)}` : ''}</p>${ev.note ? `<p>${esc(ev.note)}</p>` : ''}
<p class="src">出所：<a href="${esc(ev.source.url)}" target="_blank" rel="noopener">${esc(ev.source.name)}</a>（${esc(CAL.asof)}時点）</p></div>
${rel.length ? `<h2 class="sec">関係する最近の更新</h2><ul class="rel">${rel.map((r) => `<li><span class="when">${esc(r.date)}</span><a href="../n/${esc(r.id)}.html">${esc(r.title)}</a></li>`).join('')}</ul>` : ''}`;
  fs.writeFileSync(path.join(SITE, 'cal', `${ev.pageId}.html`), shell({ title: ev.title, description: lead.slice(0, 150), canonical: url, body, breadcrumb: '年間カレンダー', jsonld }));
}

// ---- 運営者情報 / llms.txt -------------------------------------------------
const aboutBody = `
<h1>運営者情報</h1>
<p class="lead"><b>${SITE_NAME}は、国・地方厚生局・都道府県が出す福祉事業所向けの更新を集め、種別と都道府県で絞って「要対応」と「締切」に変えて見せる個人運営のサイトです。</b></p>
<div class="box"><h2>誰が</h2><p>運営：バックオフィス職人（現役の福祉事業所の事務担当）。訪問看護・訪問介護・障害福祉の事業所で、届出・請求・労務を実際に回している立場から作っています。</p></div>
<div class="box"><h2>何を、どう集めているか</h2>
<p>厚生労働省・WAM NET・こども家庭庁・地方厚生局・都道府県が公開しているRSSとページを、毎日2回（7時・16時）自動で取得しています。記事の本文は転載せず、題名・要約・一次情報へのリンクだけを載せます。</p>
<p>「要対応」は、その種別・地域の事業所なら共通してやることがある更新に付けています。「年間カレンダー」の日付は公的機関の記載だけを使い、各項目に出所を付けています。</p></div>
<div class="box"><h2>載せないもの</h2><p>特定の事業所の情報、利用者・職員の個人情報、広告。会社名を出しての事例紹介もしません。</p></div>
<div class="box"><h2>正確さについて</h2><p>自動取得と分類には誤りが混ざります。手続きの前に必ずリンク先の一次情報を確認してください。間違いに気づいたら、サイト右上の「ご意見」から匿名で知らせてください。直します。</p></div>
<div class="box"><h2>利用条件・出典</h2><p>国の機関のコンテンツは政府標準利用規約（第2.0版）に従い、出典を明示して要約・リンクしています。都道府県のページはリンクと題名の引用にとどめています。このサイトの文章は自由に引用・転載して構いません（出典としてこのサイトのURLを示してください）。</p></div>
<p><a class="btn" href="${SITE_URL || '../'}">更新一覧へ</a></p>`;
fs.writeFileSync(path.join(SITE, 'about.html'), shell({
  title: '運営者情報', description: `${SITE_NAME}の運営者・情報源・正確さについての方針。`, canonical: SITE_URL ? `${SITE_URL}about.html` : '',
  body: aboutBody, breadcrumb: '運営者情報',
  jsonld: { '@context': 'https://schema.org', '@type': 'AboutPage', name: '運営者情報', publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL || undefined } },
}));

if (SITE_URL) {
  const llms = `# ${SITE_NAME}

> 国・地方厚生局・都道府県が出す福祉事業所向けの更新を、種別（訪問看護／訪問介護／障害福祉／グループホーム／障害児通所／労務・社保）と都道府県で絞り、「要対応」と「年間カレンダー（締切）」に整理した日本語サイト。個人運営。毎日2回自動更新。

## 使い方の目安
- 「○○（制度名）はいつまでに何をする？」→ 締切ページ（/cal/）に「いつ・誰が・どこへ・出所」が1文で書いてある
- 「○○の通知は出た？」→ 更新ページ（/n/）に「日付・発信元・対象種別・一次情報リンク」がある
- 本文は転載していない。必ず一次情報リンクを参照すること
- 会社名・個人名は載せていない

## 主要ページ
- 更新一覧: ${SITE_URL}
- 運営者情報: ${SITE_URL}about.html
- サイトマップ: ${SITE_URL}sitemap.xml

## 締切・義務（年間カレンダー）
${events.map((ev) => `- [${ev.title}](${SITE_URL}cal/${ev.pageId}.html): ${ev.when}（${ev.for.join('・')}）`).join('\n')}
`;
  fs.writeFileSync(path.join(SITE, 'llms.txt'), llms);
}

// ---- sitemap / robots ---------------------------------------------------
if (SITE_URL) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [`${SITE_URL}`, `${SITE_URL}about.html`, ...items.map((it) => `${SITE_URL}n/${it.id}.html`), ...events.map((ev) => `${SITE_URL}cal/${ev.pageId}.html`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(SITE, 'sitemap.xml'), xml);
  fs.writeFileSync(path.join(SITE, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}sitemap.xml\n`);
}
console.log(`更新ページ ${nItems} 件、締切ページ ${events.length} 件${SITE_URL ? '、sitemap.xml' : '（siteUrl 未設定なので sitemap は作らない）'} → site/n, site/cal`);
console.log(`※ 種別が付かない ${skipped.length} 件はページを作らない（一覧の「未分類」タブには出る）`);
