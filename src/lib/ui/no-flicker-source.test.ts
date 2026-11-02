import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";
const app=path.resolve("src/app");
function walk(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):/\.tsx?$/.test(entry.name)&&!/(?:test|spec|legacy)[.-]/.test(entry.name)?[path.join(dir,entry.name)]:[]);}
const files=walk(app);
const texts=new Map(files.map(file=>[file,readFileSync(file,"utf8")]));
/** Browser reads belong only to shared mechanisms, never a page's initial render. */
const sharedBrowserReaders=[
  "src/lib/ui/useStoredView.ts", "src/lib/ui/useViewportMatch.ts", "src/lib/ui/useBrowserOrigin.ts", "src/lib/ui/useBrowserLocation.ts", "src/lib/ui/useThemeAppearance.ts",
  "src/app/system/_components/SystemTabs/useUrlTab.ts",
  "src/app/system/_components/DataTable/DataTable.tsx",
  "src/app/system/_components/PageSearchSlot/PageSearchSlot.tsx",
  "src/app/system/_components/HeaderViewToggle.tsx", "src/app/_lib/theme/ThemeProvider.tsx",
  // External-store snapshots in common favorites controls have a fixed server snapshot.
  "src/app/_components/layout/GardenShell/GardenShell.tsx",
  "src/app/_components/layout/GardenShell/PageHeader.tsx",
].map(file=>path.resolve(file));
function parse(file:string,text:string){return ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith("tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);}
it("rejects browser reads in state initializers and rendering, including local helper functions",()=>{
  const failures:string[]=[];
  for(const [file,text] of texts){
    const ast=parse(file,text),functions=new Map<string,ts.Node>();
    const collect=(node:ts.Node)=>{if(ts.isFunctionDeclaration(node)&&node.name)functions.set(node.name.text,node);if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.initializer&&(ts.isArrowFunction(node.initializer)||ts.isFunctionExpression(node.initializer)))functions.set(node.name.text,node.initializer);ts.forEachChild(node,collect);};collect(ast);
    function browser(node:ts.Node,seen=new Set<string>()):boolean{
      if(ts.isJsxAttribute(node)&&/^on[A-Z]/.test(node.name.getText(ast)))return false;
      if(ts.isArrowFunction(node)||ts.isFunctionExpression(node))return false;
      if(ts.isIdentifier(node)&&/^(window|location|localStorage|sessionStorage|matchMedia)$/.test(node.text))return true;
      if(ts.isFunctionDeclaration(node))return false;
      if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&functions.has(node.expression.text)&&!seen.has(node.expression.text)){
        seen.add(node.expression.text);const fn=functions.get(node.expression.text) as ts.FunctionDeclaration;
        if(fn.body&&browser(fn.body,seen))return true;
      }
      let found=false;ts.forEachChild(node,child=>{if(browser(child,seen))found=true;});return found;
    }
    function visit(node:ts.Node){
      if(ts.isFunctionDeclaration(node)&&node.name&&/^(?:[A-Z]|use[A-Z])/.test(node.name.text)&&node.body){
        for(const statement of node.body.statements){
          if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations)if(declaration.initializer&&browser(declaration.initializer))failures.push(path.relative(app,file)+": render value");
          if(ts.isIfStatement(statement)&&browser(statement.expression))failures.push(path.relative(app,file)+": render condition");
        }
      }
      if(ts.isCallExpression(node)&&node.expression.getText(ast)==="useState"&&node.arguments[0]){
        const init=node.arguments[0];
        const helper=ts.isIdentifier(init)?functions.get(init.text) as ts.FunctionDeclaration|undefined:undefined;
        if(browser(helper?.body??(ts.isArrowFunction(init)||ts.isFunctionExpression(init)?init.body:init)))failures.push(path.relative(app,file)+": state initializer");
      }
      // JSX expressions are rendering, except event callbacks and render functions.
      if(ts.isJsxExpression(node)&&node.expression&&!(ts.isJsxAttribute(node.parent)&&/^on[A-Z]/.test(node.parent.name.getText(ast)))&&browser(node.expression))failures.push(path.relative(app,file)+": render");
      if(ts.isCallExpression(node)&&node.expression.getText(ast)==="useEffect"&&!sharedBrowserReaders.includes(file)){
        const callback=node.arguments[0];
        if(callback&&(ts.isArrowFunction(callback)||ts.isFunctionExpression(callback))&&browser(callback.body)){
          const body=callback.body.getText(ast);
          let restores=false;
          const inspected=new Set<string>();
          const inspect=(part:ts.Node)=>{if(ts.isFunctionDeclaration(part)||ts.isArrowFunction(part)||ts.isFunctionExpression(part))return;if(ts.isCallExpression(part)){const name=part.expression.getText(ast);if(/^set(?:View\w*|Mode\w*|Tab|ActiveTab|Collapsed|ShowComplete|ShowNoShow|Expanded|CardsReversed|CorpFilter\w*|Favorites|Open)$/.test(name))restores=true;const helper=functions.get(name) as ts.FunctionDeclaration|undefined;if(helper?.body&&!inspected.has(name)){inspected.add(name);inspect(helper.body);}}ts.forEachChild(part,inspect);};inspect(callback.body);
          if(/getItem|location\.search|matchMedia/.test(body)&&restores)failures.push(path.relative(app,file)+": deferred view restoration");
        }
      }
      ts.forEachChild(node,visit);
    }visit(ast);
  }
  expect(failures).toEqual([]);
});
it("keeps persisted view restoration out of migrated screens",()=>{
  const screens=["system/forms/FormsHubClient.tsx","system/deliveries/DeliveriesHubClient.tsx","system/sites/SitesHubClient.tsx","system/contracts/UrlViewClient.tsx","system/line/LineManager.tsx","my/ApDailyReview.tsx","system/onboarding/HireCandidatesClient.tsx","bud/profit/broadband/BroadbandTable.tsx","system/dev-board/BoardClient.tsx","system/_components/ShachoShell/SidebarNavigation.tsx","bud/expenses/_components/ExpenseReviewPanel.tsx","bud/expenses/_components/ExpenseBookingPanel.tsx","bud/expenses/_components/ExpenseFinalPanel.tsx","system/forms/expense/ExpenseClient.tsx","system/onboarding/HireConfirmationSteps.tsx","tree/qa/page.tsx","_components/home/GardenHomeClient.tsx"];
  for(const screen of screens){const text=readFileSync(path.join(app,screen),"utf8");expect(text,screen).toContain("useStoredView");expect(text,screen).not.toMatch(/(?:localStorage|sessionStorage)\.getItem/);}
});
it("requires every route reaching useUrlTab to receive initial URL state from its server page",()=>{
  function resolve(file:string,imp:string){
    const base=imp.startsWith("@/")?path.resolve("src",imp.slice(2)):imp.startsWith(".")?path.resolve(path.dirname(file),imp):null;
    if(!base)return null;return [base,base+".tsx",base+".ts",path.join(base,"index.tsx")].find(candidate=>texts.has(candidate))??null;
  }
  const deps=new Map([...texts].map(([file,text])=>[file,[...text.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)].map(match=>resolve(file,match[1])).filter((v):v is string=>!!v)]));
  const reached=new Set([...texts].filter(([file,text])=>/useUrlTab(?:<[^;]+?>)?\(/.test(text)&&!file.endsWith("useUrlTab.ts")).map(([file])=>file));
  let changed=true;while(changed){changed=false;for(const [file,imports] of deps)if(!reached.has(file)&&imports.some(imp=>reached.has(imp))){reached.add(file);changed=true;}}
  const routes=[...reached].filter(file=>path.basename(file)==="page.tsx");
  expect(routes.length).toBeGreaterThan(20);
  for(const route of routes)expect(texts.get(route),path.relative(app,route)).toContain("withInitialUrlView");
  expect(existsSync(path.resolve("src/lib/ui/withInitialUrlView.server.tsx"))).toBe(true);
});
it("reserves the page scrollbar so content arriving later does not shift the whole screen sideways", () => {
  expect(readFileSync("src/app/globals.css", "utf8")).toMatch(/html\s*\{\s*scrollbar-gutter:\s*stable;/);
});
