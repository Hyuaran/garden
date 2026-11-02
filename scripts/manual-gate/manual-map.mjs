import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export function readRegistry(source = readFileSync(new URL('../../src/app/system/manuals/_lib/manuals-registry.ts', import.meta.url), 'utf8')) {
  const ast = ts.createSourceFile('registry.ts', source, ts.ScriptTarget.Latest, true);
  if (ast.parseDiagnostics.length) throw new Error('マニュアル登録の構文を解析できません');
  const declarations = new Map();
  const calls = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node)) declarations.set(node.name.getText(ast), node.initializer);
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'manual') calls.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const str = node => {
    if (!node || !ts.isStringLiteral(node)) throw new Error('マニュアル登録の文字列を解析できません');
    return node.text;
  };
  const pathsNode = declarations.get('MANUAL_PATHS');
  const docsNode = declarations.get('MANUAL_DOCS');
  if (!pathsNode || !ts.isObjectLiteralExpression(pathsNode) || !docsNode || !ts.isArrayLiteralExpression(docsNode)) throw new Error('MANUAL_PATHS / MANUAL_DOCS がありません');
  const paths = new Map(pathsNode.properties.map(p => {
    if (!ts.isPropertyAssignment(p) || !ts.isArrayLiteralExpression(p.initializer)) throw new Error('MANUAL_PATHS の形式が不明です');
    return [str(p.name), p.initializer.elements.map(str)];
  }));
  const docs = docsNode.elements.map(node => {
    if (!ts.isObjectLiteralExpression(node)) throw new Error('MANUAL_DOCS の形式が不明です');
    return Object.fromEntries(node.properties.filter(p => ts.isPropertyAssignment(p)).map(p => [p.name.getText(ast), str(p.initializer)]));
  });
  const factory = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'manual');
  const returned = factory?.body?.statements.find(ts.isReturnStatement)?.expression;
  const storage = returned && ts.isObjectLiteralExpression(returned) && returned.properties.find(p => p.name?.getText(ast) === 'storagePrefix');
  if (storage?.initializer?.getText(ast) !== '`${moduleSlug}/${slug}`') throw new Error('storagePrefix の規則を確認してください');
  const manuals = calls.map(call => {
    const [module, slug, name] = call.arguments.slice(0, 3).map(str);
    const key = `${module}/${slug}`;
    if (!paths.has(key)) throw new Error(`MANUAL_PATHS 未登録: ${key}`);
    return { key, name, paths: paths.get(key), storagePrefix: key };
  });
  if (!manuals.length || manuals.length !== paths.size || new Set(manuals.map(m => m.key)).size !== manuals.length || docs.length !== 5) throw new Error('マニュアル登録の件数が一致しません');
  return { manuals, docs };
}

export const registry = readRegistry();
const extra = JSON.parse(readFileSync(new URL('./extra-map.json', import.meta.url), 'utf8'));
for (const keys of Object.values(extra)) {
  if (!Array.isArray(keys) || keys.some(key => !registry.manuals.some(m => m.key === key))) throw new Error('extra-map のキーが不正です');
}

export function manualsForFiles(files) {
  const result = new Map();
  for (const original of files) {
    const file = original.replaceAll('\\', '/').replace(/^\.\//, '');
    if (/(^|\/)__tests__(\/|$)|\.(test|spec)\.|(^|\/)[^/]*config\.[^/]+$/.test(file) || !file.startsWith('src/')) continue;
    let keys = [];
    const explicit = Object.keys(extra).filter(prefix => file === prefix || (prefix.endsWith('/') && file.startsWith(prefix))).sort((a, b) => b.length - a.length)[0];
    if (explicit) keys = extra[explicit];
    else if (file.startsWith('src/app/')) {
      let parts = file.slice(8).split('/').slice(0, -1).filter(p => !/^\(.*\)$/.test(p));
      const privateIndex = parts.findIndex(p => p.startsWith('_'));
      if (privateIndex >= 0) parts = parts.slice(0, privateIndex);
      const routes = ['/' + parts.join('/')];
      if (parts[0] === 'api') routes.push('/' + parts.slice(1).join('/'));
      let best, length = -1;
      for (const m of registry.manuals) for (const prefix of m.paths) {
        const candidate = new URL(prefix, 'https://garden.invalid');
        if (candidate.search) continue;
        if (routes.some(route => route === candidate.pathname || route.startsWith(candidate.pathname + '/')) && prefix.length > length) { best = m; length = prefix.length; }
      }
      if (best) keys = [best.key];
    }
    for (const key of keys) {
      if (!result.has(key)) result.set(key, { key, name: registry.manuals.find(m => m.key === key).name, files: [] });
      if (!result.get(key).files.includes(file)) result.get(key).files.push(file);
    }
  }
  return [...result.values()];
}
