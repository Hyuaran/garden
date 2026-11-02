import { readdirSync,readFileSync,existsSync } from 'node:fs';
import { expect,it } from 'vitest';
import { SYSTEM_VIEW_SCOPES } from './system-view-scopes';
it('全 System 画面に閲覧設定の登録または独自の歯車がある',()=>{
 const missing:string[]=[];
 for(const dir of readdirSync('src/app/system',{withFileTypes:true}).filter(d=>d.isDirectory())) {
  const path=`src/app/system/${dir.name}/page.tsx`;
  if(!existsSync(path))continue;
  const source=readFileSync(path,'utf8');
  if(SYSTEM_VIEW_SCOPES.some(s=>s.pageKey===`system-${dir.name}`))continue;
  if(dir.name==='onboarding') {
   expect(source).toContain('ViewPermissionButton');
   continue;
  }
  // 転送先のページが描画・認可を担当する場合のみ対象外。
  if(/redirect\(/.test(source)&&!/<[A-Za-z]/.test(source))continue;
  missing.push(dir.name);
 }
 expect(missing).toEqual([]);
});
