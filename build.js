// build.js
// 這支腳本示範「內容與版型分離」：
//   內容 (content/articles/*.md) —— 只放文字，不含任何 HTML 版面
//   版型 (templates/*.html)      —— 只放版面結構，用 {{PLACEHOLDER}} 標記內容要插入的位置
//   建置後 (output/*.html)       —— 產生一般的靜態 HTML，可直接放上任何虛擬主機
//
// 未來新增文章：只要在 content/articles 新增一個 .md 檔案，重新執行
//   node build.js
// 選單、頁首頁尾、分類列表頁都會自動更新，不需要手動改任何 HTML。

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const MarkdownIt = require("markdown-it");
const md = new MarkdownIt();

const ROOT = __dirname;
const CONTENT_DIR = path.join(ROOT, "content/articles");
const TEMPLATE_DIR = path.join(ROOT, "templates");
const OUTPUT_DIR = path.join(ROOT, "output");
const SITE_URL = "https://www.dajia01.com.tw"; // 示範用網址

const CATEGORY_META = {
  "company-registration": { name: "公司登記", description: "公司登記、商業登記等設立登記相關說明。" },
  "registered-address": { name: "公司登記地址", description: "公司登記地址的合法性、房屋稅相關說明。" },
  processing: { name: "帳務處理", description: "商業會計法規、憑證留存與稅捐稽徵相關的帳務處理說明。" },
  "tax-consulting": { name: "稅務申報諮詢", description: "稅務申報與合法節稅諮詢相關說明。" },
  "labor-insurance": { name: "勞健保專區", description: "公司負責人與員工的勞保、健保、勞退相關說明。" },
  "licensed-industry": { name: "特許行業登記", description: "須經政府許可之特許行業登記相關說明。" },
  "foreign-investment": { name: "外國人投資", description: "華僑或外國人來台投資設立事業相關說明。" },
};

const NEWS_CATEGORY_META = {
  "tax-news": { name: "稅務新聞", description: "稅務相關法規、申報期限與政策異動消息。" },
  announcements: { name: "本所公告", description: "事務所公休、服務調整等公告事項。" },
};

const PAGES_DIR = path.join(ROOT, "content/pages");
const NEWS_CONTENT_DIR = path.join(ROOT, "content/news");

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATE_DIR, name), "utf-8");
}

function fill(template, data) {
  return template.replace(/{{(\w+)}}/g, (_, key) => (data[key] !== undefined ? data[key] : ""));
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function loadArticlesFrom(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  return files.map((file) => {
    const raw = fs.readFileSync(path.join(dir, file), "utf-8");
    const { data, content } = matter(raw);
    const slug = file.replace(/\.md$/, "");
    return {
      slug,
      title: data.title,
      description: data.description,
      excerpt: data.excerpt,
      category: data.category,
      categorySlug: data.categorySlug,
      date: data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date),
      contentHtml: md.render(content),
    };
  });
}

function loadArticles() {
  return loadArticlesFrom(CONTENT_DIR);
}

function loadNewsArticles() {
  return loadArticlesFrom(NEWS_CONTENT_DIR);
}

function renderPage({ title, description, canonical, assetPath, nav, body }) {
  const layout = readTemplate("layout.html");
  // nav can be: home | news | about | services | links | contact
  // any category/article page passes nav="services" or nav="news" so the matching tab stays highlighted
  return fill(layout, {
    TITLE: title,
    DESCRIPTION: description,
    CANONICAL: canonical,
    ASSET_PATH: assetPath,
    NAV_HOME: nav === "home" ? "current" : "",
    NAV_NEWS: nav === "news" ? "current" : "",
    NAV_ABOUT: nav === "about" ? "current" : "",
    NAV_SERVICES: nav === "services" ? "current" : "",
    NAV_LINKS: nav === "links" ? "current" : "",
    NAV_CONTACT: nav === "contact" ? "current" : "",
    BODY: body,
  });
}

function buildArticlePages(articles) {
  const tpl = readTemplate("article-body.html");
  ensureDir(path.join(OUTPUT_DIR, "articles"));
  articles.forEach((a) => {
    const body = fill(tpl, {
      ASSET_PATH: "../",
      SECTION_NAME: "服務內容",
      SECTION_LINK: "../services/index.html",
      CATEGORY_LINK: `../services/${a.categorySlug}.html`,
      CATEGORY_NAME: a.category,
      TITLE: a.title,
      DATE: a.date,
      CONTENT_HTML: a.contentHtml,
    });
    const html = renderPage({
      title: `${a.title}｜${a.category}｜大佳稅務記帳士事務所`,
      description: a.description,
      canonical: `${SITE_URL}/articles/${a.slug}.html`,
      assetPath: "../",
      nav: "services",
      body,
    });
    fs.writeFileSync(path.join(OUTPUT_DIR, "articles", `${a.slug}.html`), html);
    console.log("生成文章頁：", `output/articles/${a.slug}.html`);
  });
}

function buildCategoryPages(articles) {
  const tpl = readTemplate("category-body.html");
  ensureDir(path.join(OUTPUT_DIR, "services"));
  Object.keys(CATEGORY_META).forEach((slug) => {
    const meta = CATEGORY_META[slug];
    const items = articles
      .filter((a) => a.categorySlug === slug)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map(
        (a) => `<li>
          <h3><a href="../articles/${a.slug}.html">${a.title}</a></h3>
          <p class="excerpt">${a.excerpt || ""}</p>
          <time datetime="${a.date}">${a.date}</time>
        </li>`
      )
      .join("\n");
    const body = fill(tpl, {
      SECTION_NAME: "服務內容",
      CATEGORY_NAME: meta.name,
      CATEGORY_DESCRIPTION: meta.description,
      ARTICLE_ITEMS: items,
    });
    const html = renderPage({
      title: `${meta.name}｜大佳稅務記帳士事務所`,
      description: meta.description,
      canonical: `${SITE_URL}/services/${slug}.html`,
      assetPath: "../",
      nav: "services",
      body,
    });
    fs.writeFileSync(path.join(OUTPUT_DIR, "services", `${slug}.html`), html);
    console.log("生成分類頁：", `output/services/${slug}.html`);
  });
}

function buildNewsArticlePages(articles) {
  const tpl = readTemplate("article-body.html");
  ensureDir(path.join(OUTPUT_DIR, "news/articles"));
  articles.forEach((a) => {
    const meta = NEWS_CATEGORY_META[a.categorySlug] || { name: a.category };
    const body = fill(tpl, {
      ASSET_PATH: "../../",
      SECTION_NAME: "最新消息",
      SECTION_LINK: "../index.html",
      CATEGORY_LINK: `../${a.categorySlug}.html`,
      CATEGORY_NAME: meta.name,
      TITLE: a.title,
      DATE: a.date,
      CONTENT_HTML: a.contentHtml,
    });
    const html = renderPage({
      title: `${a.title}｜${meta.name}｜大佳稅務記帳士事務所`,
      description: a.description,
      canonical: `${SITE_URL}/news/articles/${a.slug}.html`,
      assetPath: "../../",
      nav: "news",
      body,
    });
    fs.writeFileSync(path.join(OUTPUT_DIR, "news/articles", `${a.slug}.html`), html);
    console.log("生成最新消息文章頁：", `output/news/articles/${a.slug}.html`);
  });
}

function buildNewsCategoryPages(articles) {
  const tpl = readTemplate("category-body.html");
  ensureDir(path.join(OUTPUT_DIR, "news"));
  Object.keys(NEWS_CATEGORY_META).forEach((slug) => {
    const meta = NEWS_CATEGORY_META[slug];
    const items = articles
      .filter((a) => a.categorySlug === slug)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map(
        (a) => `<li>
          <h3><a href="articles/${a.slug}.html">${a.title}</a></h3>
          <p class="excerpt">${a.excerpt || ""}</p>
          <time datetime="${a.date}">${a.date}</time>
        </li>`
      )
      .join("\n");
    const body = fill(tpl, {
      SECTION_NAME: "最新消息",
      CATEGORY_NAME: meta.name,
      CATEGORY_DESCRIPTION: meta.description,
      ARTICLE_ITEMS: items,
    });
    const html = renderPage({
      title: `${meta.name}｜大佳稅務記帳士事務所`,
      description: meta.description,
      canonical: `${SITE_URL}/news/${slug}.html`,
      assetPath: "../",
      nav: "news",
      body,
    });
    fs.writeFileSync(path.join(OUTPUT_DIR, "news", `${slug}.html`), html);
    console.log("生成最新消息分類頁：", `output/news/${slug}.html`);
  });
}

function buildNewsOverview(articles) {
  const tpl = readTemplate("news-overview-body.html");
  ensureDir(path.join(OUTPUT_DIR, "news"));
  const cards = Object.keys(NEWS_CATEGORY_META)
    .map((slug) => {
      const meta = NEWS_CATEGORY_META[slug];
      const count = articles.filter((a) => a.categorySlug === slug).length;
      return `<div class="category-card">
        <h2><a href="${slug}.html">${meta.name}</a></h2>
        <p>${meta.description}</p>
        <span class="count">共 ${count} 篇文章</span>
      </div>`;
    })
    .join("\n");
  const body = fill(tpl, { CATEGORY_CARDS: cards });
  const html = renderPage({
    title: "最新消息｜大佳稅務記帳士事務所",
    description: "大佳稅務記帳士事務所最新消息：稅務新聞與本所公告。",
    canonical: `${SITE_URL}/news/index.html`,
    assetPath: "../",
    nav: "news",
    body,
  });
  fs.writeFileSync(path.join(OUTPUT_DIR, "news", "index.html"), html);
  console.log("生成最新消息總覽頁：output/news/index.html");
}

// 首頁「服務特色」用的簡易 icon 集合（沿用網站的 brass 主色，line-icon 風格，避免額外依賴外部圖示庫）
const FEATURE_ICONS = {
  bolt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
  tag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.41l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42Z"></path><circle cx="7.5" cy="7.5" r="1.2"></circle></svg>`,
  badge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"></circle><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"></path></svg>`,
};

function buildHomePage(articles, newsArticles, pages) {
  const tpl = readTemplate("home-body.html");
  const cards = Object.keys(CATEGORY_META)
    .map((slug) => {
      const meta = CATEGORY_META[slug];
      const count = articles.filter((a) => a.categorySlug === slug).length;
      return `<div class="category-card">
        <h2><a href="services/${slug}.html">${meta.name}</a></h2>
        <p>${meta.description}</p>
        <span class="count">共 ${count} 篇文章</span>
      </div>`;
    })
    .join("\n");

  const features = (pages["home-features"] && pages["home-features"].features) || [];
  const featureCards = features
    .map(
      (f) => `<div class="feature-card">
        <div class="feature-icon">${FEATURE_ICONS[f.icon] || ""}</div>
        <h3>${f.title}</h3>
        <p>${f.text}</p>
      </div>`
    )
    .join("\n");

  const newsItems = newsArticles
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 3)
    .map((a) => {
      const catName = (NEWS_CATEGORY_META[a.categorySlug] || {}).name || a.category;
      return `<li>
        <h3><a href="news/articles/${a.slug}.html">${a.title}</a></h3>
        <p class="excerpt">${a.excerpt || ""}</p>
        <time datetime="${a.date}">${a.date}　${catName}</time>
      </li>`;
    })
    .join("\n");

  const body = fill(tpl, { CATEGORY_CARDS: cards, FEATURE_CARDS: featureCards, NEWS_ITEMS: newsItems });
  const html = renderPage({
    title: "大佳稅務記帳士事務所｜台北公司登記／記帳報稅",
    description: "大佳稅務記帳士事務所提供公司登記、記帳報稅、帳務處理與稅務申報諮詢服務。",
    canonical: `${SITE_URL}/index.html`,
    assetPath: "",
    nav: "home",
    body,
  });
  fs.writeFileSync(path.join(OUTPUT_DIR, "index.html"), html);
  console.log("生成首頁：output/index.html");
}

function buildServicesOverview(articles) {
  const tpl = readTemplate("services-overview-body.html");
  ensureDir(path.join(OUTPUT_DIR, "services"));
  const cards = Object.keys(CATEGORY_META)
    .map((slug) => {
      const meta = CATEGORY_META[slug];
      const count = articles.filter((a) => a.categorySlug === slug).length;
      return `<div class="category-card">
        <h2><a href="${slug}.html">${meta.name}</a></h2>
        <p>${meta.description}</p>
        <span class="count">共 ${count} 篇文章</span>
      </div>`;
    })
    .join("\n");
  const body = fill(tpl, { CATEGORY_CARDS: cards });
  const html = renderPage({
    title: "服務內容｜大佳稅務記帳士事務所",
    description: "大佳稅務記帳士事務所服務內容總覽：公司登記、帳務處理、稅務申報諮詢、勞健保轉區、特許行業登記、外國人投資。",
    canonical: `${SITE_URL}/services/index.html`,
    assetPath: "../",
    nav: "services",
    body,
  });
  fs.writeFileSync(path.join(OUTPUT_DIR, "services", "index.html"), html);
  console.log("生成服務總覽頁：output/services/index.html");
}

function loadPages() {
  const files = fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith(".md"));
  const pages = {};
  files.forEach((file) => {
    const raw = fs.readFileSync(path.join(PAGES_DIR, file), "utf-8");
    const { data, content } = matter(raw);
    const key = file.replace(/\.md$/, "");
    pages[key] = { ...data, contentHtml: md.render(content) };
  });
  return pages;
}

function buildAboutPage(pages) {
  const p = pages.about;
  if (!p) return;
  const tpl = readTemplate("page-body.html");
  const body = fill(tpl, { TITLE: p.title, CONTENT_HTML: p.contentHtml });
  const html = renderPage({
    title: `${p.title}｜大佳稅務記帳士事務所`,
    description: p.description || "",
    canonical: `${SITE_URL}/about.html`,
    assetPath: "",
    nav: "about",
    body,
  });
  fs.writeFileSync(path.join(OUTPUT_DIR, "about.html"), html);
  console.log("生成事務所簡介頁：output/about.html");
}

function buildLinksPage(pages) {
  const p = pages.links;
  if (!p) return;
  const tpl = readTemplate("page-body.html");
  const body = fill(tpl, { TITLE: p.title, CONTENT_HTML: p.contentHtml });
  const html = renderPage({
    title: `${p.title}｜大佳稅務記帳士事務所`,
    description: p.description || "",
    canonical: `${SITE_URL}/links.html`,
    assetPath: "",
    nav: "links",
    body,
  });
  fs.writeFileSync(path.join(OUTPUT_DIR, "links.html"), html);
  console.log("生成友站連結頁：output/links.html");
}

function buildContactPage(pages) {
  const p = pages.contact;
  if (!p) return;
  const tpl = readTemplate("contact-body.html");
  const body = fill(tpl, {
    OFFICE_NAME: p.office_name,
    ADDRESS: p.address,
    ADDRESS_ENCODED: encodeURIComponent(p.address || ""),
    PHONE: p.phone,
    PHONE_TEL: (p.phone || "").replace(/[^0-9+]/g, ""),
    MOBILE: p.mobile,
    MOBILE_TEL: (p.mobile || "").replace(/[^0-9+]/g, ""),
    EMAIL: p.email,
    HOURS: p.hours,
    CONTENT_HTML: p.contentHtml,
  });
  const html = renderPage({
    title: `${p.title}｜大佳稅務記帳士事務所`,
    description: p.description || "",
    canonical: `${SITE_URL}/contact.html`,
    assetPath: "",
    nav: "contact",
    body,
  });
  fs.writeFileSync(path.join(OUTPUT_DIR, "contact.html"), html);
  console.log("生成聯絡我們頁：output/contact.html");
}

function copyAssets() {
  ensureDir(path.join(OUTPUT_DIR, "assets"));
  fs.copyFileSync(path.join(ROOT, "assets/style.css"), path.join(OUTPUT_DIR, "assets/style.css"));
}

function main() {
  const articles = loadArticles();
  const newsArticles = loadNewsArticles();
  const pages = loadPages();
  buildArticlePages(articles);
  buildCategoryPages(articles);
  buildServicesOverview(articles);
  buildNewsArticlePages(newsArticles);
  buildNewsCategoryPages(newsArticles);
  buildNewsOverview(newsArticles);
  buildAboutPage(pages);
  buildLinksPage(pages);
  buildContactPage(pages);
  buildHomePage(articles, newsArticles, pages);
  copyAssets();
  console.log(
    `\n完成，共處理 ${articles.length} 篇服務文章、${newsArticles.length} 篇最新消息文章、${Object.keys(pages).length} 個靜態頁面。`
  );
}

main();
