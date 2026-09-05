// data/items.json → site/index.html
// 使い方: node scripts/build.cjs
// サーバー不要。生成した index.html は単体で開ける。

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'items.json'), 'utf8'));
const OUT = path.join(ROOT, 'site', process.argv.includes('--private') ? 'private.html' : 'index.html');

const TABS = ['訪問看護', '訪問介護', '障害福祉', 'グループホーム', '障害児通所', '労務・社保', '未分類'];
const REGIONS = ['国', '厚生局', '県', '市'];

// タブ先頭のアイコン（ピクトグラム風の塗りシルエット。currentColor なので選択時・ダークでも崩れない）
const ico = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${d}</svg>`;
const TAB_ICONS = {
  // 家＋十字（医療）
  '訪問看護': ico('<path fill-rule="evenodd" d="M12 3 2 11h3v10h14V11h3L12 3zm-1 7h2v2.5h2.5v2H13V17h-2v-2.5H8.5v-2H11V10z"/>'),
  // ハート（ケア）
  '訪問介護': ico('<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z"/>'),
  // 人（腕を広げた案内用図記号）
  '障害福祉': ico('<circle cx="12" cy="4.6" r="2.6"/><path d="M3.5 9h17v2.3h-5.6V21h-2.3v-5.2h-1.2V21H9.1v-9.7H3.5z"/>'),
  // 家＋扉（住まい）
  'グループホーム': ico('<path fill-rule="evenodd" d="M12 3 2 11h3v10h14V11h3L12 3zm-2 10h4v8h-4v-8z"/>'),
  // 星（こども）
  '障害児通所': ico('<path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>'),
  // かばん（労務）
  '労務・社保': ico('<path fill-rule="evenodd" d="M9 4h6a1 1 0 0 1 1 1v2h5v13H3V7h5V5a1 1 0 0 1 1-1zm1 3h4V6h-4v1z"/>'),
  // 丸に？
  '未分類': ico('<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 4.5a3.5 3.5 0 0 0-3.5 3.5h2a1.5 1.5 0 1 1 2.3 1.3c-.9.5-1.8 1.2-1.8 2.7v.5h2v-.4c0-.7.4-1 1.1-1.5A3.5 3.5 0 0 0 12 6.5zM11 16h2v2h-2z"/>'),
};

// 「要対応」フラグ（会社固有ではない。この種別・地域の事業所なら全部やることがあるもの）
const flagsFile = path.join(ROOT, 'data', 'flags.json');
const FLAGS = fs.existsSync(flagsFile) ? JSON.parse(fs.readFileSync(flagsFile, 'utf8')).flags : {};

// 年間カレンダー（種別・地域に共通する締切と義務。出所付き）
const calFile = path.join(ROOT, 'data', 'calendar.json');
const CAL = fs.existsSync(calFile) ? JSON.parse(fs.readFileSync(calFile, 'utf8')) : { events: [], asof: '' };
const NOW = new Date();
const THIS_MONTH = NOW.getMonth() + 1;
const MONTH_NAMES = ['毎月・随時', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const KIND_CLASS = { '提出': 'k-submit', '納付': 'k-submit', '申請': 'k-submit', '更新': 'k-submit', '確認': 'k-check', '準備': 'k-check', '予定': 'k-check', '改定': 'k-change', '義務': 'k-duty' };

// 都道府県 → 地方厚生局。読者が県を選ぶと 国＋自分の厚生局＋自分の県 だけ残る
const BUREAU_OF = {
  '北海道': '北海道',
  '青森県': '東北', '岩手県': '東北', '宮城県': '東北', '秋田県': '東北', '山形県': '東北', '福島県': '東北',
  '茨城県': '関東信越', '栃木県': '関東信越', '群馬県': '関東信越', '埼玉県': '関東信越', '千葉県': '関東信越', '東京都': '関東信越', '神奈川県': '関東信越', '新潟県': '関東信越', '山梨県': '関東信越', '長野県': '関東信越',
  '富山県': '東海北陸', '石川県': '東海北陸', '岐阜県': '東海北陸', '静岡県': '東海北陸', '愛知県': '東海北陸', '三重県': '東海北陸',
  '福井県': '近畿', '滋賀県': '近畿', '京都府': '近畿', '大阪府': '近畿', '兵庫県': '近畿', '奈良県': '近畿', '和歌山県': '近畿',
  '鳥取県': '中国四国', '島根県': '中国四国', '岡山県': '中国四国', '広島県': '中国四国', '山口県': '中国四国',
  '徳島県': '四国', '香川県': '四国', '愛媛県': '四国', '高知県': '四国',
  '福岡県': '九州', '佐賀県': '九州', '長崎県': '九州', '熊本県': '九州', '大分県': '九州', '宮崎県': '九州', '鹿児島県': '九州', '沖縄県': '九州',
};
const PREFS = Object.keys(BUREAU_OF);

// 都道府県の形（@svg-maps/japan のパスを埋め込む。ボタン先頭のピクトグラム用）
const JP_MAP = (() => { const m = require('@svg-maps/japan'); return m.default || m; })();
const ROMAJI = {
  '北海道': 'hokkaido', '青森県': 'aomori', '岩手県': 'iwate', '宮城県': 'miyagi', '秋田県': 'akita', '山形県': 'yamagata', '福島県': 'fukushima',
  '茨城県': 'ibaraki', '栃木県': 'tochigi', '群馬県': 'gunma', '埼玉県': 'saitama', '千葉県': 'chiba', '東京都': 'tokyo', '神奈川県': 'kanagawa', '新潟県': 'niigata', '山梨県': 'yamanashi', '長野県': 'nagano',
  '富山県': 'toyama', '石川県': 'ishikawa', '岐阜県': 'gifu', '静岡県': 'shizuoka', '愛知県': 'aichi', '三重県': 'mie',
  '福井県': 'fukui', '滋賀県': 'shiga', '京都府': 'kyoto', '大阪府': 'osaka', '兵庫県': 'hyogo', '奈良県': 'nara', '和歌山県': 'wakayama',
  '鳥取県': 'tottori', '島根県': 'shimane', '岡山県': 'okayama', '広島県': 'hiroshima', '山口県': 'yamaguchi',
  '徳島県': 'tokushima', '香川県': 'kagawa', '愛媛県': 'ehime', '高知県': 'kochi',
  '福岡県': 'fukuoka', '佐賀県': 'saga', '長崎県': 'nagasaki', '熊本県': 'kumamoto', '大分県': 'oita', '宮崎県': 'miyazaki', '鹿児島県': 'kagoshima', '沖縄県': 'okinawa',
};
const PREF_PATHS = {};
for (const [jp, id] of Object.entries(ROMAJI)) { const loc = JP_MAP.locations.find((l) => l.id === id); if (loc) PREF_PATHS[jp] = loc.path; }
const JP_VIEWBOX = JP_MAP.viewBox;
// 情報源が登録済みの都道府県（それ以外を選ぶと「まだ国の情報だけ」と案内する）
const COVERED_PREFS = [...new Set((data.sources || []).map((s) => s.pref).filter(Boolean))];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// 1件1ページ（scripts/pages.cjs が作る site/n/<id>.html）へのリンク用。id は pages.cjs と同じ計算
const idOf = (link) => require('crypto').createHash('sha1').update(link).digest('hex').slice(0, 10);
const jpDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const w = '日月火水木金土'[new Date(y, m - 1, d).getDay()];
  return `${m}月${d}日（${w}）`;
};
const sinceDays = (iso) => Math.floor((Date.now() - new Date(iso)) / 86400000);

// 直近30日を出す。ただし県・市のように更新がまばらな情報源は、古くても各源の最新5件は残す
const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
const rankInSource = new Map();
for (const it of data.items) { // items は新しい順に並んでいる
  const n = rankInSource.get(it.sourceId) || 0;
  it._rank = n; rankInSource.set(it.sourceId, n + 1);
}
const items = data.items.filter((it) => (it.date || it.firstSeen) >= cutoff || it._rank < 5);
const tagOf = (it) => (it.tags.length ? it.tags : ['未分類']);

const counts = {};
for (const t of TABS) counts[t] = items.filter((it) => tagOf(it).includes(t)).length;
const regionCounts = {};
for (const r of REGIONS) regionCounts[r] = items.filter((it) => it.region === r).length;

// 日付ごとにグループ
const byDate = new Map();
for (const it of items) {
  const d = it.date || it.firstSeen;
  if (!byDate.has(d)) byDate.set(d, []);
  byDate.get(d).push(it);
}

// サイト設定（ご意見フォームの送信先など）
const cfgFile = path.join(ROOT, 'data', 'config.json');
const CFG = fs.existsSync(cfgFile) ? JSON.parse(fs.readFileSync(cfgFile, 'utf8')) : {};
const FEEDBACK_ENDPOINT = CFG.feedbackEndpoint || '';
const SITE_URL = CFG.siteUrl || '';
const X_URL = CFG.xUrl || '';
// 「応援する」の受け口（config.json の support。URLが入っているものだけ出す）
const SUPPORT_DEFS = [
  { key: 'ofuse', label: 'OFUSE で応援', note: '手紙つきで少額から。匿名可' },
  { key: 'buymeacoffee', label: 'Buy Me a Coffee', note: 'コーヒー1杯分から' },
  { key: 'kofi', label: 'Ko-fi', note: '手数料なしの投げ銭' },
  { key: 'amazon', label: 'Amazon ほしい物リスト', note: '物で応援' },
  { key: 'note', label: 'note でサポート', note: '記事へのサポート機能' },
];
const SUPPORT_LINKS = SUPPORT_DEFS.filter((d) => (CFG.support || {})[d.key]).map((d) => ({ ...d, url: CFG.support[d.key] }));

// ロゴ（site/assets/logo.png を data URI で埋め込む。1ファイルで配れるように）
const logoFile = path.join(ROOT, 'site', 'assets', 'logo.png');
const LOGO = fs.existsSync(logoFile) ? `data:image/png;base64,${fs.readFileSync(logoFile).toString('base64')}` : '';

const updated = new Date(data.updated);
const updatedText = `${updated.getMonth() + 1}月${updated.getDate()}日 ${String(updated.getHours()).padStart(2, '0')}:${String(updated.getMinutes()).padStart(2, '0')} 取得`;

// 事業所ごとの判定は **非公開の個人用ビューだけ** に出す。
// 公開サイト（既定）には会社名・事業所名・判定を一切出さない。
//   node scripts/build.cjs            → site/index.html（公開用。プロフィールなし）
//   node scripts/build.cjs --private  → site/private.html（自分用。プロフィール判定つき。公開しない）
const PRIVATE = process.argv.includes('--private');
// プロフィールの一覧は data/profiles_private.json（非公開。公開リポジトリには入れない）から読む
const profFile = path.join(ROOT, 'data', 'profiles_private.json');
const PROFILES = PRIVATE && fs.existsSync(profFile) ? JSON.parse(fs.readFileSync(profFile, 'utf8')).profiles : [];
function verdict(it, pid) {
  const j = it.judge && it.judge[pid];
  if (j) return { level: j.relevance, llm: true, j };
  const m = it.match && it.match[pid];
  if (m && m.level !== 'なし') return { level: m.level, llm: false };
  return null;
}
const verdictClass = { '要対応': 'v-act', '関係あり': 'v-rel', '要確認': 'v-chk', '参考': 'v-ref', '要判断': 'v-chk' };

const rows = [...byDate.entries()].map(([d, list]) => `
  <section class="day" data-date="${d}">
    <h2 class="day-h"><time datetime="${d}">${jpDate(d)}</time><span class="day-n"></span></h2>
    <ul class="list">
      ${list.map((it) => {
        const vs = PROFILES.map((p) => ({ p, v: verdict(it, p.id) })).filter((x) => x.v && x.v.level !== '関係なし');
        const judged = vs.find((x) => x.v.llm);
        const flag = FLAGS[it.link];
        const tags = flag ? [...new Set([...tagOf(it).filter((t) => t !== '未分類'), ...flag.for])] : tagOf(it);
        const systems = flag ? [...new Set([...(it.systems || []), ...flag.systems])] : (it.systems || []);
        return `
      <li class="row${flag ? ' row-flag' : ''}" data-tags="${esc(tags.join('|'))}" data-systems="${esc(systems.join('|'))}" data-generic="${systems.includes('補助金') && tags.every((t) => t === '未分類') ? '1' : ''}" data-region="${esc(it.region)}" data-pref="${esc(it.pref || '')}" data-bureau="${esc(it.bureau || '')}"
          data-flag="${flag ? '1' : ''}" data-source="${esc(it.sourceId)}"
          data-profiles="${esc(vs.map((x) => x.p.id).join('|'))}" data-text="${esc((it.title + ' ' + it.source).toLowerCase())}">
        <span class="region region-${esc(it.region)}">${esc(it.region)}</span>
        <div class="row-main">
          <div class="title-line">
            ${flag ? '<span class="flag">要対応</span>' : ''}
            ${systems.map((s) => `<span class="sys sys-${esc(s)}">${esc(s)}</span>`).join('')}
            <a class="title" href="${esc(it.link)}" target="_blank" rel="noopener">${esc(it.title)}</a>
          </div>
          ${flag ? `<p class="judge"><b>${esc(flag.summary)}</b> — ${esc(flag.todo)}${flag.deadline ? ` <span class="deadline">期限 ${esc(flag.deadline)}</span>` : ''}<span class="scope">対象：${esc(flag.for.join('・'))}／${esc(flag.scope)}</span></p>` : ''}
          ${judged ? `<p class="judge"><b>${esc(judged.v.j.summary)}</b>${judged.v.j.action ? ` — ${esc(judged.v.j.action)}` : ''}${judged.v.j.deadline ? ` <span class="deadline">期限 ${esc(judged.v.j.deadline)}</span>` : ''}</p>` : ''}
          <div class="meta">
            <span class="src">${esc(it.source)}${it.pref ? `・${esc(it.pref)}` : ''}</span>
            <a class="more" href="n/${idOf(it.link)}.html">この更新のページ</a>
            ${tags.filter((t) => t !== '未分類').map((t) => `<span class="chip">${esc(t)}</span>`).join('')}
            ${vs.map((x) => `<span class="verdict ${verdictClass[x.v.level] || ''}" title="${x.v.llm ? esc(x.v.j.reason) : '語一致（仮）'}">${esc(x.p.label)}：${esc(x.v.level)}${x.v.llm ? '' : '?'}</span>`).join('')}
            ${it.firstSeen === new Date().toISOString().slice(0, 10) && it.date && sinceDays(it.date) <= 3 ? '<span class="new">新着</span>' : ''}
          </div>
        </div>
      </li>`; }).join('')}
    </ul>
  </section>`).join('');

// カレンダーの描画。month 0＝毎月・随時、99＝年1回など時期が固定でないもの。year があるものは一回限りの予定
function eventCard(ev) {
  const future = ev.year && (ev.year > NOW.getFullYear() || (ev.year === NOW.getFullYear() && ev.month >= THIS_MONTH));
  const past = ev.year && !future;
  return `
    <li class="ev ${KIND_CLASS[ev.kind] || ''}${past ? ' ev-past' : ''}" data-tags="${esc(ev.for.join('|'))}" data-scope="${esc(ev.scope)}" data-text="${esc(ev.title.toLowerCase())}">
      <div class="ev-when">${esc(ev.when)}</div>
      <div class="ev-main">
        <div class="title-line">
          <span class="kind">${esc(ev.kind)}</span>
          ${ev.systems.map((s) => `<span class="sys sys-${esc(s)}">${esc(s)}</span>`).join('')}
          <a class="ev-title" href="cal/${esc(ev.id)}.html">${esc(ev.title)}</a>
        </div>
        ${ev.note ? `<p class="ev-note">${esc(ev.note)}</p>` : ''}
        <div class="meta">
          ${ev.to ? `<span>提出先：${esc(ev.to)}</span>` : ''}
          ${ev.for.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}
          ${ev.scope !== '全国' ? `<span class="chip chip-pref">${esc(ev.scope)}</span>` : ''}
          <a class="src-link" href="${esc(ev.source.url)}" target="_blank" rel="noopener">出所：${esc(ev.source.name)}</a>
        </div>
      </div>
    </li>`;
}
const evByMonth = new Map();
for (const ev of CAL.events) { if (!evByMonth.has(ev.month)) evByMonth.set(ev.month, []); evByMonth.get(ev.month).push(ev); }
const monthOrder = [THIS_MONTH, ...Array.from({ length: 11 }, (_, i) => ((THIS_MONTH + i) % 12) + 1), 0, 99];
const calendarHtml = monthOrder.map((m) => {
  const list = evByMonth.get(m) || [];
  const label = m === 99 ? '年1回・数年に1回' : MONTH_NAMES[m];
  const isNow = m === THIS_MONTH;
  return `
  <section class="cal-month${isNow ? ' cal-now' : ''}" data-month="${m}">
    <h2 class="day-h"><span>${label}${isNow ? '（今月）' : m === ((THIS_MONTH % 12) + 1) ? '（来月）' : ''}</span><span class="day-n"></span></h2>
    ${list.length ? `<ul class="list">${list.map(eventCard).join('')}</ul>` : '<p class="cal-empty">登録済みの締切はありません</p>'}
  </section>`;
}).join('');

const profileCounts = {};
for (const p of PROFILES) profileCounts[p.id] = items.filter((it) => { const v = verdict(it, p.id); return v && v.level !== '関係なし'; }).length;

const sourcesPanel = (data.sources || []).map((s) => `
  <li class="srow ${s.ok ? '' : 'srow-ng'}">
    <span class="region region-${esc(s.region)}">${esc(s.region)}</span>
    <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>
    <span class="scount">${s.ok ? `${s.count}件` : '取得失敗'}</span>
    <span class="stype">${s.type === 'rss' ? 'RSS' : 'ページ'}</span>
  </li>`).join('');

const html = `<title>福祉行政アップデート${PRIVATE ? '（自分用）' : ''}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{
  --paper:#F4F6F8; --surface:#FFFFFF; --ink:#1A2230; --muted:#66707E; --line:#D6DBE2; --line-strong:#1A2230;
  --accent:#2A4D9B; --accent-ink:#FFFFFF; --accent-soft:#E4EBF8;
  --r-kuni:#4A5568; --r-kouseikyoku:#0E7C86; --r-ken:#B7791F; --r-shi:#2F855A;
  --new:#C05621;
  --s-iryo:#9B2C2C; --s-kaigo:#2A4D9B; --s-shogai:#6B46C1; --s-roumu:#4A5568;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --paper:#12161C; --surface:#1A1F27; --ink:#E7EAEF; --muted:#98A2B0; --line:#2C333E; --line-strong:#E7EAEF;
  --accent:#8EB0F2; --accent-ink:#0F1A33; --accent-soft:#22304D;
  --r-kuni:#A0AEC0; --r-kouseikyoku:#4FD1C5; --r-ken:#F6C453; --r-shi:#68D391; --new:#F6AD55;
  --s-iryo:#F98080; --s-kaigo:#8EB0F2; --s-shogai:#B794F4; --s-roumu:#A0AEC0;
}}
:root[data-theme="dark"]{
  --paper:#12161C; --surface:#1A1F27; --ink:#E7EAEF; --muted:#98A2B0; --line:#2C333E; --line-strong:#E7EAEF;
  --accent:#8EB0F2; --accent-ink:#0F1A33; --accent-soft:#22304D;
  --r-kuni:#A0AEC0; --r-kouseikyoku:#4FD1C5; --r-ken:#F6C453; --r-shi:#68D391; --new:#F6AD55;
  --s-iryo:#F98080; --s-kaigo:#8EB0F2; --s-shogai:#B794F4; --s-roumu:#A0AEC0;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:"Zen Kaku Gothic New","Hiragino Kaku Gothic ProN","Yu Gothic UI",system-ui,sans-serif;font-size:15px;line-height:1.6}
[hidden]{display:none!important}
a{color:inherit}
.wrap{max-width:1180px;margin:0 auto;padding:20px 20px 80px}
header{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 20px;position:relative;padding-bottom:18px;margin-bottom:16px}
/* 見出し下の帯。真っ黒の直線だと重いので、薄く（20%）・角丸に */
header::after{content:"";position:absolute;left:0;right:0;bottom:0;height:6px;border-radius:3px;background:color-mix(in srgb,var(--line-strong) 20%,transparent)}
header h1{font-size:28px;font-weight:900;margin:0;letter-spacing:.01em}
header .brand{display:flex;flex-direction:column;gap:6px}
header .tagline{margin:0;font-size:13px;font-weight:500;color:var(--muted);line-height:1.4}
@media (max-width:600px){header .tagline{font-size:11.5px}}
header h1.logo{margin:0;line-height:0;display:flex;align-items:center;gap:10px}
header h1.logo img{height:64px;width:auto;max-width:100%;display:block}
/* ダークではロゴの紺が沈むので、白い板に載せる */
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) header h1.logo img{background:#fff;border-radius:10px;padding:6px 12px;box-sizing:content-box} }
:root[data-theme="dark"] header h1.logo img{background:#fff;border-radius:10px;padding:6px 12px;box-sizing:content-box}
.site-foot{margin-top:56px;padding-top:22px;border-top:6px solid color-mix(in srgb,var(--line-strong) 20%,transparent);border-radius:3px 3px 0 0}
.sf-top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:16px 24px;margin-bottom:16px}
.sf-brand{display:flex;flex-direction:column;gap:2px}.sf-brand b{font-size:16px;font-weight:900}.sf-brand span{font-size:13px;color:var(--muted)}
.sf-support{display:flex;flex-direction:column;align-items:flex-start;gap:6px}
.sf-nav{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:13px;margin-bottom:14px}
.sf-nav a{color:var(--ink);text-decoration:none;border-bottom:1px solid var(--line)}.sf-nav a:hover{border-bottom-color:var(--ink)}
.sf-copy{font-size:12px;color:var(--muted);margin:10px 0 0}
.site-foot .foot{margin-top:0;border-top:0;padding-top:0}
.foot-bar{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:40px}
/* ロゴの矢印と同じ 青→緑 の塗り。角丸10px */
.sup-btn{appearance:none;border:0;background:linear-gradient(90deg,#3A6FA8 0%,#5B9BD5 45%,#7BC48A 100%);color:#fff;border-radius:10px;padding:10px 18px;font:inherit;font-weight:900;letter-spacing:.02em;cursor:pointer;box-shadow:0 2px 6px rgba(26,34,48,.15)}
.sup-btn:hover,.sup-btn:focus-visible{outline:none;filter:brightness(1.07);box-shadow:0 3px 10px rgba(26,34,48,.22)}
.foot-note{font-size:12px;color:var(--muted)}
.sup-box{max-width:520px}
.sup-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.sup-list a,.sup-link{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;border:2px solid var(--line);border-radius:10px;padding:10px 14px;background:var(--paper);color:var(--ink);text-decoration:none;font:inherit;cursor:pointer}
.sup-list a:hover,.sup-link:hover,.sup-list a:focus-visible,.sup-link:focus-visible{outline:none;border-color:var(--accent);background:var(--accent-soft)}
.sup-list b{font-weight:900}.sup-list span{font-size:12px;color:var(--muted)}
.sup-soon{border:2px dashed var(--line);border-radius:10px;padding:10px 14px;color:var(--muted);display:flex;flex-direction:column;gap:2px}
.fb-btn{appearance:none;border:2px solid var(--line);background:var(--surface);color:var(--ink);border-radius:8px;padding:6px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.fb-btn:hover,.fb-btn:focus-visible{outline:none;border-color:var(--accent)}
.fb-box{max-width:560px;display:flex;flex-direction:column;gap:10px}
.fb-box p{margin:0}
.fb-kinds{display:flex;gap:14px;flex-wrap:wrap;font-size:14px}
.fb-kinds label{display:flex;align-items:center;gap:5px;cursor:pointer}
.fb-box textarea,.fb-reply{width:100%;box-sizing:border-box;border:2px solid var(--line);background:var(--paper);color:var(--ink);border-radius:8px;padding:8px 10px;font:inherit;font-size:14px}
.fb-box textarea:focus,.fb-reply:focus{outline:none;border-color:var(--accent)}
.fb-trap{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
.fb-actions{align-items:center;gap:8px}
.fb-status{margin-right:auto;font-size:13px;color:var(--muted)}
.fb-status.ok{color:var(--r-shi);font-weight:700}
.fb-status.ng{color:var(--new);font-weight:700}
.fb-send{appearance:none;border:2px solid var(--accent);background:var(--accent);color:var(--accent-ink);border-radius:8px;padding:6px 16px;font:inherit;font-weight:900;cursor:pointer}
.fb-send[disabled]{opacity:.5;cursor:default}
.private-tag{font-size:12px;font-weight:700;line-height:1;color:var(--new);border:1px solid var(--new);border-radius:6px;padding:3px 6px}
@media (max-width:600px){header h1.logo img{height:46px}}
header .sub{color:var(--muted);font-size:13px}
header .sub b{color:var(--ink);font-weight:700}
.updated{margin-left:auto;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;color:var(--muted)}

.views{display:flex;gap:0;margin:14px 0 4px;border-bottom:2px solid var(--line)}
.view{appearance:none;border:0;border-bottom:4px solid transparent;background:transparent;color:var(--muted);padding:8px 14px 6px;font:inherit;font-weight:900;font-size:15px;cursor:pointer;margin-bottom:-2px;display:flex;align-items:center;gap:8px}
.view[aria-selected="true"]{color:var(--ink);border-bottom-color:var(--line-strong)}
.view:focus-visible{outline:none;border-bottom-color:var(--accent)}
.view .n{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;font-weight:500}
.cal-intro{max-width:65ch;font-size:13px;color:var(--muted);margin:6px 0 18px}
.cal-month{margin-bottom:22px}
.cal-now .day-h{border-bottom-width:4px}
.cal-now .day-h span:first-child{color:var(--accent)}
.cal-empty{font-size:13px;color:var(--muted);margin:4px 0 0}
.ev{display:grid;grid-template-columns:150px minmax(0,1fr);gap:12px;padding:10px 0;border-bottom:1px solid var(--line);border-left:4px solid var(--line);padding-left:10px;margin-left:-14px}
.ev:last-child{border-bottom:0}
.ev-when{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;color:var(--ink);font-weight:500;line-height:1.5;padding-top:3px}
.ev-title{font-weight:700;text-decoration:none}.ev-title:hover{text-decoration:underline}
.ev-note{margin:3px 0 0;font-size:13px;color:var(--muted)}
.kind{font-size:11px;font-weight:900;letter-spacing:.06em;border-radius:4px;padding:1px 7px;color:#fff;background:var(--muted);white-space:nowrap}
.k-submit{border-left-color:var(--new)} .k-submit .kind{background:var(--new)}
.k-change{border-left-color:var(--accent)} .k-change .kind{background:var(--accent);color:var(--accent-ink)}
.k-duty{border-left-color:var(--r-kouseikyoku)} .k-duty .kind{background:var(--r-kouseikyoku)}
.k-check{border-left-color:var(--line)}
.ev-past{opacity:.55}
.chip-pref{border-color:var(--r-ken);color:var(--r-ken)}
.src-link{font-size:12px;color:var(--muted);text-decoration:none}
.src-link:hover{text-decoration:underline}
@media (max-width:600px){.ev{grid-template-columns:1fr;gap:4px}}
.tabs{position:sticky;top:0;z-index:5;background:var(--paper);display:flex;gap:6px;flex-wrap:wrap;padding:8px 0;border-bottom:2px solid var(--line)}
.tab{appearance:none;border:2px solid var(--line);background:var(--surface);color:var(--ink);border-radius:12px;padding:8px 14px;font:inherit;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px}
.tab .n{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;color:var(--muted);font-weight:500}
.tab svg{width:17px;height:17px;flex:none;opacity:.85}
.tab[aria-selected="true"] svg{opacity:1}
.tab[aria-selected="true"]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.tab[aria-selected="true"] .n{color:var(--accent-ink);opacity:.8}
.tab:focus-visible{outline:none;border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}

.tools{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:12px 0 18px}
.filters{display:flex;gap:6px;flex-wrap:wrap}
.f{appearance:none;border:1px solid var(--line);background:var(--surface);color:var(--muted);border-radius:8px;padding:4px 10px;font:inherit;font-size:13px;cursor:pointer}
.f[aria-pressed="true"]{color:var(--ink);border-color:var(--line-strong)}
.f-label{font-size:11px;color:var(--muted);letter-spacing:.06em;align-self:center;margin:0 2px 0 6px}
.f-label:first-child{margin-left:0}
/* 発信元は「入っている」が既定。外すと点線＋取り消し線で、外れていることが分かるように */
.f-issuer[aria-pressed="true"]{background:var(--accent-soft);color:var(--ink);border-color:var(--accent)}
.f-issuer[aria-pressed="true"]::before{content:"✓ ";font-weight:700;color:var(--accent)}
.f-flag[aria-pressed="true"],.f-money[aria-pressed="true"]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.f-flag[aria-pressed="true"] .n,.f-money[aria-pressed="true"] .n{color:var(--paper);opacity:.8}
.f:focus-visible{outline:none;border-color:var(--accent)}
.search{margin-left:auto;border:2px solid var(--line);background:var(--surface);color:var(--ink);border-radius:8px;padding:6px 10px;font:inherit;min-width:220px}
.search:focus{outline:none;border-color:var(--accent)}

.grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:28px;align-items:start}
@media (max-width:860px){.grid{grid-template-columns:1fr}.aside{order:1;position:static}}
.panel summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px}
.panel summary::-webkit-details-marker{display:none}
.panel summary::after{content:"開く";margin-left:auto;font-size:12px;color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:0 6px}
.panel[open] summary::after{content:"閉じる"}
.panel summary h2{margin:0}
.panel[open] summary{margin-bottom:8px}

.day{margin-bottom:22px}
.day-h{display:flex;align-items:baseline;gap:10px;font-size:15px;font-weight:900;margin:0 0 6px;padding-bottom:4px;border-bottom:2px solid var(--line-strong)}
.day-n{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;font-weight:500;color:var(--muted)}
.list{list-style:none;margin:0;padding:0}
.row{display:grid;grid-template-columns:52px minmax(0,1fr);gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
.row:last-child{border-bottom:0}
.region{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;border-radius:6px;padding:2px 0;text-align:center;width:52px;color:#fff;align-self:start;margin-top:3px}
.region-国{background:var(--r-kuni)} .region-厚生局{background:var(--r-kouseikyoku)} .region-県{background:var(--r-ken)} .region-市{background:var(--r-shi)}
:root[data-theme="dark"] .region, :root:not([data-theme="light"]) .region{color:#12161C}
@media (prefers-color-scheme: light){ :root:not([data-theme="dark"]) .region{color:#fff} }
:root[data-theme="light"] .region{color:#fff}
.title{font-weight:500;text-decoration:none;text-wrap:pretty}
.title:hover{text-decoration:underline;text-underline-offset:3px}
.meta{display:flex;flex-wrap:wrap;gap:6px 10px;font-size:12px;color:var(--muted);margin-top:2px}
.chip{border:1px solid var(--line);border-radius:6px;padding:0 6px}
.more{color:var(--muted);text-decoration:none;border-bottom:1px dotted var(--line)}
.more:hover{color:var(--ink);border-bottom-color:var(--ink)}
.new{color:var(--new);font-weight:700}
.title-line{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px}
.sys{font-size:11px;font-weight:700;letter-spacing:.04em;border-radius:4px;padding:1px 6px;border:1px solid transparent;white-space:nowrap}
.sys-医療{color:var(--s-iryo);border-color:var(--s-iryo)} .sys-介護{color:var(--s-kaigo);border-color:var(--s-kaigo)}
.sys-障害{color:var(--s-shogai);border-color:var(--s-shogai)} .sys-労務{color:var(--s-roumu);border-color:var(--s-roumu)}
.sys-補助金{color:var(--r-ken);border-color:var(--r-ken);background:color-mix(in srgb,var(--r-ken) 12%,transparent)}
.judge{margin:4px 0 0;font-size:13px;color:var(--ink)}
.judge .deadline{color:var(--new);font-weight:700;margin-left:6px}
.flag{font-size:11px;font-weight:900;letter-spacing:.06em;border-radius:4px;padding:1px 7px;background:var(--new);color:#fff;white-space:nowrap}
.row-flag{border-left:4px solid var(--new);padding-left:10px;margin-left:-14px}
.judge .scope{display:block;color:var(--muted);font-size:12px;margin-top:2px}
.pref-btn{appearance:none;border:2px solid var(--line-strong);background:var(--surface);color:var(--ink);border-radius:10px;padding:6px 12px 6px 8px;font:inherit;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:10px;min-height:48px}
.pref-shape{width:34px;height:34px;flex:none;fill:var(--accent)}
.pref-label{display:flex;flex-direction:column;line-height:1.15;text-align:left}
.pref-label{font-size:11px;color:var(--muted);letter-spacing:.06em}
.pref-btn b{font-weight:900;font-size:16px;color:var(--ink);letter-spacing:0}
.pref-btn .caret{font-size:11px;color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:0 5px}
.pref-btn:hover,.pref-btn:focus-visible{outline:none;border-color:var(--accent)}
.pref-note{font-size:12px;color:var(--new);font-weight:700}
.modal{position:fixed;inset:0;z-index:50;background:rgba(10,14,20,.55);display:flex;align-items:center;justify-content:center;padding:20px}
.modal-box{background:var(--surface);color:var(--ink);border:6px solid var(--line-strong);border-radius:16px;padding:22px 24px;max-width:720px;width:100%;max-height:90vh;overflow:auto}
.modal-box h2{margin:0 0 6px;font-size:20px;font-weight:900;text-wrap:balance}
.modal-box p{margin:0 0 14px;font-size:13px;color:var(--muted)}
.pref-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:6px}
.pref-opt{appearance:none;border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:8px;padding:8px 4px;font:inherit;font-size:14px;cursor:pointer}
.pref-opt{position:relative}
.pref-opt.covered::before{content:"";position:absolute;top:5px;right:5px;width:7px;height:7px;border-radius:50%;background:var(--accent)}
.pref-opt:hover,.pref-opt:focus-visible{outline:none;border-color:var(--accent);background:var(--accent-soft)}
.pref-opt[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:900}
.pref-opt[aria-pressed="true"].covered::before{background:var(--accent-ink)}
.pref-actions{justify-content:space-between;gap:10px}
.pref-legend{margin-top:12px!important}
.pref-legend .dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent);margin-right:4px}
.modal-actions{display:flex;justify-content:flex-end;margin-top:6px}
.pref-all{appearance:none;border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:8px;padding:6px 12px;font:inherit;font-size:13px;cursor:pointer}
.pref-all:hover,.pref-all:focus-visible{outline:none;color:var(--ink);border-color:var(--line-strong)}
@media (prefers-reduced-motion:no-preference){.modal-box{animation:pop .18s ease-out}}
@keyframes pop{from{transform:translateY(8px);opacity:0}to{transform:none;opacity:1}}
.verdict{border-radius:6px;padding:0 7px;font-weight:700;color:var(--accent-ink);background:var(--muted)}
.v-act{background:var(--new)} .v-rel{background:var(--accent)} .v-chk{background:var(--r-ken)} .v-ref{background:var(--muted)}

.aside{position:sticky;top:64px}
.panel{border:4px solid var(--line-strong);border-radius:12px;background:var(--surface);padding:14px 16px}
.panel h2{font-size:14px;font-weight:900;margin:0 0 8px}
.panel p{margin:0 0 10px;font-size:13px;color:var(--muted)}
.slist{list-style:none;margin:0;padding:0}
.srow{display:grid;grid-template-columns:52px minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:6px 0;border-top:1px dotted var(--line);font-size:13px}
.srow a{text-decoration:none}
.srow a:hover{text-decoration:underline}
.scount,.stype{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;color:var(--muted)}
.srow-ng .scount{color:var(--new);font-weight:700}
.empty{color:var(--muted);padding:30px 0;text-align:center}
.foot{margin-top:40px;font-size:12px;color:var(--muted);border-top:1px solid var(--line);padding-top:12px;max-width:65ch}
</style>

<div class="wrap">
<header>
  <div class="brand">
  ${LOGO ? `<h1 class="logo"><img src="${LOGO}" alt="福祉行政アップデート" width="1200" height="199">${PRIVATE ? '<span class="private-tag">自分用</span>' : ''}</h1>`
         : `<h1>福祉行政アップデート${PRIVATE ? '（自分用）' : ''}</h1>`}
  <p class="tagline">国・地方厚生局・都道府県の更新を、自分の県と事業の種類だけ、見落とさない。</p>
  </div>
  <span class="sub"><b>直近30日 ${items.length}件</b></span>
  <span class="updated">${updatedText}</span>
  <button class="fb-btn" id="fb-btn" type="button" aria-haspopup="dialog">ご意見</button>
</header>

<div class="modal" id="fb-modal" role="dialog" aria-modal="true" aria-labelledby="fb-title" hidden>
  <form class="modal-box fb-box" id="fb-form" autocomplete="off">
    <h2 id="fb-title">ご意見・間違いの指摘</h2>
    <p>誤字・古い日付・抜けている情報・欲しい機能など、なんでも。匿名で届きます。個人名・事業所名・利用者の情報は書かないでください。</p>
    <div class="fb-kinds" role="radiogroup" aria-label="種類">
      <label><input type="radio" name="kind" value="誤り" checked> 間違い・古い</label>
      <label><input type="radio" name="kind" value="要望"> 要望</label>
      <label><input type="radio" name="kind" value="その他"> その他</label>
    </div>
    <textarea name="message" id="fb-message" rows="5" maxlength="2000" required placeholder="例：訪問看護の定例報告は8月1日基準に変わっています"></textarea>
    <input class="fb-trap" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="modal-actions fb-actions">
      <span class="fb-status" id="fb-status" aria-live="polite"></span>
      <button type="button" class="pref-all" id="fb-cancel">やめる</button>
      <button type="submit" class="fb-send" id="fb-send">送る</button>
    </div>
  </form>
</div>

<div class="views" role="tablist" aria-label="表示">
  <button class="view" data-view="list" aria-selected="true">更新一覧</button>
  <button class="view" data-view="cal" aria-selected="false">年間カレンダー <span class="n">${CAL.events.length}</span></button>
</div>

<div class="tabs" role="tablist">
  ${TABS.map((t, i) => `<button class="tab" role="tab" data-tab="${t}" aria-selected="${i === 0}">${TAB_ICONS[t] || ''}${t}<span class="n">${counts[t]}</span></button>`).join('')}
</div>

<div class="tools">
  <button class="pref-btn" id="pref-btn" type="button" aria-haspopup="dialog">
    <svg class="pref-shape" id="pref-shape" viewBox="${JP_VIEWBOX}" aria-hidden="true"><g id="pref-shape-g"></g></svg>
    <span class="pref-label">都道府県<b id="pref-cur">全国</b></span>
    <span class="caret">変更</span>
  </button>
  <span class="pref-note" id="pref-note" hidden></span>
  <div class="filters" aria-label="発信元で絞る">
    <span class="f-label">発信元</span>
    <button class="f f-issuer" data-region="" aria-pressed="true">すべて <span class="n">${items.length}</span></button>
    ${REGIONS.filter((r) => regionCounts[r] > 0).map((r) => `<button class="f f-issuer" data-region="${r}" aria-pressed="false">${r} <span class="n">${regionCounts[r]}</span></button>`).join('')}
    <span class="f-label">しぼる</span>
    <button class="f f-flag" data-flag="1" aria-pressed="false">要対応だけ <span class="n">${items.filter((it) => FLAGS[it.link]).length}</span></button>
    <button class="f f-money" data-money="1" aria-pressed="false">補助金だけ <span class="n">${items.filter((it) => (it.systems || []).includes('補助金') || (FLAGS[it.link] && FLAGS[it.link].systems.includes('補助金'))).length}</span></button>
  </div>
  ${PROFILES.length ? `<div class="filters" aria-label="事業所で絞る">
    ${PROFILES.map((p) => `<button class="f f-profile" data-profile="${p.id}" aria-pressed="false">${p.label}に関係あり <span class="n">${profileCounts[p.id]}</span></button>`).join('')}
  </div>` : ''}
  <input class="search" type="search" placeholder="タイトルで探す（例：処遇改善）" aria-label="タイトルで探す">
</div>

<div class="grid">
  <main>
    <div id="view-list">
    ${rows}
    <p class="empty" hidden>この条件に当てはまる更新はありません。</p>
    </div>
    <div id="view-cal" hidden>
      <p class="cal-intro">その種別の事業所なら共通してやることを、今月から順に。日付は公的機関の記載だけを使い、各項目に出所を付けています（${esc(CAL.asof)}時点）。年・都道府県で変わるものは「例年」「県の案内で確認」と書いています。</p>
      ${calendarHtml}
    </div>
  </main>
  <aside class="aside">
    <details class="panel" id="src-panel">
      <summary><h2>情報源 ${(data.sources || []).length}本</h2></summary>
      <p>RSSがあるものはそのまま、無いものはページを読んで日付付きの項目を拾っています。</p>
      <ul class="slist">${sourcesPanel}</ul>
    </details>
  </aside>
</div>

<div class="modal" id="pref-modal" role="dialog" aria-modal="true" aria-labelledby="pref-title" hidden>
  <div class="modal-box">
    <h2 id="pref-title">どこの都道府県の事業所ですか？</h2>
    <p>国の情報に加えて、選んだ都道府県と地方厚生局の情報だけを出します。複数選べます。あとからいつでも変えられます。</p>
    <div class="pref-grid">
      ${PREFS.map((p) => `<button type="button" class="pref-opt${COVERED_PREFS.includes(p) ? ' covered' : ''}" data-pref="${p}">${p.replace(/[都府県]$/, '')}</button>`).join('')}
    </div>
    <p class="pref-legend"><span class="dot"></span> 印のある県は県の情報源も登録済み。それ以外は今のところ国と厚生局の情報になります。</p>
    <div class="modal-actions pref-actions">
      <button type="button" class="pref-all" id="pref-clear">選ばずに全国を見る</button>
      <button type="button" class="fb-send" id="pref-done">この県で見る</button>
    </div>
  </div>
</div>

<footer class="site-foot">
  <div class="sf-top">
    <div class="sf-brand">
      <b>福祉行政アップデート</b>
      <span>国・地方厚生局・都道府県の更新を、自分の県と事業の種類だけ、見落とさない。</span>
    </div>
    <div class="sf-support">
      <button class="sup-btn" id="sup-btn" type="button" aria-haspopup="dialog">♡ このサイトを応援する</button>
      <span class="foot-note">個人運営・無料。続けるための応援を受け付けています。</span>
    </div>
  </div>
  <nav class="sf-nav" aria-label="フッター">
    <a href="./">更新一覧</a>
    <a href="#" id="sf-cal">年間カレンダー</a>
    <a href="about.html">運営者情報</a>
    ${X_URL ? `<a href="${esc(X_URL)}" target="_blank" rel="noopener">X @fukushi_update</a>` : ''}
    <a href="#" id="sf-fb">ご意見・間違いの指摘</a>
    <a href="sitemap.xml">サイトマップ</a>
  </nav>
  <p class="foot">分類はタイトルのキーワードによる仮のものです。必ずリンク先の一次情報を確認してください。国の機関のページは政府標準利用規約（第2.0版）に基づき出典を明示して要約・リンクしています。</p>
  <p class="sf-copy">© ${NOW.getFullYear()} バックオフィス職人</p>
</footer>

<div class="modal" id="sup-modal" role="dialog" aria-modal="true" aria-labelledby="sup-title" hidden>
  <div class="modal-box sup-box">
    <h2 id="sup-title">応援の方法</h2>
    <p>どれか1つで十分です。お金がかからない方法もあります。</p>
    <ul class="sup-list">
      ${X_URL ? `<li><a href="${esc(X_URL)}" target="_blank" rel="noopener"><b>Xでフォロー・リポスト</b><span>0円。いちばん助かります</span></a></li>` : ''}
      <li><button type="button" class="sup-link" id="sup-share"><b>このサイトを同業の人に教える</b><span>0円。URLをコピーします</span></button></li>
      <li><button type="button" class="sup-link" id="sup-feedback"><b>間違い・要望を送る</b><span>0円。サイトが良くなります</span></button></li>
      ${SUPPORT_LINKS.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener"><b>${esc(s.label)}</b><span>${esc(s.note)}</span></a></li>`).join('')}
      ${SUPPORT_LINKS.length ? '' : '<li class="sup-soon"><b>お金での応援</b><span>受け口を準備中です</span></li>'}
    </ul>
    <div class="modal-actions"><span class="fb-status" id="sup-status" aria-live="polite"></span><button type="button" class="pref-all" id="sup-close">閉じる</button></div>
  </div>
</div>
</div>

<script>
(function(){
  var tabs=[].slice.call(document.querySelectorAll('.tab'));
  var fs=[].slice.call(document.querySelectorAll('.f:not(.f-profile):not(.f-flag):not(.f-money)'));
  var pfs=[].slice.call(document.querySelectorAll('.f-profile'));
  var flagBtn=document.querySelector('.f-flag');
  var moneyBtn=document.querySelector('.f-money'); var moneyOnly=false;
  var prefBtn=document.getElementById('pref-btn');
  var prefCur=document.getElementById('pref-cur');
  var prefNote=document.getElementById('pref-note');
  var modal=document.getElementById('pref-modal');
  var BUREAU=${JSON.stringify(BUREAU_OF)};
  var COVERED=${JSON.stringify(COVERED_PREFS)};
  var views=[].slice.call(document.querySelectorAll('.view'));
  var viewList=document.getElementById('view-list'), viewCal=document.getElementById('view-cal');
  var evs=[].slice.call(document.querySelectorAll('.ev'));
  var months=[].slice.call(document.querySelectorAll('.cal-month'));
  var view='list';
  try{view=localStorage.getItem('fukushi-view')||'list';}catch(e){}
  var profileOn=null, flagOnly=false, prefs=[], asked=false;
  try{prefs=JSON.parse(localStorage.getItem('fukushi-prefs')||'[]'); asked=localStorage.getItem('fukushi-pref-asked')==='1';
      var old=localStorage.getItem('fukushi-pref'); if(!prefs.length&&old)prefs=[old];}catch(e){}
  if(!Array.isArray(prefs))prefs=[]; prefs=prefs.filter(function(p){return BUREAU[p];});
  var pref=prefs[0]||'';                       // 旧コード互換（単一参照している箇所用）
  function myBureaus(){ return prefs.map(function(p){return BUREAU[p];}); }
  function prefLabel(){ return prefs.length? prefs.map(function(p){return p.replace(/[都府県]$/,'');}).join('・')+'県' : '全国'; }
  var PATHS=${JSON.stringify(PREF_PATHS)};
  var shapeG=document.getElementById('pref-shape-g'), shapeSvg=document.getElementById('pref-shape');
  function drawShape(){
    // 県が選ばれていれば その県（複数なら全部）の形、未選択なら日本全体
    var ids=prefs.length?prefs:Object.keys(PATHS);
    shapeG.innerHTML=ids.map(function(k){return '<path d="'+PATHS[k]+'"/>';}).join('');
    try{
      var b=shapeG.getBBox(); var pad=Math.max(b.width,b.height)*0.08;
      var s=Math.max(b.width,b.height)+pad*2;   // 正方形に収める
      shapeSvg.setAttribute('viewBox',(b.x+b.width/2-s/2)+' '+(b.y+b.height/2-s/2)+' '+s+' '+s);
    }catch(e){ shapeSvg.setAttribute('viewBox','${JP_VIEWBOX}'); }
  }
  var prefOpts=[].slice.call(modal.querySelectorAll('.pref-opt'));
  function paintOpts(){ prefOpts.forEach(function(b){b.setAttribute('aria-pressed',prefs.indexOf(b.dataset.pref)>=0);}); }
  function commitPrefs(){
    pref=prefs[0]||''; prefCur.textContent=prefLabel(); drawShape(); paintOpts();
    try{localStorage.setItem('fukushi-prefs',JSON.stringify(prefs));localStorage.setItem('fukushi-pref-asked','1');}catch(e){}
    asked=true; modal.hidden=true; apply();
  }
  function openModal(){ paintOpts(); modal.hidden=false; var first=modal.querySelector(prefs[0]?'[data-pref="'+prefs[0]+'"]':'.pref-opt'); if(first)first.focus(); }
  prefCur.textContent=prefLabel(); drawShape(); paintOpts();
  prefBtn.addEventListener('click',openModal);
  prefOpts.forEach(function(b){b.addEventListener('click',function(){
    var p=b.dataset.pref, i=prefs.indexOf(p);
    if(i>=0)prefs.splice(i,1); else prefs.push(p);
    paintOpts();
  });});
  document.getElementById('pref-done').addEventListener('click',commitPrefs);
  document.getElementById('pref-clear').addEventListener('click',function(){ prefs=[]; commitPrefs(); });
  modal.addEventListener('click',function(e){if(e.target===modal&&asked)commitPrefs();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!modal.hidden&&asked)commitPrefs();});
  if(!asked)openModal();   // 初回だけ開いた瞬間に聞く
  // 情報源の枠：広い画面では開いた状態、スマホでは畳んで一覧の下に
  if(window.innerWidth>860)document.getElementById('src-panel').open=true;

  // ---- 応援モーダル ---------------------------------------------------
  var supModal=document.getElementById('sup-modal'), supStatus=document.getElementById('sup-status');
  function supOpen(){ supModal.hidden=false; supStatus.textContent=''; }
  function supClose(){ supModal.hidden=true; }
  document.getElementById('sup-btn').addEventListener('click',supOpen);
  document.getElementById('sup-close').addEventListener('click',supClose);
  supModal.addEventListener('click',function(e){ if(e.target===supModal)supClose(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!supModal.hidden)supClose(); });
  document.getElementById('sup-share').addEventListener('click',function(){
    var url=${JSON.stringify(SITE_URL)}||location.href.split('#')[0];
    var text='福祉行政アップデート：国・厚生局・県の更新を、自分の県と事業の種類だけ、見落とさない '+url;
    if(navigator.share){ navigator.share({title:'福祉行政アップデート',text:text,url:url}).catch(function(){}); return; }
    (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(function(){ supStatus.textContent='URLをコピーしました'; supStatus.className='fb-status ok'; })
      .catch(function(){ supStatus.textContent=url; supStatus.className='fb-status'; });
  });
  document.getElementById('sup-feedback').addEventListener('click',function(){ supClose(); fbOpen(); });
  document.getElementById('sf-fb').addEventListener('click',function(e){ e.preventDefault(); fbOpen(); });
  document.getElementById('sf-cal').addEventListener('click',function(e){ e.preventDefault(); view='cal'; try{localStorage.setItem('fukushi-view','cal');}catch(err){} apply(); window.scrollTo({top:0,behavior:'smooth'}); });

  // ---- ご意見モーダル -------------------------------------------------
  var FB_ENDPOINT=${JSON.stringify(FEEDBACK_ENDPOINT)};
  var fbModal=document.getElementById('fb-modal'), fbForm=document.getElementById('fb-form'), fbStatus=document.getElementById('fb-status'), fbSend=document.getElementById('fb-send');
  function fbOpen(){ fbModal.hidden=false; fbStatus.textContent=''; fbStatus.className='fb-status'; document.getElementById('fb-message').focus(); }
  function fbClose(){ fbModal.hidden=true; }
  document.getElementById('fb-btn').addEventListener('click',fbOpen);
  document.getElementById('fb-cancel').addEventListener('click',fbClose);
  fbModal.addEventListener('click',function(e){ if(e.target===fbModal)fbClose(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!fbModal.hidden)fbClose(); });
  fbForm.addEventListener('submit',function(e){
    e.preventDefault();
    var fd=new FormData(fbForm);
    if(String(fd.get('message')||'').trim().length<5){ fbStatus.textContent='もう少し具体的に書いてください'; fbStatus.className='fb-status ng'; return; }
    // 連投防止：同じブラウザから1分に1回
    var last=0; try{ last=+localStorage.getItem('fukushi-fb-last')||0; }catch(err){}
    if(Date.now()-last<60000){ fbStatus.textContent='少し時間をおいてから送ってください'; fbStatus.className='fb-status ng'; return; }
    if(!FB_ENDPOINT){ fbStatus.textContent='送信先の準備中です。もう少しお待ちください'; fbStatus.className='fb-status ng'; return; }
    fd.append('page', location.href.split('#')[0].slice(0,200)); fd.append('pref', prefs.join('・')); fd.append('tab', state.tab||'');
    fbSend.disabled=true; fbStatus.textContent='送信中…'; fbStatus.className='fb-status';
    // GAS は multipart/form-data を e.parameter に入れてくれないので、URLSearchParams（＝application/x-www-form-urlencoded）で送る
    fetch(FB_ENDPOINT,{method:'POST',mode:'no-cors',body:new URLSearchParams(fd)}).then(function(){
      try{ localStorage.setItem('fukushi-fb-last',String(Date.now())); }catch(err){}
      fbStatus.textContent='届きました。ありがとうございます'; fbStatus.className='fb-status ok';
      fbForm.reset(); setTimeout(fbClose,1500);
    }).catch(function(){
      fbStatus.textContent='送れませんでした。時間をおいて試してください'; fbStatus.className='fb-status ng';
    }).finally(function(){ fbSend.disabled=false; });
  });
  var q=document.querySelector('.search');
  var rows=[].slice.call(document.querySelectorAll('.row'));
  var days=[].slice.call(document.querySelectorAll('.day'));
  var empty=document.querySelector('.empty');
  var state={tab:'${TABS[0]}',region:'',q:''};   // region: '' ＝すべて
  try{var s=JSON.parse(localStorage.getItem('fukushi-update')||'null');if(s&&s.tab)state.tab=s.tab;}catch(e){}

  function inMyArea(r){
    if(!prefs.length)return true;                              // 県を選んでいなければ全国
    if(r.dataset.region==='国')return true;                    // 国はいつも
    if(r.dataset.region==='厚生局')return myBureaus().indexOf(r.dataset.bureau)>=0;
    return prefs.indexOf(r.dataset.pref)>=0;                   // 県・市は選んだ県だけ
  }
  function apply(){
    var shown=0;
    fs.forEach(function(b){b.setAttribute('aria-pressed',b.dataset.region===state.region);});
    var uncovered=prefs.filter(function(p){return COVERED.indexOf(p)<0;});
    prefNote.hidden=!uncovered.length;
    prefNote.textContent=uncovered.length?uncovered.join('・')+'の情報源はまだ登録されていません。国と厚生局の情報だけ出しています':'';
    // 種別タブ → 発信元 → 都道府県 → 検索 の順に絞り、最後に「要対応だけ」「補助金だけ」を重ねる（タブは効いたまま）
    var nFlag=0, nMoney=0;
    rows.forEach(function(r){
      var tabOk = profileOn ? r.dataset.profiles.split('|').indexOf(profileOn)>=0
        : (r.dataset.tags.split('|').indexOf(state.tab)>=0 || (r.dataset.generic==='1' && state.tab!=='未分類'));
      var base = tabOk
        && (!state.region || r.dataset.region===state.region)
        && inMyArea(r)
        && (!state.q||r.dataset.text.indexOf(state.q)>=0);
      var isFlag=r.dataset.flag==='1', isMoney=r.dataset.systems.split('|').indexOf('補助金')>=0;
      if(base&&isFlag)nFlag++; if(base&&isMoney)nMoney++;
      var ok=base && (!flagOnly||isFlag) && (!moneyOnly||isMoney);
      r.hidden=!ok; if(ok)shown++;
    });
    flagBtn.querySelector('.n').textContent=nFlag; moneyBtn.querySelector('.n').textContent=nMoney;
    days.forEach(function(d){
      var n=d.querySelectorAll('.row:not([hidden])').length;
      d.hidden=n===0; d.querySelector('.day-n').textContent=n+'件';
    });
    empty.hidden=shown>0;
    // カレンダー側：種別タブ・都道府県・検索だけ効く（発信元・要対応は一覧専用）
    evs.forEach(function(ev){
      var ok=(state.tab==='未分類' || ev.dataset.tags.split('|').indexOf(state.tab)>=0)
        && (ev.dataset.scope==='全国' || !prefs.length || prefs.indexOf(ev.dataset.scope)>=0)
        && (!state.q||ev.dataset.text.indexOf(state.q)>=0);
      ev.hidden=!ok;
    });
    months.forEach(function(m){
      var n=m.querySelectorAll('.ev:not([hidden])').length;
      m.querySelector('.day-n').textContent=n?n+'件':'';
      var emptyP=m.querySelector('.cal-empty'); if(emptyP)emptyP.hidden=n>0;
      var ul=m.querySelector('.list'); if(ul)ul.hidden=n===0;
    });
    viewList.hidden=view!=='list'; viewCal.hidden=view!=='cal';
    views.forEach(function(v){v.setAttribute('aria-selected',v.dataset.view===view);});
    [].slice.call(document.querySelectorAll('.filters')).forEach(function(f){f.hidden=view==='cal';});
    tabs.forEach(function(t){t.setAttribute('aria-selected',t.dataset.tab===state.tab);});
    try{localStorage.setItem('fukushi-update',JSON.stringify({tab:state.tab}));}catch(e){}
  }
  tabs.forEach(function(t){t.addEventListener('click',function(){state.tab=t.dataset.tab;apply();});});
  fs.forEach(function(b){b.addEventListener('click',function(){ state.region=b.dataset.region; apply(); });});
  q.addEventListener('input',function(){state.q=q.value.trim().toLowerCase();apply();});
  views.forEach(function(v){v.addEventListener('click',function(){
    view=v.dataset.view; try{localStorage.setItem('fukushi-view',view);}catch(e){} apply();
  });});
  flagBtn.addEventListener('click',function(){ flagOnly=!flagOnly; flagBtn.setAttribute('aria-pressed',flagOnly); apply(); });
  moneyBtn.addEventListener('click',function(){ moneyOnly=!moneyOnly; moneyBtn.setAttribute('aria-pressed',moneyOnly); apply(); });
  // 事業所フィルタは排他。押すと種別タブを無視して「その事業所に関係あるもの」だけを出す
  pfs.forEach(function(b){b.addEventListener('click',function(){
    profileOn = profileOn===b.dataset.profile ? null : b.dataset.profile;
    pfs.forEach(function(x){x.setAttribute('aria-pressed',x.dataset.profile===profileOn);});
    tabs.forEach(function(t){t.disabled=!!profileOn;});
    apply();
  });});
  apply();
})();
</script>
`;

fs.writeFileSync(OUT, html);
console.log(`${items.length} 件（直近30日）→ ${path.relative(ROOT, OUT)}`);
console.log('タブ別:', JSON.stringify(counts), '／ 発信元別:', JSON.stringify(regionCounts));
