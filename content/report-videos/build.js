'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const QRCode = require('qrcode');

const ROOT = __dirname;
const TEMPLATE = path.join(ROOT, 'template', 'promo-template.html');
const REPORTS_DIR = path.join(ROOT, 'reports');
const OUT_DIR = path.join(ROOT, 'out');
const GSAP_SRC = path.join(ROOT, 'node_modules', 'gsap', 'dist', 'gsap.min.js');

// pool-openings maps to a non-standard output path (capital P/O)
const OUTPUT_PATHS = {
  'pool-openings': '../../apps/reports/PoolOpenings/storymap/promo.mp4',
};

function outputPath(slug) {
  return OUTPUT_PATHS[slug] || `../../apps/reports/${slug}/storymap/promo.mp4`;
}

const args = process.argv.slice(2);
const shouldRender = args.includes('--render');
const slugArg = args.find(a => !a.startsWith('--')) || null;

async function main() {
  const template = fs.readFileSync(TEMPLATE, 'utf-8');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Copy GSAP into out/ so compositions can load it without a CDN fetch
  fs.copyFileSync(GSAP_SRC, path.join(OUT_DIR, 'gsap.min.js'));

  const slugs = slugArg
    ? [slugArg]
    : fs.readdirSync(REPORTS_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => f.slice(0, -5));

  for (const slug of slugs) {
    const configPath = path.join(REPORTS_DIR, `${slug}.json`);
    if (!fs.existsSync(configPath)) {
      console.error(`Missing config: reports/${slug}.json`);
      process.exit(1);
    }

    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const qrUrl = `https://anatomy.city${cfg.appPath}`;

    // Generate QR code as inline SVG — no CDN needed at render time
    const qrSvgRaw = await QRCode.toString(qrUrl, {
      type: 'svg',
      color: { dark: '#111111', light: '#ffffff' },
      margin: 1,
    });
    const qrSvg = qrSvgRaw.replace(/^<\?xml[^>]*\?>\s*/, '').trim();

    const html = template
      .replaceAll('{{SLUG}}', slug)
      .replaceAll('{{TITLE}}', cfg.title)
      .replaceAll('{{EYEBROW}}', cfg.eyebrow)
      .replaceAll('{{NARRATIVE}}', cfg.narrative)
      .replaceAll('{{ACCENT}}', cfg.accentColor)
      .replaceAll('{{QR_SVG}}', qrSvg);

    const outFile = path.join(OUT_DIR, `${slug}.html`);
    fs.writeFileSync(outFile, html, 'utf-8');
    console.log(`Built: out/${slug}.html`);

    if (shouldRender) {
      const mp4Out = outputPath(slug);
      console.log(`Rendering ${slug} → ${mp4Out}`);
      execSync(
        `npx hyperframes render "${outFile}" --fps 30 --output "${mp4Out}"`,
        { stdio: 'inherit', cwd: ROOT }
      );
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
