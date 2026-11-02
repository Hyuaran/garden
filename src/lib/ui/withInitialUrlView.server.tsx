import type { ComponentType, ReactNode } from "react";
import { InitialUrlView } from "./InitialUrlView";
type Query = Record<string, string | string[] | undefined>;
/** ページの searchParams をクライアント部品の初期値として渡す。 */
export function withInitialUrlView<P extends object>(Page: ComponentType<P>, clientPage = false) {
  return async function InitialUrlPage(props: P & { searchParams?: Promise<Query> }) {
    const query = await props.searchParams ?? {};
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) value.forEach(item => params.append(key, item));
      else if (value !== undefined) params.set(key, value);
    }
    const search = params.toString();
    const content = clientPage ? <Page {...props} /> : await (Page as (props: P) => ReactNode | Promise<ReactNode>)(props);
    return <InitialUrlView key={search} search={search}>{content}</InitialUrlView>;
  };
}
