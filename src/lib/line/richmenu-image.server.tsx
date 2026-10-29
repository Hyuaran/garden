import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { menuImageLabels, type Contact, type MenuGroup } from './richmenu';
export async function renderMenuImage(group: MenuGroup, contacts: Contact[]) {
  const four = group === 'koizumi' || group === 'ishihara';
  const base = await readFile(path.join(process.cwd(), 'public/line/richmenu', group === 'guest' ? 'guest_2.jpg' : four ? 'employee_4_base.jpg' : 'employee_3_base.jpg'));
  if (group === 'guest') return {data: base, contentType: 'image/jpeg'};
  const font = await readFile(path.join(process.cwd(), 'src/assets/fonts/NotoSansJP-Regular.ttf'));
  const height = four ? 1686 : 843;
  const response = new ImageResponse(<div style={{display:'flex',width:2500,height,position:'relative',fontFamily:'Noto',color:'#54616D'}}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img alt="" src={'data:image/jpeg;base64,'+base.toString('base64')} width={2500} height={height} style={{position:'absolute',top:0,left:0}}/>
    {menuImageLabels(group,contacts).map((label,i)=><div key={i} style={{display:'flex',position:'absolute',left:label.x-600,top:label.y,width:1200,justifyContent:'center',fontSize:label.size,lineHeight:1}}>{label.text}</div>)}
  </div>,{width:2500,height,fonts:[{name:'Noto',data:font.buffer.slice(font.byteOffset,font.byteOffset+font.byteLength),weight:400,style:'normal'}]});
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > 1000000) throw new Error('メニューの画像が大きすぎます。');
  return {data,contentType:'image/png'};
}
