"use client";
import { useEffect, useRef, useState } from "react";
import { postalDigits, splitAddress } from "@/lib/mail-forwarding/address";
import styles from "./page.module.css";

export default function AddressInputs({ name, label, initial }: { name: string; label: string; initial: string }) {
  const [fields, setFields] = useState(() => splitAddress(initial));
  const [choices, setChoices] = useState<{ address: string }[]>([]);
  const [notice, setNotice] = useState("");
  const currentAddress = useRef(fields.address);
  const revision = useRef(0);
  const code = postalDigits(fields.postal);
  useEffect(() => {
    setChoices([]); setNotice("");
    if (!/^[0-9]{7}$/.test(code)) return;
    const controller = new AbortController(), started = revision.current;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/root/postal?code=${code}`, { signal: controller.signal, cache: "no-store" });
        const body = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok || !Array.isArray(body.addresses) || !body.addresses.length) { setNotice("住所を直接入れてください"); return; }
        const addresses = body.addresses as { address: string }[];
        if (addresses.length === 1) {
          if (!currentAddress.current.trim() && started === revision.current) {
            currentAddress.current = addresses[0].address;
            setFields(previous => ({ ...previous, address: addresses[0].address }));
          }
        } else setChoices(addresses);
      } catch { if (!controller.signal.aborted) setNotice("住所を直接入れてください"); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [code]);
  return <div role="group" aria-label={label} className={styles.addressGroup}>
    <div className={styles.addressTitle}>{label}（必須）</div>
    <label>郵便番号<input name={`${name}_postal`} value={fields.postal} onChange={event => setFields({ ...fields, postal: event.target.value })} autoComplete="postal-code" /></label>
    <label>住所<input name={`${name}_address`} aria-label={`${label}（必須）`} required value={fields.address} onChange={event => { currentAddress.current = event.target.value; revision.current++; setFields({ ...fields, address: event.target.value }); }} /></label>
    <label>建物・部屋<input name={`${name}_building`} value={fields.building} onChange={event => setFields({ ...fields, building: event.target.value })} /></label>
    {notice && <p role="status">{notice}</p>}
    {choices.map(choice => <button key={choice.address} type="button" onClick={() => { currentAddress.current = choice.address; revision.current++; setFields({ ...fields, address: choice.address }); setChoices([]); }}>{choice.address}</button>)}
  </div>;
}
