"use client";

import { Children, Fragment, isValidElement, type ReactNode } from "react";
import BoxSelect, { type BoxOption } from "./BoxSelect/BoxSelect";

// 既存の選択肢を使い、一覧の絞り込みを共通の箱で表示する。
function optionText(children: ReactNode): string {
  return Children.toArray(children).map(child => isValidElement<{ children?: ReactNode }>(child) ? optionText(child.props.children) : String(child)).join("");
}

function optionsFromChildren(children: ReactNode): BoxOption[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(child)) return [];
    if (child.type === Fragment || child.type === "optgroup") return optionsFromChildren(child.props.children);
    if (child.type !== "option" || child.props.disabled) return [];
    const label = optionText(child.props.children);
    return [{ value: String(child.props.value ?? label), label }];
  });
}

export default function ChoiceFilter({ label, value, onValueChange, disabled, children }: {
  label: string;
  value: string | number;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return <fieldset data-garden-box-select disabled={disabled} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
    <BoxSelect label={label} multiple={false} value={[String(value)]} options={optionsFromChildren(children)} onChange={values => onValueChange(values[0])} />
  </fieldset>;
}
