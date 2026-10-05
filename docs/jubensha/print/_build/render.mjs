// HTML → PDF（A5，页脚页码）。用法：node render.mjs jobs.json
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
  await page.pdf({
    path: j.pdf, width: '148mm', height: '210mm', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `<div style="width:100%;font-size:7pt;color:#4a4a48;padding:0 13mm;display:flex;justify-content:space-between;font-family:'WenQuanYi Zen Hei',sans-serif"><span>摇摆！· ${j.label}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  });
  console.log('PDF', j.pdf);
}
await browser.close();
