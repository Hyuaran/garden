import sanitizeHtml from "sanitize-html";

/** A restricted prototype is a read-only snapshot: denied screens and script
 * data never leave the server. With all tabs allowed the existing PoC works. */
export function leafPrototypeHtml(html: string, tab: string, restricted: boolean) {
  if (restricted) html = sanitizeHtml(html, {
    allowedTags: false, allowedAttributes: false, allowVulnerableTags: true,
    exclusiveFilter: frame => frame.tag === "script" ||
      (frame.attribs.id?.startsWith("screen-") === true && frame.attribs.id !== `screen-${tab}`),
    transformTags: { "*": (tagName, attributes) => ({ tagName, attribs: Object.fromEntries(Object.entries(attributes).filter(([key]) => !key.toLowerCase().startsWith("on"))) }) },
  });
  const style = `<style>.tab-bar{display:none!important}#screen-${tab}{display:block!important}</style>`;
  return html.replace("</head>", style + "</head>") + (restricted ? "" : `<script>switchTab(${JSON.stringify(tab)});</script>`);
}
