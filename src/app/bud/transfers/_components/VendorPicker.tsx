"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../_lib/supabase";
import { NewVendorModal } from "./NewVendorModal";
import { transferFormStyles as styles } from "./transferFormStyles";

export interface Vendor {
  id: string;
  vendor_name: string;
  payee_bank_name: string | null;
  payee_bank_code: string;
  payee_branch_name: string | null;
  payee_branch_code: string;
  payee_account_type: string;
  payee_account_number: string;
  payee_account_holder_kana: string | null;
}

interface Props {
  selectedVendorId: string;
  onSelect: (vendor: Vendor | null) => void;
  disabled?: boolean;
}

export function VendorPicker({
  selectedVendorId,
  onSelect,
  disabled,
}: Props) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("root_vendors")
        .select(
          "id, vendor_name, payee_bank_name, payee_bank_code, payee_branch_name, payee_branch_code, payee_account_type, payee_account_number, payee_account_holder_kana",
        )
        .order("vendor_name");
      if (!cancelled) setVendors((data ?? []) as Vendor[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const handleSelect = useCallback(
    (id: string) => {
      const v = vendors.find((x) => x.id === id) ?? null;
      onSelect(v);
    },
    [vendors, onSelect],
  );

  return (
    <div>
      <label className="block">
        <span className={styles.label}>取引先 *</span>
        <div className="flex gap-2 mt-1">
          <select
            value={selectedVendorId}
            onChange={(e) => handleSelect(e.target.value)}
            disabled={disabled}
            className={styles.fieldInline}
          >
            <option value="">選択してください</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vendor_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={disabled}
            className={styles.linkButton}
          >
            + 新規追加
          </button>
        </div>
      </label>
      <NewVendorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          setReloadKey((n) => n + 1);
        }}
      />
    </div>
  );
}
