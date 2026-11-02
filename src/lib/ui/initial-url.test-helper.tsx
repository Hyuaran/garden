import { render, type RenderOptions } from "@testing-library/react";
import { createElement, type ReactElement, type ReactNode } from "react";
import { InitialUrlView } from "./InitialUrlView";
/** Component tests supply the same initial search that their server page supplies. */
export function renderWithInitialUrl(ui:ReactElement,options:RenderOptions={}) {
  const Wrapper=options.wrapper;
  return render(ui,{...options,wrapper:({children}:{children:ReactNode})=><InitialUrlView search={window.location.search}>{Wrapper?createElement(Wrapper,null,children):children}</InitialUrlView>});
}
