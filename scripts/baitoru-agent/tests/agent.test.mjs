import {it,expect,vi} from 'vitest';
import iconv from 'iconv-lite';
import {parseCsv,decodeCsv,sessionExpired,bodies,post,run,collect} from '../agent.mjs';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
it('parses BOM, escaped quotes, commas and multiline fields by headers',()=>{
 expect(parseCsv('\uFEFF名前,備考\r\n山田,"a,""b""\r\nc"\r\n')).toEqual([{名前:'山田',備考:'a,"b"\r\nc'}]);
 expect(parseCsv('a,b\n1')).toEqual([{a:'1',b:''}]);expect(()=>parseCsv('a\n"b')).toThrow();
});
it('decodes cp932 Japanese',()=>expect(decodeCsv(iconv.encode('氏名,問合せNo\r\n髙橋,123','cp932'))).toEqual([{氏名:'髙橋',問合せNo:'123'}]));
it('detects both expired session patterns',()=>{
 expect(sessionExpired('https://a/login')).toBe(true);expect(sessionExpired('',new Error('net::ERR_TOO_MANY_REDIRECTS'))).toBe(true);expect(sessionExpired('https://a/entry','timeout')).toBe(false);
});
it('splits by UTF8 bytes and preserves dryRun',()=>{
 const rows=Array.from({length:10},()=>({氏名:'山田'.repeat(10)}));const parts=bodies(rows,true,200);
 expect(parts.flatMap(x=>x.rows)).toEqual(rows);for(const part of parts){expect(part.dryRun).toBe(true);expect(Buffer.byteLength(JSON.stringify(part))).toBeLessThanOrEqual(200);}
 expect(()=>bodies(rows,false,10)).toThrow();expect(bodies([],false)).toEqual([{rows:[],dryRun:false}]);
});
it('sends authorized body and rejects server errors without logging response data',async()=>{
 const fetch=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({ok:true,selected:[{secret:'private'}]})});
 expect(await post({apiBase:'https://example.invalid'},{rows:[],dryRun:true},{RELAY_SECRET:'test'},fetch)).toEqual({status:200,ok:true,skippedReason:undefined,rowsSent:0,dryRun:undefined,counts:undefined,dedupByReason:undefined});
 expect(fetch.mock.calls[0][1]).toMatchObject({headers:{Authorization:'Bearer test'},body:'{"rows":[],"dryRun":true}'});
 fetch.mockResolvedValue({ok:false,status:500});await expect(post({apiBase:'https://example.invalid'},{rows:[]},{RELAY_SECRET:'test'},fetch)).rejects.toThrow('500');
});
it('reports failure, closes browser and releases lock without leaking secrets',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'baitoru-test-'));
 const close=vi.fn(),fetch=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({ok:true})});
 try {
  const config={logDir:dir,logKeepDays:7,storageStatePath:path.join(dir,'state'),apiBase:'https://example.invalid',dryRun:true};
  await expect(run(config,{env:{RELAY_SECRET:'SECRET'},fetchImpl:fetch,launch:async()=>({close,newContext:async()=>{throw new Error('SECRET cookie');}})})).rejects.toThrow('download');
  expect(close).toHaveBeenCalledOnce();expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({rows:[],error:'Baitoru agent failed (download)'});
  const logfile=path.join(dir,new Date().toISOString().slice(0,10).replaceAll('-','')+'.log');expect(await readFile(logfile,'utf8')).not.toContain('SECRET');
  await expect(readFile(config.storageStatePath+'.lock')).rejects.toThrow();
 } finally {await rm(dir,{recursive:true,force:true});}
});
it('discards expired context before login in a new context without storageState',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'baitoru-test-'));
 try {
  const storageStatePath=path.join(dir,'state');await writeFile(storageStatePath,'{}');
  const oldClose=vi.fn();const page={setDefaultTimeout:vi.fn(),goto:async()=>{},url:()=> 'https://example.invalid/login'};
  const browser={newContext:vi.fn().mockResolvedValueOnce({newPage:async()=>page,close:oldClose}).mockImplementationOnce(async options=>{expect(oldClose).toHaveBeenCalledOnce();expect(options).not.toHaveProperty('storageState');return {newPage:async()=>page,close:vi.fn()};})};
  await expect(collect(browser,{storageStatePath},{})).rejects.toThrow('credentials');expect(browser.newContext).toHaveBeenCalledTimes(2);
 }finally{await rm(dir,{recursive:true,force:true});}
});
it('reads Baitoru CSV with blank and duplicated headers and ragged rows',async()=>{
 const {parseCsv}=await import('../agent.mjs');
 const rows=parseCsv('問合せNo,,氏名（漢字）,備考,備考\r\n1,x,山田 花子,a,b\r\n2,,鈴木 一郎\r\n');
 expect(rows).toEqual([{'問合せNo':'1','氏名（漢字）':'山田 花子','備考':'a','備考__2':'b'},{'問合せNo':'2','氏名（漢字）':'鈴木 一郎','備考':'','備考__2':''}]);
});
