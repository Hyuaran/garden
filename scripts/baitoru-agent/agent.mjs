import { readFile, writeFile, mkdir, open, unlink, readdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import iconv from 'iconv-lite';

export function parseCsv(text) {
 text=text.replace(/^\uFEFF/,'');
 const records=[]; let row=[], value='', quoted=false;
 for(let i=0;i<text.length;i++) {
  const c=text[i];
  if(c==='"') { if(quoted && text[i+1]==='"') {value+='"'; i++;} else if(quoted || value==='') quoted=!quoted; else throw new Error('CSV quote invalid'); }
  else if(c===',' && !quoted) {row.push(value); value='';}
  else if((c==='\n' || c==='\r') && !quoted) {if(c==='\r' && text[i+1]==='\n') i++; row.push(value); records.push(row); row=[]; value='';}
  else value+=c;
 }
 if(quoted) throw new Error('CSV quote not closed');
 if(value || row.length) {row.push(value); records.push(row);}
 const raw=records.shift();
 if(!raw || !raw.some(h=>h.trim())) throw new Error('CSV headers invalid');
 // バイトルの CSV（約 300 列）は見出しが空欄の列や同じ名前の列を含む（2026-10-24 実物）。空欄の列は読まず、同じ名前の 2 つ目以降は「名前__2」とする
 const seen=new Map();
 const headers=raw.map(h=>{const name=h.trim(); if(!name) return ''; const n=(seen.get(name) ?? 0)+1; seen.set(name,n); return n===1?name:`${name}__${n}`;});
 // 行の列数が見出しと少しずれる（末尾の空欄の有無など）ことがあるので、見出しの数に合わせて読む
 return records.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(headers.flatMap((h,i)=>h?[[h,r[i] ?? '']]:[])));
}
export const decodeCsv = bytes => parseCsv(iconv.decode(bytes,'cp932'));
export const sessionExpired = (url='', error='') => /\/login/i.test(url) || /ERR_TOO_MANY_REDIRECTS/.test(String(error));
export function bodies(rows,dryRun,maxBytes=2*1024*1024) {
 const result=[]; let batch=[];
 for(const row of rows) {
  const next=[...batch,row];
  if(Buffer.byteLength(JSON.stringify({rows:next,dryRun}))>maxBytes || next.length>10000) {
   if(!batch.length) throw new Error('CSV row exceeds request limit');
   result.push({rows:batch,dryRun}); batch=[row];
   if(Buffer.byteLength(JSON.stringify({rows:batch,dryRun}))>maxBytes) throw new Error('CSV row exceeds request limit');
  } else batch=next;
 }
 if(batch.length || !result.length) result.push({rows:batch,dryRun});
 return result;
}
const contextOptions={viewport:{width:1400,height:900},locale:'ja-JP',acceptDownloads:true};
async function first(page,selectors) {
 for(const selector of selectors) {const locator=page.locator(selector).first(); if(await locator.count() && await locator.isVisible()) return locator;}
 throw new Error('Login control not found');
}
export async function collect(browser,config,env=process.env) {
 let context; let temp;
 try {
  let state;
  try {state=JSON.parse(await readFile(config.storageStatePath,'utf8'));} catch(e) {if(e.code!=='ENOENT') throw new Error('Storage state cannot be read');}
  context=await browser.newContext({...contextOptions,...(state?{storageState:state}:{})});
  let page=await context.newPage(); page.setDefaultTimeout(10000);
  const navigate=async()=>{try {await page.goto('https://agent.baitoru.com/entry?mode=1',{waitUntil:'networkidle',timeout:30000}); return sessionExpired(page.url());} catch(e) {if(sessionExpired('',e)) return true; throw e;}};
  if(!state || await navigate()) {
   await context.close(); context=undefined;
   context=await browser.newContext(contextOptions); page=await context.newPage(); page.setDefaultTimeout(10000);
   if(!env.BAITORU_ID || !env.BAITORU_PW) throw new Error('Login credentials missing');
   await page.goto(env.BAITORU_LOGIN_URL || 'https://agent.baitoru.com/login',{waitUntil:'domcontentloaded',timeout:30000});
   await (await first(page,['input[name="username"]','input[name="loginId"]','input[name="email"]','input[type="email"]'])).fill(env.BAITORU_ID);
   await (await first(page,['input[name="password"]','input[type="password"]'])).fill(env.BAITORU_PW);
   await (await first(page,['button[type="submit"]','input[type="submit"]','button:has-text("ログイン")'])).click();
   await page.waitForURL(url=>!sessionExpired(url.toString()),{timeout:30000});
   if(await navigate()) throw new Error('Session expired after login');
  }
  const [download]=await Promise.all([page.waitForEvent('download',{timeout:30000}),page.locator('#bb-download-submit').click()]);
  temp=await mkdtemp(path.join(os.tmpdir(),'garden-baitoru-'));
  const csv=path.join(temp,'applicants.csv'); await download.saveAs(csv);
  const rows=decodeCsv(await readFile(csv));
  await mkdir(path.dirname(config.storageStatePath),{recursive:true});
  await context.storageState({path:config.storageStatePath});
  return rows;
 } finally {try {if(context) await context.close();} finally {if(temp) await rm(temp,{recursive:true,force:true});}}
}
export async function post(config,body,env=process.env,fetchImpl=fetch) {
 if(!env.RELAY_SECRET) throw new Error('Relay secret missing');
 const response=await fetchImpl(new URL('/api/sprout/baitoru/ingest',config.apiBase),{method:'POST',headers:{Authorization:`Bearer ${env.RELAY_SECRET}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 if(!response.ok) throw new Error(`Garden HTTP ${response.status}`);
 const result=await response.json();
 if(result.ok!==true) throw new Error('Garden rejected request');
 // Only aggregate values are logged; response bodies may contain applicants.
 // 件数だけは残す（試しの結果を確かめるため。氏名などは含まない）
 const numbers=v=>v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([,n])=>typeof n==='number')):undefined;
 return {status:response.status,ok:result.ok,skippedReason:['disabled','already syncing'].includes(result.skippedReason)?result.skippedReason:undefined,rowsSent:Array.isArray(body.rows)?body.rows.length:undefined,dryRun:result.dryRun,counts:numbers(result.counts),dedupByReason:numbers(result.dedupByReason)};
}
export async function run(config,{env=process.env,launch,fetchImpl=fetch}={}) {
 await mkdir(config.logDir,{recursive:true});
 const log=async data=>{await writeFile(path.join(config.logDir,new Date().toISOString().slice(0,10).replaceAll('-','')+'.log'),JSON.stringify({time:new Date().toISOString(),...data})+'\n',{flag:'a'});};
 for(const name of await readdir(config.logDir)) if(/^\d{8}\.log$/.test(name) && Date.now()-Date.parse(`${name.slice(0,4)}-${name.slice(4,6)}-${name.slice(6,8)}T23:59:59Z`)>config.logKeepDays*86400000) await unlink(path.join(config.logDir,name));
 const lockPath=config.storageStatePath+'.lock'; await mkdir(path.dirname(lockPath),{recursive:true});
 let lock, browser, stage='lock';
 try {
  try {lock=await open(lockPath,'wx'); await lock.writeFile(String(process.pid));} catch(e) {if(e.code==='EEXIST') {await log({event:'skipped',reason:'already running'}); return;} throw e;}
  stage='browser'; const start=launch || (await import('playwright')).chromium.launch.bind((await import('playwright')).chromium);
  browser=await start({headless:true}); stage='download'; const rows=await collect(browser,config,env);
  stage='browser-close'; await browser.close(); browser=undefined;
  stage='send'; for(const body of bodies(rows,config.dryRun)) await log({event:'response',...await post(config,body,env,fetchImpl)});
 } catch(error) {
  const reason=`Baitoru agent failed (${stage})`;
  // 原因を見分けるため、エラーの 1 行目だけをログに残す（ID・パスワード・合言葉は伏せる。Garden へは送らない）
  let detail=String(error?.message ?? error).split(/\r?\n/)[0].slice(0,200);
  for(const key of ['BAITORU_ID','BAITORU_PW','RELAY_SECRET']) if(env[key]) detail=detail.split(env[key]).join('***');
  await log({event:'failure',reason,detail});
  try {await post(config,{rows:[],error:reason},env,fetchImpl); await log({event:'failure-reported'});} catch {await log({event:'failure-report-failed'});}
  throw new Error(reason);
 } finally {try {if(browser) await browser.close();} finally {if(lock) {await lock.close(); await unlink(lockPath);}}}
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try {
  const args=process.argv.slice(2); if(!args.includes('--once')) throw new Error('Use --once');
  const i=args.indexOf('--config'); const configPath=path.resolve(i<0?path.join(path.dirname(fileURLToPath(import.meta.url)),'config.json'):args[i+1]);
  const config=JSON.parse((await readFile(configPath,'utf8')).replace(/^\uFEFF/,''));
  for(const key of ['logDir','storageStatePath']) config[key]=path.resolve(path.dirname(configPath),config[key]);
  if(typeof config.dryRun!=='boolean' || !Number.isInteger(config.logKeepDays) || config.logKeepDays<1 || config.intervalMinutes!==10) throw new Error('Invalid config');
  if(args.includes('--dry-run')) config.dryRun=true;
  await run(config);
 } catch {console.error('Baitoru agent failed; check config and agent logs.'); process.exitCode=1;}
}
