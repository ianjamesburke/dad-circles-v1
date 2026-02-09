/**
 * Prerender /blog and each /blog/:slug as static HTML for SEO and crawlers.
 * Run after `vite build`. Writes dist/blog/index.html and dist/blog/{slug}/index.html.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BLOG_POSTS } from '../utils/blogData';
import type { BlogPost } from '../types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const distIndexPath = path.join(distDir, 'index.html');
const blogDir = path.join(distDir, 'blog');
const blogIndexPath = path.join(blogDir, 'index.html');
const baseUrl = 'https://dadcircles.com';

function getPublishedAt(post: { published_at?: unknown }): number {
  const v = post.published_at;
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'toMillis' in v && typeof (v as { toMillis: () => number }).toMillis === 'function') {
    return (v as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

/** Simple markdown-like content to HTML for prerender (h3, bold, lists, paragraphs). */
function contentToHtml(content: string): string {
  const out: string[] = [];
  const blocks = content.trim().split(/\n\n+/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('###')) {
      out.push(`<h3>${escapeHtml(trimmed.replace(/^###\s*/, ''))}</h3>`);
      continue;
    }
    if (trimmed.startsWith('**') && trimmed.endsWith('**') && !trimmed.slice(2, -2).includes('**')) {
      out.push(`<p><strong>${escapeHtml(trimmed.slice(2, -2))}</strong></p>`);
      continue;
    }
    const lines = trimmed.split('\n');
    const bulletItems = lines.filter((l) => l.trim().startsWith('* '));
    if (bulletItems.length > 0) {
      const listItems = bulletItems.map((l) => `<li>${escapeHtml(l.replace(/^\*\s+/, '').trim())}</li>`).join('');
      out.push(`<ul>${listItems}</ul>`);
      const rest = lines.filter((l) => !l.trim().startsWith('* ')).filter(Boolean);
      rest.forEach((l) => out.push(`<p>${escapeHtml(l.trim())}</p>`));
      continue;
    }
    // Inline **bold**
    const withBold = escapeHtml(trimmed).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out.push(`<p>${withBold}</p>`);
  }
  return out.join('\n');
}

function buildBlogListHtml(): string {
  const items = BLOG_POSTS.map((post) => {
    const date = new Date(getPublishedAt(post));
    const dateStr = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const readTime = post.read_time_minutes ?? 3;
    const href = `${baseUrl}/blog/${post.slug}`;
    return `
    <article class="blog-preview" itemscope itemtype="https://schema.org/BlogPosting">
      <a href="${href}" itemprop="url">
        <h2 itemprop="headline">${escapeHtml(post.title)}</h2>
        <p itemprop="description">${escapeHtml(post.excerpt)}</p>
        <time datetime="${date.toISOString()}" itemprop="datePublished">${dateStr}</time>
        <span> · ${readTime} min read</span>
      </a>
    </article>`;
  }).join('\n');

  return `
<main id="blog-prerender" role="main">
  <h1>Inside the Circle</h1>
  <p>Research, stories, and practical thoughts on fatherhood and local connection.</p>
  <nav aria-label="Blog posts">
    ${items}
  </nav>
</main>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildJsonLd(): string {
  const list = BLOG_POSTS.map((post) => ({
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    url: `${baseUrl}/blog/${post.slug}`,
    datePublished: new Date(getPublishedAt(post)).toISOString(),
  }));
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Inside the Circle – DadCircles Blog',
    description: 'Research, stories, and practical thoughts on fatherhood and local connection.',
    url: `${baseUrl}/blog`,
    blogPost: list,
  });
}

function main(): void {
  if (!fs.existsSync(distIndexPath)) {
    console.error('prerender-blog: dist/index.html not found. Run vite build first.');
    process.exit(1);
  }

  let indexHtml = fs.readFileSync(distIndexPath, 'utf-8');

  // Blog-specific title and description
  indexHtml = indexHtml.replace(
    '<title>Dad Circles | Community for New & Expecting Dads</title>',
    '<title>Blog | Inside the Circle – DadCircles</title>'
  );
  indexHtml = indexHtml.replace(
    /<meta name="description"[^>]*>/,
    '<meta name="description" content="Research, stories, and practical thoughts on fatherhood and local connection. DadCircles blog.">'
  );
  indexHtml = indexHtml.replace(
    /<meta property="og:url" content="[^"]*">/,
    '<meta property="og:url" content="https://dadcircles.com/blog">'
  );
  indexHtml = indexHtml.replace(
    /<meta property="og:title" content="[^"]*">/,
    '<meta property="og:title" content="Blog | Inside the Circle – DadCircles">'
  );
  indexHtml = indexHtml.replace(
    /<meta property="og:description"[^>]*>/,
    '<meta property="og:description" content="Research, stories, and practical thoughts on fatherhood and local connection.">'
  );
  indexHtml = indexHtml.replace(
    /<meta property="twitter:url" content="[^"]*">/,
    '<meta property="twitter:url" content="https://dadcircles.com/blog">'
  );
  indexHtml = indexHtml.replace(
    /<meta property="twitter:title" content="[^"]*">/,
    '<meta property="twitter:title" content="Blog | Inside the Circle – DadCircles">'
  );
  indexHtml = indexHtml.replace(
    /<meta property="twitter:description"[^>]*>/,
    '<meta property="twitter:description" content="Research, stories, and practical thoughts on fatherhood and local connection.">'
  );

  const blogListHtml = buildBlogListHtml();
  const jsonLd = buildJsonLd();

  // JSON-LD in head for crawlers
  const jsonLdScript = `<script type="application/ld+json">${jsonLd}</script>`;
  indexHtml = indexHtml.replace('</head>', `${jsonLdScript}\n</head>`);

  // Inject prerendered content into #root so crawlers see a parseable list
  const rootContent = `<div id="root">${blogListHtml}</div>`;
  indexHtml = indexHtml.replace(/<div id="root"><\/div>/, rootContent);
  if (!indexHtml.includes(blogListHtml)) {
    indexHtml = indexHtml.replace(/<div id="root">[\s\S]*?<\/div>/, rootContent);
  }

  fs.mkdirSync(blogDir, { recursive: true });
  fs.writeFileSync(blogIndexPath, indexHtml, 'utf-8');
  console.log('prerender-blog: wrote dist/blog/index.html');

  // Prerender each post at /blog/:slug for SEO and crawlers
  const baseIndexHtml = fs.readFileSync(distIndexPath, 'utf-8');
  for (const post of BLOG_POSTS) {
    const postHtml = buildPostArticleHtml(post);
    const postJsonLd = buildPostJsonLd(post);
    let postFile = baseIndexHtml
      .replace('<title>Dad Circles | Community for New & Expecting Dads</title>', `<title>${escapeHtml(post.title)} | DadCircles Blog</title>`)
      .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(post.excerpt)}">`)
      .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${baseUrl}/blog/${post.slug}">`)
      .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escapeHtml(post.title)} | DadCircles Blog">`)
      .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeHtml(post.excerpt)}">`)
      .replace(/<meta property="twitter:url" content="[^"]*">/, `<meta property="twitter:url" content="${baseUrl}/blog/${post.slug}">`)
      .replace(/<meta property="twitter:title" content="[^"]*">/, `<meta property="twitter:title" content="${escapeHtml(post.title)} | DadCircles Blog">`)
      .replace(/<meta property="twitter:description"[^>]*>/, `<meta property="twitter:description" content="${escapeHtml(post.excerpt)}">`);
    postFile = postFile.replace('</head>', `<script type="application/ld+json">${postJsonLd}</script>\n</head>`);
    const rootContent = `<div id="root">${postHtml}</div>`;
    postFile = postFile.replace(/<div id="root"><\/div>/, rootContent);
    if (!postFile.includes(postHtml)) {
      postFile = postFile.replace(/<div id="root">[\s\S]*?<\/div>/, rootContent);
    }
    const slugDir = path.join(blogDir, post.slug);
    fs.mkdirSync(slugDir, { recursive: true });
    fs.writeFileSync(path.join(slugDir, 'index.html'), postFile, 'utf-8');
  }
  console.log(`prerender-blog: wrote ${BLOG_POSTS.length} post(s) to dist/blog/:slug/index.html`);
}

function buildPostArticleHtml(post: BlogPost): string {
  const date = new Date(getPublishedAt(post));
  const dateStr = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const bodyHtml = contentToHtml(post.content);
  return `
<article id="blog-post-prerender" itemscope itemtype="https://schema.org/BlogPosting">
  <header>
    <a href="${baseUrl}/blog">← Back to blog</a>
    <p><time datetime="${date.toISOString()}" itemprop="datePublished">${dateStr}</time> · ${post.read_time_minutes ?? 3} min read</p>
    <h1 itemprop="headline">${escapeHtml(post.title)}</h1>
    <p itemprop="author" itemscope itemtype="https://schema.org/Person"><span itemprop="name">${escapeHtml(post.author)}</span></p>
  </header>
  <div itemprop="articleBody">
    ${bodyHtml}
  </div>
  <p><a href="${baseUrl}/blog">More articles</a></p>
</article>`;
}

function buildPostJsonLd(post: BlogPost): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    url: `${baseUrl}/blog/${post.slug}`,
    datePublished: new Date(getPublishedAt(post)).toISOString(),
    author: { '@type': 'Person', name: post.author },
    publisher: { '@type': 'Organization', name: 'DadCircles' },
  });
}

main();
