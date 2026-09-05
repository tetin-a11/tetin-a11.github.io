import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const site = JSON.parse(await fs.readFile(path.join(root, 'site.config.json'), 'utf8'));
const games = JSON.parse(await fs.readFile(path.join(root, 'content', 'games.json'), 'utf8'));

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function parseArticle(source, slug) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${slug}: front matter がありません`);
  const meta = Object.fromEntries(match[1].split(/\r?\n/).filter(Boolean).map((line) => {
    const separator = line.indexOf(':');
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  }));
  return { ...meta, slug, tags: (meta.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean), body: match[2].trim() };
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let paragraph = [];
  let listType = '';
  let code = [];
  let inCode = false;
  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (listType) html.push(`</${listType}>`);
    listType = '';
  };
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = [];
        inCode = false;
      } else {
        flushParagraph(); flushList(); inCode = true;
      }
      continue;
    }
    if (inCode) { code.push(line); continue; }
    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      const level = heading[1].length;
      const id = heading[2].replace(/[\s　]+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '').toLowerCase();
      html.push(`<h${level} id="${id}">${inlineMarkdown(heading[2])}</h${level}>`);
    } else if (ordered || bullet) {
      flushParagraph();
      const nextType = ordered ? 'ol' : 'ul';
      if (listType !== nextType) { flushList(); html.push(`<${nextType}>`); listType = nextType; }
      html.push(`<li>${inlineMarkdown((ordered || bullet)[1])}</li>`);
    } else if (line.startsWith('> ')) {
      flushParagraph(); flushList(); html.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
    } else if (!line.trim()) {
      flushParagraph(); flushList();
    } else {
      paragraph.push(line.trim());
    }
  }
  flushParagraph(); flushList();
  return html.join('\n');
}

const articleFiles = (await fs.readdir(path.join(root, 'content', 'articles'))).filter((file) => file.endsWith('.md'));
const articles = await Promise.all(articleFiles.map(async (file) => parseArticle(
  await fs.readFile(path.join(root, 'content', 'articles', file), 'utf8'),
  file.replace(/\.md$/, '')
)));
articles.sort((a, b) => b.date.localeCompare(a.date));

const icon = (name) => ({
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2Z"/><path d="m18 16 .7 2.3L21 19l-2.3.7L18 22l-.7-2.3L15 19l2.3-.7L18 16Z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
  bot: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M9 12h.01M15 12h.01M9 16h6M12 7V3m-2 0h4"/></svg>',
  game: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h10a5 5 0 0 1 4.7 6.7l-1.1 3.1a2.2 2.2 0 0 1-3.7.8L15 17H9l-1.9 1.6a2.2 2.2 0 0 1-3.7-.8l-1.1-3.1A5 5 0 0 1 7 8Z"/><path d="M7 12v4m-2-2h4m7-1h.01m2 2h.01"/></svg>',
  tool: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4l-3 3-3-3 3-3Z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4Z"/><path d="M7 16h11M8 8h6m-6 4h6"/></svg>'
}[name] || '');

function header(active = '') {
  const items = [['lab','実験室'], ['roadmap','ゲームを作る'], ['ai','AI魔改造'], ['play','Google Play公開'], ['games','作ったゲーム']];
  return `<header class="site-header" data-header>
    <a class="brand" href="${active ? '../' : '#top'}" aria-label="できるかな魔改造 ホーム">
      <span class="brand-mark"><i></i><i></i><i></i></span>
      <span><b>できるかな魔改造</b><small>AI GAME LAB.</small></span>
    </a>
    <button class="menu-button" type="button" aria-expanded="false" aria-controls="site-nav" data-menu>${icon('tool')}<span>MENU</span></button>
    <nav id="site-nav" class="site-nav" aria-label="メインナビゲーション">
      ${items.map(([id, label]) => `<a href="${active ? '../' : ''}#${id}">${label}</a>`).join('')}
    </nav>
    <a class="header-cta" href="${active ? '../' : ''}#roadmap">START LAB ${icon('arrow')}</a>
  </header>`;
}

function footer(prefix = '') {
  return `<footer class="site-footer">
    <div class="footer-brand"><span class="brand-mark"><i></i><i></i><i></i></span><div><b>できるかな魔改造</b><small>AI GAME LAB. / BY TETIN</small></div></div>
    <p>失敗は、次の魔改造パーツ。</p>
    <div class="footer-links"><a href="${prefix}#roadmap">ゲームを作る</a><a href="${prefix}#lab">実験室</a><a href="${prefix}#games">作ったゲーム</a></div>
    <small class="copyright">© 2026 TETIN. BUILT WITH AI, TESTED BY HUMAN.</small>
  </footer>`;
}

function gameVisual(game, large = false) {
  return `<div class="game-visual ${large ? 'game-visual--large' : ''} accent-${game.accent}" aria-hidden="true">
    <span class="visual-grid"></span><span class="orb orb-a"></span><span class="orb orb-b"></span>
    <span class="pixel-creature"><i></i><i></i><i></i><i></i></span>
    <span class="game-number">#${game.number}</span>
    <span class="scanline"></span>
  </div>`;
}

function gameCard(game) {
  return `<article class="game-card reveal">
    <a href="games/${game.slug}.html" class="game-card-link" aria-label="${escapeHtml(game.title)}の詳細">
      ${gameVisual(game)}
      <div class="game-card-body">
        <div class="eyebrow"><span>GAME #${game.number}</span><span>${escapeHtml(game.status)}</span></div>
        <h3>${escapeHtml(game.title)}</h3>
        <p>${escapeHtml(game.summary)}</p>
        <div class="tag-row">${game.stack.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
        <span class="text-link">開発ログを見る ${icon('arrow')}</span>
      </div>
    </a>
  </article>`;
}

function articleCard(article, index) {
  return `<article class="article-card reveal">
    <a href="articles/${article.slug}.html">
      <div class="article-index">0${index + 1}<span></span></div>
      <div class="article-meta"><span>${escapeHtml(article.category)}</span><time datetime="${article.date}">${article.date.replaceAll('-', '.')}</time></div>
      <h3>${escapeHtml(article.title)}</h3>
      <p>${escapeHtml(article.description)}</p>
      <div class="article-foot"><span>${escapeHtml(article.readTime)} READ</span><span class="round-arrow">↗</span></div>
    </a>
  </article>`;
}

function documentShell({ title, description, canonical, body, active = '', schema = '' }) {
  return `<!doctype html>
<html lang="ja"><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}"><meta name="theme-color" content="#fffefa">
  <meta property="og:type" content="${active ? 'article' : 'website'}"><meta property="og:locale" content="ja_JP">
  <meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:site_name" content="${site.name}">
  <meta property="og:image" content="${site.url}/assets/og-image.svg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="${active ? '../' : ''}assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="${active ? '../' : ''}assets/styles.css">
  ${schema ? `<script type="application/ld+json">${schema}</script>` : ''}
</head><body><a class="skip-link" href="#main">本文へスキップ</a>${header(active)}${body}${footer(active ? '../' : '')}<script src="${active ? '../' : ''}assets/main.js" defer></script></body></html>`;
}

const featured = games[0];
const experiments = [
  ['EXP. 001', 'AIだけでゲームは作れる？', 'AIに企画・実装・デバッグを頼み、人間は判断だけで完成まで行けるか。', '進行中', '62%'],
  ['EXP. 002', '初心者でも7日で公開できる？', '1日ごとの作業時間と詰まった場所を、隠さずタイムライン化。', '準備中', '18%'],
  ['EXP. 003', '15秒広告をAIだけで作れる？', 'ゲーム画面から構成、コピー、動画素材までAIで組み立てる。', '計画中', '04%']
];
const roadmap = [
  ['01','ゲームを企画する','遊びの芯を1文にする'], ['02','環境を作る','Unity / Expo / Android'], ['03','AIに書いてもらう','小さく頼んで動かす'],
  ['04','素材を作る','画像・キャラ・効果音'], ['05','ゲームを動かす','端末テストで壊す'], ['06','AIで魔改造する','失敗ログから強くする']
];
const playSteps = [['企画','IDEA'],['AI','PROMPT'],['開発','BUILD'],['テスト','TEST'],['ストア素材','ASSET'],['審査','REVIEW'],['公開','SHIP'],['AdMob','EARN']];

const homeBody = `<main id="main">
  <section class="hero" id="top">
    <div class="hero-noise"></div><div class="hero-wire wire-a"></div><div class="hero-wire wire-b"></div>
    <div class="hero-copy">
      <div class="status-pill"><span></span> LAB STATUS: MAKING</div>
      <p class="hero-kicker">AI × GAME × MA-KAIZO</p>
      <h1><span>できるかな</span><em>魔改造</em></h1>
      <p class="hero-lead">AIと一緒なら、<br>ゲームはどこまで作れる？</p>
      <p class="hero-sub">企画 → 開発 → 魔改造 → Google Play公開まで、<br class="desktop-only">初心者目線で全部やってみる。</p>
      <div class="hero-actions"><a class="button button-primary" href="#roadmap">魔改造をはじめる ${icon('arrow')}</a><a class="button button-ghost" href="#lab">実験ログをのぞく</a></div>
      <div class="hero-stats"><div><b>06</b><span>GAMES BUILT</span></div><div><b>∞</b><span>TRIAL & ERROR</span></div><div><b>01</b><span>HUMAN + AI</span></div></div>
    </div>
    <div class="hero-machine" aria-label="AI、ゲーム、魔改造が接続された実験装置のイラスト">
      <div class="machine-label">MODIFICATION UNIT / 01</div>
      <div class="machine-screen"><span class="screen-grid"></span><div class="screen-face"><i></i><i></i><b></b></div><p>READY TO<br><strong>MA-KAIZO?</strong></p><span class="screen-cursor"></span></div>
      <div class="machine-flow"><div>${icon('bot')}<span>AI</span></div><b>+</b><div>${icon('game')}<span>GAME</span></div><b>+</b><div>${icon('tool')}<span>改造</span></div></div>
      <div class="machine-controls"><span class="dial"></span><span class="meter"><i></i></span><span class="light"></span><span class="light"></span><span class="light active"></span></div>
      <div class="machine-tape">CAUTION: IDEAS MAY MUTATE</div>
    </div>
    <a class="scroll-cue" href="#now"><span></span>SCROLL TO EXPERIMENT</a>
  </section>

  <section class="section now-section" id="now"><div class="section-head reveal"><div><p class="section-code">// CURRENT MODIFICATION</p><h2>今回の<span>魔改造</span></h2></div><p>完成より、変化の途中がおもしろい。<br>いま実験台に載っているプロジェクト。</p></div>
    <div class="current-project reveal"><div class="current-visual">${gameVisual(featured, true)}<div class="floating-note note-one">AI UI TUNING <b>03</b></div><div class="floating-note note-two">PLAY FEEL <b>++</b></div></div>
      <div class="current-info"><div class="project-flags"><span>GAME #${featured.number}</span><span class="live-dot">LIVE LOG</span></div><p class="mono">PROJECT / ${featured.slug.toUpperCase()}</p><h3>${featured.title}</h3><p>${featured.summary} 見た目だけでなく「触って気持ちいい」を作れるか、AIとの対話を修理記録ごと公開します。</p>
      <div class="progress-label"><span>MODIFICATION PROGRESS</span><b>62%</b></div><div class="progress"><i style="width:62%"></i></div>
      <dl><div><dt>今回の課題</dt><dd>宝石の手触りを強くする</dd></div><div><dt>AIの担当</dt><dd>演出案 / コード改善 / 比較</dd></div><div><dt>人間の担当</dt><dd>遊んで判断する</dd></div></dl>
      <a class="text-link" href="games/${featured.slug}.html">実験ログを最初から読む ${icon('arrow')}</a></div></div>
  </section>

  <section class="section latest-game"><div class="mini-label reveal">LATEST OUTPUT / GAME #${featured.number}</div><div class="latest-layout">
    <div class="latest-copy reveal"><p class="section-code">// NEWEST GAME</p><h2>AIと磨いた、<br><span>最新ゲーム。</span></h2><p>作って終わりではなく、公開したあとも数字と反応を見て魔改造。開発期間、使ったAI、失敗した実装まで一本のログにします。</p><div class="spec-grid"><div><span>PLATFORM</span><b>Android</b></div><div><span>STATUS</span><b>In progress</b></div><div><span>DEVELOPER</span><b>TETIN</b></div><div><span>VERSION</span><b>Lab build</b></div></div><a class="button button-outline" href="games/${featured.slug}.html">ゲーム詳細を見る ${icon('arrow')}</a></div>
    <div class="phone-stage reveal"><div class="phone phone-back"><div class="phone-screen accent-violet"><span class="gem gem-1"></span><span class="gem gem-2"></span><span class="gem gem-3"></span><b>PEARL<br>GEM</b></div></div><div class="phone phone-front"><div class="phone-screen accent-lime"><span class="score">SCORE 02480</span><div class="gem-board">${Array.from({length:16},(_,i)=>`<i class="g${(i%5)+1}"></i>`).join('')}</div><span class="swipe">SWIPE →</span></div></div><span class="phone-caption">SCREEN MOCK / ART IN PROGRESS</span></div>
  </div></section>

  <section class="section lab-section" id="lab"><div class="section-head section-head-light reveal"><div><p class="section-code">// DEKIRUKANA LABORATORY</p><h2>できるかな<span>実験室</span></h2></div><p>「本当にできる？」を、やって確かめる。<br>失敗も数字もノーカット。</p></div><div class="experiment-grid">${experiments.map(([no,title,desc,status,progress], index) => `<article class="experiment-card reveal"><div class="experiment-top"><span>${no}</span><span class="experiment-status">${status}</span></div><div class="experiment-icon exp-${index}">${[icon('bot'),icon('clock'),icon('spark')][index]}</div><h3>${title}</h3><p>${desc}</p><div class="experiment-meter"><i style="width:${progress}"></i><b>${progress}</b></div><a href="#articles">仮説と途中経過を見る ${icon('arrow')}</a></article>`).join('')}</div><div class="lab-principle reveal"><span>LAB RULE / 01</span><p>成功だけを見せない。</p><b>仮説 → 方法 → 問題発生 → 魔改造 → 結果 → 評価</b></div></section>

  <section class="section roadmap-section" id="roadmap"><div class="section-head reveal"><div><p class="section-code">// BUILD YOUR FIRST GAME</p><h2>ゲームを作る<span>6 STEP</span></h2></div><p>知識ゼロから、端末で遊べるところまで。<br>ひとつずつ配線していこう。</p></div><div class="roadmap">${roadmap.map(([no,title,desc], index) => `<article class="road-step reveal"><span class="step-no">STEP ${no}</span><div class="step-node">${[icon('spark'),icon('tool'),icon('bot'),icon('game'),icon('arrow'),icon('tool')][index]}</div><h3>${title}</h3><p>${desc}</p><a href="#articles" aria-label="${title}の記事を見る">↗</a></article>`).join('')}</div><div class="roadmap-cta reveal"><div><span>DON'T KNOW WHERE TO START?</span><h3>最初の30分を、一緒に。</h3></div><a class="button button-dark" href="articles/ai-game-first-step.html">はじめてのゲーム企画 ${icon('arrow')}</a></div></section>

  <section class="section ai-section" id="ai"><div class="ai-heading reveal"><p class="section-code">// AI MODIFICATION TOOLKIT</p><h2>AIは、答えを出す機械じゃない。<br><span>一緒に直す相棒だ。</span></h2></div><div class="ai-layout"><div class="prompt-window reveal"><div class="window-bar"><span></span><span></span><span></span><b>PROMPT_LOG_004.txt</b></div><div class="prompt-body"><p class="prompt-label">YOU / 14:32</p><p>このゲームの操作が気持ちよくありません。<br><mark>コードを全部書き直さず</mark>、原因を3つに絞ってください。</p><p class="prompt-label ai-label">AI / 14:32</p><p>まず入力遅延、フィードバック、難易度曲線を分けて計測しましょう。最初の確認は…<span class="cursor">_</span></p></div><div class="window-result"><span>RESULT</span><b>「なんとなく」を、直せる課題に変換。</b></div></div><div class="ai-tools">${[['01','企画する','アイデアを遊べるサイズまで削る'],['02','コードを書く','機能を小さく分けて実装する'],['03','デバッグする','エラーの原因と確認手順を残す'],['04','素材を作る','世界観を揃えて試作を速くする'],['05','公開を助ける','ストア文案や画像構成を比較する']].map(([no,title,desc])=>`<article class="ai-tool reveal"><span>${no}</span><div><h3>${title}</h3><p>${desc}</p></div><b>↗</b></article>`).join('')}</div></div></section>

  <section class="section play-section" id="play"><div class="section-head reveal"><div><p class="section-code">// ROAD TO GOOGLE PLAY</p><h2>作った。その先の<span>公開まで。</span></h2></div><p>初めて詰まるのは、コードだけじゃない。<br>AABも審査も収益化も、一本道にする。</p></div><div class="play-track reveal">${playSteps.map(([ja,en],i)=>`<div class="play-step"><span>${String(i+1).padStart(2,'0')}</span><div class="play-node">${i===6?'✓':''}</div><b>${ja}</b><small>${en}</small></div>`).join('')}</div><div class="warning-strip reveal"><span>REAL TROUBLE LOG</span><p>審査で止まった場所、作り直した画像、分かりにくかった設定も記録します。</p><a href="articles/play-release-map.html">公開ロードマップを見る ${icon('arrow')}</a></div></section>

  <section class="section articles-section" id="articles"><div class="section-head reveal"><div><p class="section-code">// LATEST FIELD NOTES</p><h2>最新の<span>修理ログ</span></h2></div><p>うまくいったコードより、<br>どう直したかを持ち帰ろう。</p></div><div class="article-grid">${articles.slice(0,3).map(articleCard).join('')}</div><div class="center-action reveal"><a class="button button-outline" href="#articles">すべての記事を見る ${icon('arrow')}</a></div></section>

  <section class="section games-section" id="games"><div class="section-head section-head-light reveal"><div><p class="section-code">// BUILT IN THIS GARAGE</p><h2>作った<span>ゲーム</span></h2></div><p>GAME #01から、ひとつずつ。<br>公開後の数字もアップデートします。</p></div><div class="games-grid">${games.map(gameCard).join('')}</div><div class="games-footer reveal"><p><b>06</b> GAMES & COUNTING</p><a class="button button-primary" href="${site.googlePlayDeveloperUrl}" target="_blank" rel="noopener">Google Playで見る ${icon('arrow')}</a></div></section>

  <section class="section beginner-section"><div class="beginner-box reveal"><div class="beginner-copy"><p class="section-code">// BEGINNER SAFE ZONE</p><h2>わからない言葉は、<br><span>ここで分解。</span></h2><p>専門用語を、別の専門用語で説明しません。<br>いま必要な意味だけ、短く。</p><a class="text-link" href="#glossary">初心者向け用語集へ ${icon('arrow')}</a></div><div class="term-cloud" id="glossary">${[['AAB','Google Playへ渡す\nアプリの箱'],['API','サービス同士の\n受け渡し窓口'],['AdMob','ゲームに広告を\n表示する仕組み'],['Git','変更を巻き戻せる\n作業記録'],['Unity','ゲームを組み立てる\n開発ツール'],['APK','端末へ入れて試す\nアプリの形']].map(([term,desc])=>`<div><b>${term}</b><span>${desc.replace('\n','<br>')}</span></div>`).join('')}</div></div></section>

  <section class="final-cta"><div class="bolt bolt-left"></div><div class="bolt bolt-right"></div><p>CAN I BUILD A GAME WITH AI?</p><h2>「できるかな？」を、<br><span>動くゲームに。</span></h2><a class="button button-primary" href="#roadmap">魔改造をはじめる ${icon('arrow')}</a><small>NO EXPERIENCE REQUIRED / CURIOSITY RECOMMENDED</small></section>
</main>`;

const homeSchema = JSON.stringify({ '@context':'https://schema.org', '@type':'WebSite', name:site.name, alternateName:site.englishName, url:site.url, description:site.description, author:{'@type':'Person',name:site.author}}, null, 0).replaceAll('<','\\u003c');
const home = documentShell({ title:`${site.name} | AIと一緒なら、ゲームはどこまで作れる？`, description:site.description, canonical:site.url, body:homeBody, schema:homeSchema });

function articlePage(article) {
  const body = `<main id="main" class="detail-main"><div class="detail-rail" aria-hidden="true">FIELD NOTE / ${article.date.replaceAll('-','.')}</div><article class="detail-article"><header class="detail-hero"><a class="back-link" href="../#articles">← 最新記事へ戻る</a><div class="detail-meta"><span>${escapeHtml(article.status)}</span><time datetime="${article.date}">${article.date.replaceAll('-','.')}</time><span>${escapeHtml(article.readTime)} READ</span></div><p class="section-code">// ${escapeHtml(article.category)}</p><h1>${escapeHtml(article.title)}</h1><p class="detail-description">${escapeHtml(article.description)}</p><div class="tag-row">${article.tags.map(t=>`<span># ${escapeHtml(t)}</span>`).join('')}</div></header><div class="article-prose">${markdownToHtml(article.body)}</div><aside class="article-next"><span>NEXT EXPERIMENT</span><h2>読んだら、小さく試そう。</h2><a class="button button-primary" href="../#roadmap">魔改造をはじめる ${icon('arrow')}</a></aside></article></main>`;
  const schema = JSON.stringify({'@context':'https://schema.org','@type':'Article',headline:article.title,description:article.description,datePublished:article.date,author:{'@type':'Person',name:site.author},publisher:{'@type':'Organization',name:site.name},mainEntityOfPage:`${site.url}/articles/${article.slug}.html`}).replaceAll('<','\\u003c');
  return documentShell({title:`${article.title} | ${site.name}`, description:article.description, canonical:`${site.url}/articles/${article.slug}.html`, body, active:'article', schema});
}

function gamePage(game) {
  const difficulty = '●'.repeat(game.difficulty) + '○'.repeat(5-game.difficulty);
  const body = `<main id="main" class="detail-main game-detail"><div class="detail-rail" aria-hidden="true">GAME ARCHIVE / #${game.number}</div><article class="detail-article"><header class="game-detail-hero"><div>${gameVisual(game,true)}</div><div class="game-detail-copy"><a class="back-link" href="../#games">← ゲーム一覧へ戻る</a><p class="section-code">// GAME #${game.number} / ${escapeHtml(game.genre)}</p><h1>${escapeHtml(game.title)}</h1><p>${escapeHtml(game.summary)}</p><div class="tag-row">${game.stack.map(t=>`<span>${escapeHtml(t)}</span>`).join('')}</div><a class="button button-primary" href="${game.playUrl}" target="_blank" rel="noopener">Google Playで確認 ${icon('arrow')}</a></div></header><section class="game-facts"><div><span>開発期間</span><b>${escapeHtml(game.period)}</b></div><div><span>開発難易度</span><b class="difficulty">${difficulty}</b></div><div><span>公開状況</span><b>${escapeHtml(game.publishedAt)}</b></div><div><span>ダウンロード</span><b>${escapeHtml(game.downloads)}</b></div><div><span>広告収益</span><b>${escapeHtml(game.revenue)}</b></div></section><section class="article-prose"><h2>AIを使ったところ</h2><ul>${game.ai.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul><h2>開発ログ</h2><p>このゲームで使ったプロンプト、失敗した実装、修正の判断、アップデート履歴をここへ追記していきます。未確認の実績値は推測せず「集計中」としています。</p><blockquote>LAB NOTE: 完成画面だけでなく、そこへ至る修理跡を残します。</blockquote></section></article></main>`;
  return documentShell({title:`${game.title} — GAME #${game.number} | ${site.name}`,description:game.summary,canonical:`${site.url}/games/${game.slug}.html`,body,active:'game'});
}

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(path.join(dist, 'assets'), { recursive: true });
await fs.mkdir(path.join(dist, 'articles'), { recursive: true });
await fs.mkdir(path.join(dist, 'games'), { recursive: true });
await fs.writeFile(path.join(dist, 'index.html'), home);
await fs.copyFile(path.join(root, 'src', 'styles.css'), path.join(dist, 'assets', 'styles.css'));
await fs.copyFile(path.join(root, 'src', 'main.js'), path.join(dist, 'assets', 'main.js'));
await fs.copyFile(path.join(root, 'src', 'favicon.svg'), path.join(dist, 'assets', 'favicon.svg'));
await fs.copyFile(path.join(root, 'src', 'og-image.svg'), path.join(dist, 'assets', 'og-image.svg'));
await Promise.all(articles.map((article) => fs.writeFile(path.join(dist, 'articles', `${article.slug}.html`), articlePage(article))));
await Promise.all(games.map((game) => fs.writeFile(path.join(dist, 'games', `${game.slug}.html`), gamePage(game))));
await fs.writeFile(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);
const sitemapEntries = [
  { path: '', lastmod: site.lastUpdated },
  ...(site.legacyPaths || []),
  ...articles.map(article => ({ path: `articles/${article.slug}.html`, lastmod: article.date })),
  ...games.map(game => ({ path: `games/${game.slug}.html`, lastmod: site.lastUpdated }))
];
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...sitemapEntries.map(entry => `  <url>\n    <loc>${site.url}/${entry.path}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n  </url>`),
  '</urlset>',
  ''
].join('\n');
await fs.writeFile(path.join(dist, 'sitemap.xml'), sitemap);
console.log(`Built ${1 + articles.length + games.length} pages → ${path.relative(root, dist)}`);
