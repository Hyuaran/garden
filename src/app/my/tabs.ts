export const MY_TABS = [
 {id:"profile",label:"自分の情報",short:"自分の情報",icon:"account"},
 {id:"attendance",label:"勤怠打刻",short:"打刻",icon:"todo"},
 {id:"shift",label:"シフト",short:"シフト",icon:"folder"},
 {id:"zenkaku",label:"前確依頼",short:"前確",icon:"check"},
 {id:"calls",label:"通話・録音",short:"通話",icon:"phone"},
 {id:"report",label:"AP日報",short:"日報",icon:"receipt"},
] as const;
export type MyTab = typeof MY_TABS[number]["id"];
export function resolveMyTab(value: unknown): MyTab { return MY_TABS.find(item=>item.id===value)?.id ?? "profile"; }
