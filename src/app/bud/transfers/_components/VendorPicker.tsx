"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../_lib/supabase";
import { NewVendorModal } from "./NewVendorModal";

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
        <span className="text-xs text-gray-600">取引先 *</span>
        <div className="flex gap-2 mt-1">
          <select
            value={selectedVendorId}
            onChange={(e) => handleSelect(e.target.value)}
            disabled={disabled}
            className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
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
            className="bg-white border border-emerald-600 text-emerald-600 text-sm px-3 py-2 rounded hover:bg-emerald-50"
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
