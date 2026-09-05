// 情報源からRSS／ページを取得して data/items.json に溜める。
// 使い方: node scripts/fetch.cjs
// - RSS は 1.0(RDF) / 2.0 の両方を最小実装で読む（外部ライブラリなし）
// - 既存の items.json とマージし、同じ link は上書きしない（初出日を保つ）

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'items.json');

// 全庁RSSから福祉の話だけ残すための語（県ごとの部署パスが無いときに使う）。
// ※ 2026-09-05 修正：以前は「補助金」「事業者」「指定」なども入れていたため、
//   太陽光発電の補助金や観光の事業者支援まで拾ってしまっていた。
//   福祉に固有の語（CORE）が1つも無いものは残さない。
const FUKUSHI_WORDS = /介護|障害|障がい|福祉|高齢|訪問看護|訪問介護|居宅|グループホーム|共同生活援助|放課後等デイ|児童発達|保育所等訪問|受給者証|処遇改善|運営指導|集団指導|実地指導|身体拘束|虐待|ケアマネ|地域包括|要介護|要支援|生活保護|自立支援|精神保健|医療的ケア|喀痰吸引|補装具|地域生活支援/;
// 福祉の語が入っていても、明らかに事業所向けでないものは落とす
const PREF_NG = /知事|議会|議員|選挙|職員採用|任期付|入札|落札|指名停止|表彰|コンクール|イベント|観光|農業|漁業|林業|道路|河川|下水|太陽光|蓄電池|脱炭素|移住|物産|スポーツ|文化財|美術館|図書館|統計|世論調査/;
const keepFukushi = (title) => FUKUSHI_WORDS.test(title) && !PREF_NG.test(title);

// ---- 情報源 -------------------------------------------------------------
// region: 国 / 厚生局 / 県 / 市
const SOURCES = [
  { id: 'wamnet',   name: 'WAM NET 行政情報',     region: '国',     type: 'rss', url: 'https://www.wam.go.jp/gyoseiShiryou/new_rss' },
  { id: 'mhlw',     name: '厚生労働省 新着情報',   region: '国',     type: 'rss', url: 'https://www.mhlw.go.jp/stf/news.rdf' },
  { id: 'mhlw-k',   name: '厚生労働省 緊急情報',   region: '国',     type: 'rss', url: 'https://www.mhlw.go.jp/stf/kinkyu.rdf' },
  { id: 'egov-pc',  name: 'e-Gov パブコメ',       region: '国',     type: 'rss', url: 'https://public-comment.e-gov.go.jp/rss/pcm_list.xml' },
  // bureau＝地方厚生局（8ブロック）、pref＝都道府県。読者が都道府県を選ぶと、国＋自分の厚生局＋自分の県だけが残る
  { id: 'kanto',    name: '関東信越厚生局',        region: '厚生局', bureau: '関東信越', type: 'rss', url: 'https://kouseikyoku.mhlw.go.jp/kantoshinetsu/news/news.xml' },
  { id: 'ibaraki',  name: '茨城県',               region: '県', pref: '茨城県', type: 'rss', url: 'https://www.pref.ibaraki.jp/news.xml',
    keep: (it) => /\/hokenfukushi\//.test(it.link) },
  // RSSが無いページ。<li>や<p>の中の「日付＋リンク」を拾う
  { id: 'ibaraki-shofuku', name: '茨城県 障害福祉課 お知らせ', region: '県', pref: '茨城県', type: 'page-list',
    url: 'https://www.pref.ibaraki.jp/hokenfukushi/shofuku/jiritsu/shofuku/e/01_jigyoushomuke/08_osirase.html' },
  { id: 'ibaraki-kaigo', name: '茨城県 長寿福祉課 介護保険新着', region: '県', pref: '茨城県', type: 'page-list',
    url: 'https://www.pref.ibaraki.jp/hokenfukushi/chofuku/jigyo/kaigo/index.html' },
  // 残り7つの地方厚生局（2026-09-04 夜。URLは関東信越と同じ形で全部生きていた）
  { id: 'kk-hokkaido', name: '北海道厚生局', region: '厚生局', bureau: '北海道', type: 'rss', url: 'https://kouseikyoku.mhlw.go.jp/hokkaido/news/news.xml' },
  { id: 'kk-tohoku', name: '東北厚生局', region: '厚生局', bureau: '東北', type: 'rss', url: 'https://kouseikyoku.mhlw.go.jp/tohoku/news/news.xml' },
  { id: 'kk-tokai', name: '東海北陸厚生局', region: '厚生局', bureau: '東海北陸', type: 'rss', url: 'https://kouseikyoku.mhlw.go.jp/tokaihokuriku/news/news.xml' },
  { id: 'kk-kinki', name: '近畿厚生局', region: '厚生局', bureau: '近畿', type: 'rss', url: 'https://kouseikyoku.mhlw.go.jp/kinki/news/news.xml' },
  { id: 'kk-chushi', name: '中国四国厚生局', region: '厚生局', bureau: '中国四国', type: 'rss', url: 'https://kouseikyoku.mhlw.go.jp/chugokushikoku/news/news.xml' },
  { id: 'kk-shikoku', name: '四国厚生支局', region: '厚生局', bureau: '四国', type: 'rss', url: 'https://kouseikyoku.mhlw.go.jp/shikoku/news/news.xml' },
  { id: 'kk-kyushu', name: '九州厚生局', region: '厚生局', bureau: '九州', type: 'rss', url: 'https://kouseikyoku.mhlw.go.jp/kyushu/news/news.xml' },

  // 主要県（2026-09-04 夜）。全庁RSSを部署パスか福祉の語で絞る
  // 東京都福祉局：RSSは「再配布・サイト構築に使うな」、サイトポリシーは「トップ以外へのリンクは事前許可」「非商用のみ」と明記（2026-09-04 確認）。
  // → 許可を取るまで取らない。東京の読者には「未登録」と出る
  { id: 'kanagawa', name: '神奈川県', region: '県', pref: '神奈川県', type: 'rss', url: 'https://www.pref.kanagawa.jp/prs/list.xml',
    keep: (it) => keepFukushi(it.title) },
  { id: 'osaka', name: '大阪府', region: '県', pref: '大阪府', type: 'rss', url: 'https://www.pref.osaka.lg.jp/shinchaku/shinchaku.xml',
    keep: (it) => (/\/o090/.test(it.link) || FUKUSHI_WORDS.test(it.title)) && !PREF_NG.test(it.title) },   // o090xxx＝福祉部
  { id: 'aichi', name: '愛知県', region: '県', pref: '愛知県', type: 'rss', url: 'https://www.pref.aichi.jp/rss/10/list1.xml',
    keep: (it) => /\/soshiki\/(korei|shogai|chiikifukushi|chiikihoukatu|iryofukushi|fukushi)/.test(it.link) },
  { id: 'fukuoka', name: '福岡県（健康・福祉・子育て）', region: '県', pref: '福岡県', type: 'rss', url: 'https://www.pref.fukuoka.lg.jp/rss/10/life3.xml',
    keep: (it) => keepFukushi(it.title) },
  { id: 'hokkaido', name: '北海道（保健福祉部）', region: '県', pref: '北海道', type: 'rss', url: 'https://www.pref.hokkaido.lg.jp/news/oshirase/rss.xml',
    keep: (it) => /\/hf\/(khf|shf)\//.test(it.link) },   // khf＝高齢者保健福祉課、shf＝障がい者保健福祉課

  // 千葉県（2026-09-04 追加）。高齢者福祉課は部署RSSが生きている。障害福祉事業課・障害者福祉推進課の部署RSSは2020年で止まっているので、全庁RSSをパスで絞る
  { id: 'chiba-koufuku', name: '千葉県 高齢者福祉課', region: '県', pref: '千葉県', type: 'rss', url: 'https://www.pref.chiba.lg.jp/koufuku/shinchaku.xml' },
  { id: 'chiba',         name: '千葉県',           region: '県', pref: '千葉県', type: 'rss', url: 'https://www.pref.chiba.lg.jp/homepage/shinchaku/shinchaku.xml',
    keep: (it) => /\/(shoji|shoufuku|hoken\/tetsuzuki\/kaigo|koufuku)\//.test(it.link) },
  // こども家庭庁（障害児通所支援の所管。RSSなし。新着一覧は日付＋リンクが同じ要素にある）
  { id: 'cfa', name: 'こども家庭庁 新着・更新', region: '国', type: 'page-list', url: 'https://www.cfa.go.jp/news',
    rowRe: /<section class="card">[\s\S]*?<\/section>/g },
  // ケアプランデータ連携システム（国保中央会）。2027年1月の資格確認等WEBサービスへの統合の続報が出る
  { id: 'careplan', name: 'ケアプランデータ連携システム お知らせ', region: '国', type: 'page-list',
    url: 'https://www.careplan-renkei-support.jp/info/index.html' },
  // 補助金・助成金（2026-09-04 追加）
  // WAM NET 助成・融資RSS（/shofukuGiftpub/gift_new_rss）は 2026-09-04 時点で無関係なタイトルが流れてくる壊れた状態だったので使わない
  { id: 'mhlw-koyou-josei', name: '厚生労働省 雇用関係助成金', region: '国', type: 'page-list',
    url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/index.html' },
  // 補助金の固定ページ（更新日しか無いことが多いが、日付付きの項目が出たら拾う）
  { id: 'mhlw-gyomukaizen', name: '厚生労働省 業務改善助成金', region: '国', type: 'page-list',
    url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/zigyonushi/shienjigyou/03.html' },
  { id: 'ibaraki-chinage', name: '茨城県 医療機関等 賃上げ・物価上昇支援', region: '県', pref: '茨城県', type: 'page-list',
    url: 'https://www.pref.ibaraki.jp/hokenfukushi/iryo/isei/20260225.html' },
  { id: 'ibaraki-kaigotech', name: '茨城県 介護テクノロジー定着支援', region: '県', pref: '茨城県', type: 'page-list',
    url: 'https://www.pref.ibaraki.jp/hokenfukushi/chofuku/shisetsu/kaigorobottodounyuusiennzigyou.html' },
  { id: 'ibaraki-kaigochinage', name: '茨城県 介護事業所賃上げ等支援', region: '県', pref: '茨城県', type: 'page-list',
    url: 'https://www.pref.ibaraki.jp/hokenfukushi/chofuku/jigyo/kaigo/r8chinageshien.html' },
  // 介護保険最新情報（厚労省ページ）は WAM NET 行政情報RSSに Vol.番号付きで乗ることを 2026-09-04 に確認したので取らない
];

// ---- 分類ルール（LLM化するまでの暫定。タイトルにキーワードが含まれたらタグ付け） ----
const TAGS = {
  '訪問看護': /訪問看護|診療報酬|疑義解釈|医療保険|保険医療機関|施設基準|ベースアップ評価料|訪問看護療養費|医療DX|オンライン資格確認|中央社会保険医療協議会|中医協|医療保険部会|在宅医療|看護/,
  '訪問介護': /訪問介護|介護報酬|介護保険|介護給付費分科会|介護保険最新情報|処遇改善|LIFE|総合事業|居宅サービス|ケアマネ|介護サービス|介護事業|介護施設|老人|高齢者/,
  '障害福祉': /障害(?!児)|障がい(?!児)|居宅介護|重度訪問介護|就労継続|就労移行|相談支援|自立支援|医療的ケア|難病|精神保健/,
  'グループホーム': /共同生活援助|グループホーム|地域連携推進会議|夜間支援|認知症対応型共同生活介護|入居者/,
  // 障害児通所は児童福祉法・こども家庭庁の世界なので別タブ（2026-09-04）
  '障害児通所': /児童発達支援|放課後等デイ|障害児通所|障害児支援|障害児相談|保育所等訪問|居宅訪問型児童発達|医療型児童発達|障害児入所|送迎用バス|置き去り|安全計画/,
  '労務・社保': /労働|雇用|賃金|最低賃金|労基|有給|年金|健康保険|社会保険|労災|中退共|退職金|育児休業|介護休業|ハラスメント|労働政策審議会|標準報酬|年末調整|勤労|就業|求人|ハローワーク|外国人材|技能実習|育成就労/,
};
// 制度タグ（種別タブとは別の軸。「医療保険の話か、介護保険の話か」を必ず目印として付ける）
const SYSTEMS = {
  '医療': /診療報酬|療養費|厚生局|施設基準|ベースアップ評価料|保険医療機関|中央社会保険医療協議会|中医協|医療保険部会|医療DX|オンライン資格確認|支払基金|医科|レセプト電算/,
  '介護': /介護報酬|介護保険|介護給付費|介護サービス|居宅サービス|地域支援事業|総合事業|要介護|介護予防|国保連/,
  '障害': /障害福祉|障害者総合支援|障害児|受給者証|自立支援給付|障害サービス|障害保健福祉|児童発達支援|放課後等デイ|こども家庭庁/,
  '労務': /労働|雇用|賃金|労基|有給|年金|健康保険|社会保険|労災|中退共|退職金|育児休業|介護休業|ハラスメント|源泉|年末調整|マイナンバー|定額減税/,
  // お金が貰える話は制度をまたぐので横断タグ（2026-09-04）
  '補助金': /助成金|補助金|支援金|交付金|給付金|支援事業費|(?<!意見)公募(?!要領)|公募要領|募集要項|交付要項|申請受付|融資/,
};
// タグ付けから除外するノイズ（統計・人事・議事録など）
const NOISE = /議事録|議事要旨|統計調査|結果概要|概数|人事異動|採用|募集|任期付|入札|公告|落札|調達|随意契約|情報提供依頼|風しん最新情報|麻しん最新情報|戦没者|遺骨|国家試験|キャリアコンサルタント|ご協力のお願い|開催予定/;

// ---- ユーティリティ ---------------------------------------------------------
function decode(s) {
  return (s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ').trim();
}
function pick(block, tag) {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1] : '';
}
function toISO(s) {
  if (!s) return '';
  s = s.trim();
  // 2026-09-04T11:30:00+09:00 / Wed, 04 Sep 2026 ...
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  // 令和8年9月2日 / 2026年9月2日 / 2026.9.2
  let m = s.match(/令和\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/);
  if (m) return `${2018 + +m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  m = s.match(/(\d{4})[年.\/-]\s*(\d{1,2})[月.\/-]\s*(\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  return '';
}
function absolutize(href, base) {
  try { return new URL(href, base).href; } catch { return href; }
}
function classify(title) {
  if (NOISE.test(title)) return [];
  return Object.entries(TAGS).filter(([, re]) => re.test(title)).map(([k]) => k);
}
function classifySystems(title, sourceId) {
  return Object.entries(SYSTEMS)
    .filter(([k, re]) => re.test(title))
    // パブコメの「意見公募」や医薬品審査の補助金など、福祉事業所に縁のないものは補助金タグを付けない
    .filter(([k]) => !(k === '補助金' && (sourceId === 'egov-pc' || /医薬品|医療機器|治験|研究/.test(title))))
    .map(([k]) => k);
}

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'fukushi-update-bot/0.1 (personal prototype)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // 文字コード: ヘッダ→XML宣言→metaの順で判断。Shift_JIS/EUCはTextDecoderで
  const ct = res.headers.get('content-type') || '';
  const head = buf.slice(0, 2000).toString('latin1');
  let enc = (ct.match(/charset=([\w-]+)/i) || head.match(/encoding=["']([\w-]+)["']/i) || head.match(/charset=["']?([\w-]+)/i) || [, 'utf-8'])[1].toLowerCase();
  if (enc === 'shift_jis' || enc === 'sjis' || enc === 'windows-31j') enc = 'shift_jis';
  try { return new TextDecoder(enc).decode(buf); } catch { return buf.toString('utf8'); }
}

// ---- パーサ -----------------------------------------------------------------
function parseRSS(xml, src) {
  const items = [];
  const blocks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  for (const b of blocks) {
    const title = decode(pick(b, 'title'));
    const link = decode(pick(b, 'link')) || (b.match(/rdf:about="([^"]+)"/) || [])[1] || '';
    const date = toISO(decode(pick(b, 'dc:date')) || decode(pick(b, 'pubDate')) || decode(pick(b, 'date')));
    const desc = decode(pick(b, 'description')).slice(0, 300);
    if (title && link) items.push({ title, link, date, desc });
  }
  return items;
}

// 「日付 … <a href>タイトル</a>」が同じ行（li/p/tr/dd）にある一覧を拾う汎用パーサ
// div は入れない（外側のdivが中身を丸ごと飲み込んで <p> が拾えなくなる）
function parsePageList(html, src) {
  const items = [];
  // src.rowRe があればそれで行を切る（カード型レイアウト用）。無ければ li/p/tr/dd
  const rows = html.match(src.rowRe || /<(li|p|tr|dd)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi) || [];
  for (const r of rows) {
    if (r.length > 1500) continue;
    const a = r.match(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!a) continue;
    const text = decode(r);
    // <time datetime="2026-09-04"> があればそれを優先
    const dt = r.match(/datetime="(\d{4}-\d{2}-\d{2})/);
    const date = dt ? dt[1] : toISO(text);
    // 見出し（h1〜h4）があればそれをタイトルに。無ければリンク文字列
    const h = r.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);
    // 茨城県は「令和8年7月17日「タイトル」を掲載しました。」がリンク文字列ごと入る → 日付と定型句を剥がす
    let title = decode(h ? h[1] : a[2])
      .replace(/^(令和\s*\d+\s*年\s*\d+\s*月\s*\d+\s*日|\d{4}年\d{1,2}月\d{1,2}日)\s*/, '')
      .replace(/(を|について)?(掲載|更新|公開)しました。?$/, '')
      .replace(/^「(.+)」$/, '$1');
    if (!date || !title || title.length < 4) continue;
    items.push({ title, link: absolutize(a[1], src.url), date, desc: '' });
  }
  // 同じリンクの重複を除く
  const seen = new Set();
  return items.filter((it) => (seen.has(it.link) ? false : seen.add(it.link)));
}

// ---- メイン -----------------------------------------------------------------
(async () => {
  const prev = fs.existsSync(DATA) ? JSON.parse(fs.readFileSync(DATA, 'utf8')) : { items: [] };
  const byLink = new Map(prev.items.map((it) => [it.link, it]));
  const today = new Date().toISOString().slice(0, 10);
  const report = [];
  const status = [];

  for (const src of SOURCES) {
    try {
      const body = await get(src.url);
      let items = src.type === 'rss' ? parseRSS(body, src) : parsePageList(body, src);
      if (src.keep) items = items.filter(src.keep);
      let added = 0;
      for (const it of items) {
        if (byLink.has(it.link)) continue;
        byLink.set(it.link, {
          ...it,
          source: src.name, sourceId: src.id, region: src.region, pref: src.pref || null, bureau: src.bureau || null,
          tags: classify(it.title),
          systems: classifySystems(it.title, src.id),
          firstSeen: today,
        });
        added++;
      }
      report.push(`${src.name.padEnd(20, '　')} 取得 ${String(items.length).padStart(3)} 件 / 新規 ${String(added).padStart(3)} 件`);
      status.push({ id: src.id, name: src.name, region: src.region, pref: src.pref || null, bureau: src.bureau || null, url: src.url, type: src.type, count: items.length, added, ok: true });
    } catch (e) {
      report.push(`${src.name.padEnd(20, '　')} 失敗: ${e.message}`);
      status.push({ id: src.id, name: src.name, region: src.region, pref: src.pref || null, bureau: src.bureau || null, url: src.url, type: src.type, count: 0, added: 0, ok: false, error: e.message });
    }
  }

  // 既存の項目にも分類を掛け直す（ルールを直したら反映されるように。judge / match は触らない）
  const srcById = new Map(SOURCES.map((s) => [s.id, s]));
  for (const it of byLink.values()) {
    it.tags = classify(it.title); it.systems = classifySystems(it.title, it.sourceId);
    const s = srcById.get(it.sourceId); if (s) { it.pref = s.pref || null; it.bureau = s.bureau || null; }
  }
  const items = [...byLink.values()].sort((a, b) => (b.date || b.firstSeen).localeCompare(a.date || a.firstSeen));
  fs.writeFileSync(DATA, JSON.stringify({ updated: new Date().toISOString(), sources: status, items }, null, 2));
  console.log(report.join('\n'));
  console.log(`\n合計 ${items.length} 件 → ${path.relative(ROOT, DATA)}`);
  const tagCount = {};
  for (const it of items) for (const t of it.tags) tagCount[t] = (tagCount[t] || 0) + 1;
  console.log('タグ別:', JSON.stringify(tagCount), '／ タグなし:', items.filter((i) => !i.tags.length).length);
})();
