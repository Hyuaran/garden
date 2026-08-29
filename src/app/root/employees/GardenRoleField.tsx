"use client";

import { SelectField, TextField } from "../_components/FormField";
import {
  GARDEN_ROLE_LABELS,
  GARDEN_ROLE_SELECTABLE_OPTIONS,
  type GardenRole,
} from "../_constants/types";

const CHANGE_DISABLED_TITLE = "Garden権限の変更は全権管理者のみ行えます";

export function GardenRoleField({
  label = "Garden権限",
  operatorRole,
  value,
  onChange,
}: {
  label?: string;
  operatorRole: GardenRole | null | undefined;
  value: GardenRole;
  onChange: (role: GardenRole) => void;
}) {
  if (value === "super_admin") {
    return (
      <TextField
        label={label}
        value={GARDEN_ROLE_LABELS.super_admin}
        disabled
        title="全権管理者のGarden権限は画面から変更できません"
        readOnly
      />
    );
  }

  const canEdit = operatorRole === "super_admin";
  return (
    <SelectField
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as GardenRole)}
      disabled={!canEdit}
      title={!canEdit ? CHANGE_DISABLED_TITLE : undefined}
    >
      {GARDEN_ROLE_SELECTABLE_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </SelectField>
  );
}
