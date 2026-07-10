export type TabScopeDocument = {
  getElementById(id: string): { classList: { contains(token: string): boolean } } | null;
};

export function isExpenseTabKeyboardScopeActive(doc: TabScopeDocument, tabId: string) {
  const tab = doc.getElementById(tabId);
  return !tab || tab.classList.contains("active");
}
