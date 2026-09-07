function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInline(value: string) {
  let html = escapeHtml(value);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noreferrer noopener" target="_blank">$1</a>');
  return html;
}

function flushParagraph(lines: string[], output: string[]) {
  if (!lines.length) return;
  output.push(`<p>${lines.map(renderInline).join("<br />")}</p>`);
  lines.length = 0;
}

function flushList(lines: string[], output: string[]) {
  if (!lines.length) return;
  output.push(`<ul>${lines.map((line) => `<li>${renderInline(line)}</li>`).join("")}</ul>`);
  lines.length = 0;
}

export function renderMarkdown(markdown: string) {
  const output: string[] = [];
  const paragraph: string[] = [];
  const list: string[] = [];
  const code: string[] = [];
  let inCode = false;

  for (const rawLine of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith("```")) {
      if (inCode) {
        output.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code.length = 0;
        inCode = false;
      } else {
        flushParagraph(paragraph, output);
        flushList(list, output);
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(rawLine);
      continue;
    }
    if (!line.trim()) {
      flushParagraph(paragraph, output);
      flushList(list, output);
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph(paragraph, output);
      flushList(list, output);
      output.push(`<h${heading[1].length}>${renderInline(heading[2])}</h${heading[1].length}>`);
      continue;
    }
    const listItem = /^[-*]\s+(.+)$/.exec(line);
    if (listItem) {
      flushParagraph(paragraph, output);
      list.push(listItem[1]);
      continue;
    }
    flushList(list, output);
    paragraph.push(line);
  }

  if (inCode) output.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  flushParagraph(paragraph, output);
  flushList(list, output);
  return output.join("\n");
}
