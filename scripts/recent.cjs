// 直近7日の更新を、AI（WebFetch）やスクリプトが読みやすい素のテキストにする。
// 使い方: node scripts/recent.cjs   （fetch.cjs のあと。build.cjs / pages.cjs とは独立）
// 出力: site/recent.txt   → 公開先 https://backoffice-shokunin.jp/update/recent.txt
// 用途: 毎朝の情報チェック（人でもAIのルーティンでも）がこれ1本を読めば、国・厚生局・県の新着を把握できる。
// 会社名・判定（match/judge）は一切出さない。

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'items.json'), 'utf8'));
const CFG = (() => { const f = path.join(ROOT, 'data', 'config.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}; })();
const SITE_URL = (CFG.siteUrl || 'https://backoffice-shokunin.jp/update/').replace(/\/?$/, '/');
const DAYS = Number(process.argv[2]) || 7;
const MAX = 300; // 初回取得直後など件数が多いときの上限（新しい順）
const idOf = (link) => crypto.createHash('sha1').update(link).digest('hex').slice(0, 10);

const cutoff = new Date(Date.now() - DAYS * 86400000).toISOString().slice(0, 10);
const items = data.items
  .filter((it) => (it.firstSeen || it.date || '') >= cutoff)
  .sort((a, b) => (b.firstSeen || b.date || '').localeCompare(a.firstSeen || a.date || '') || (b.date || '').localeCompare(a.date || ''))
  .slice(0, MAX);

const where = (it) => it.region === '県' && it.pref ? `県｜${it.pref}` : it.region === '厚生局' && it.bureau ? `厚生局｜${it.bureau}` : it.region || '';
const tagsOf = (it) => [...(it.systems || []), ...(it.tags || [])].filter(Boolean).join('・') || '未分類';

const now = new Date();
const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

const out = [];
out.push(`# 福祉行政アップデート 直近${DAYS}日の更新（自動生成 ${stamp}、${items.length}件）`);
out.push('');
out.push('形式: - [発信元｜情報源名｜種別タグ] タイトル（掲載日）');
out.push('      一次情報: URL ／ 詳細ページ: URL');
out.push('種別タグ: 医療／介護／障害／労務／補助金 と、訪問看護／訪問介護／障害福祉／グループホーム／障害児通所／労務・社保。「未分類」は自動分類で種別が付かなかったもの（福祉に関係ないことが多い）。');
out.push('本文は転載していない。金額・期限は必ず一次情報で確認すること。会社名・個人名は載せていない。');
out.push('');

let curDay = '';
for (const it of items) {
  const day = it.firstSeen || it.date || '';
  if (day !== curDay) { curDay = day; out.push(`## ${day} に拾った更新`); }
  out.push(`- [${where(it)}｜${it.source}｜${tagsOf(it)}] ${it.title}${it.date && it.date !== day ? `（掲載 ${it.date}）` : ''}`);
  out.push(`  一次情報: ${it.link} ／ 詳細ページ: ${SITE_URL}n/${idOf(it.link)}.html`);
}
if (!items.length) out.push('（この期間の更新はありません）');

out.push('');
out.push(`情報源の取得状況: ${(data.sources || []).map((s) => `${s.name}${s.error ? '（取得失敗）' : ''}`).join('、')}`);
out.push(`更新一覧: ${SITE_URL} ／ 締切カレンダー: ${SITE_URL}llms.txt`);

fs.mkdirSync(path.join(ROOT, 'site'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'site', 'recent.txt'), out.join('\n') + '\n');
console.log(`site/recent.txt: ${items.length} 件（${cutoff} 以降）、${Math.round(Buffer.byteLength(out.join('\n')) / 1024)}KB`);
