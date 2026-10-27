"use client";
import { createPortal } from "react-dom";
// ListProcessingOverlay の社長スタイルを使用。依頼は画面を閉じても継続する。
export default function HireProcessingOverlay({open,title,onClose}:{open:boolean;title:string;onClose?:()=>void}) {
 if(!open)return null;
 return createPortal(<div role="status" aria-live="assertive" aria-label={title} style={{position:"fixed",inset:0,zIndex:10000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:18,padding:24,background:"rgba(16,35,63,.9)",color:"#fff",textAlign:"center",backdropFilter:"blur(3px)",pointerEvents:"all",fontFamily:'Meiryo,"Noto Sans JP",sans-serif'}}>
  <style>{`@keyframes hire-processing-spin { to { transform:rotate(360deg); } }`}</style>
  <div aria-hidden="true" style={{width:72,height:72,border:"7px solid rgba(255,255,255,.22)",borderTopColor:"#0ea5a0",borderRightColor:"#fff",borderRadius:"50%",animation:"hire-processing-spin .85s linear infinite"}}/>
  <strong style={{fontSize:20,lineHeight:1.6}}>{title}</strong>
  <p style={{padding:"8px 14px",borderRadius:999,background:"#fff7e6",color:"#8a5a00",fontWeight:700}}>{onClose?"画面を閉じても依頼は止まりません":"この画面を閉じないでください"}</p>
  {onClose&&<button onClick={onClose}>一覧に戻る</button>}
 </div>,document.body);
}
