import { createRequire } from 'module';
const require = createRequire('/opt/node-tools/node_modules/');
const pw = require('playwright');
const b = await pw.chromium.launch(); const p = await b.newPage({viewport:{width:1536,height:1700}});
await p.goto('file://'+process.argv[2],{waitUntil:'networkidle'}); await p.evaluate(()=>document.fonts.ready);
await p.screenshot({path:process.argv[3], fullPage:true}); await b.close();
