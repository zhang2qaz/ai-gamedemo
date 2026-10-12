// HTML → PDF。页面尺寸、页边、页脚都由 HTML 里的 @page 决定（页脚用 CSS 页边框）。用法：node render.mjs jobs.json
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/opt/node-tools/node_modules/');
let pw;
try { pw = require('playwright'); } catch { pw = require(require.resolve('playwright', { paths: ['/usr/local/lib/node_modules', '/opt/node-tools/node_modules'] })); }
const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const browser = await pw.chromium.launch();
const page = await browser.newPage();
for (const j of jobs) {
  await page.goto('file://' + j.html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // 版心宽122mm：有元素超出时 Chromium 打印会整本缩小，先报出来
  await page.emulateMedia({ media: 'print' });
  await page.setViewportSize({ width: Math.round(122 / 25.4 * 96), height: 900 });
  const over = await page.evaluate(() => {
    const m = document.querySelector('main'); if (!m) return [];
    const W = m.getBoundingClientRect().right + 1, out = [];
    for (const el of m.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.right > W && !['TBODY', 'THEAD', 'TR'].includes(el.tagName)) out.push(el.tagName + ' +' + Math.round(r.right - W) + 'px ' + (el.textContent || '').slice(0, 40).replace(/\s+/g, ' '));
    }
    return out.slice(0, 5);
  });
  for (const o of over) console.log('OVERFLOW', j.html, o);
  await page.pdf({ path: j.pdf, printBackground: true, preferCSSPageSize: true });
  console.log('PDF', j.pdf);
}
await browser.close();
