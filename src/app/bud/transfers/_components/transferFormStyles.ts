export const transferFormStyles = {
  shell: "mx-auto max-w-6xl space-y-5 px-4 pb-10 text-text-main",
  title: "font-shippori text-2xl font-semibold text-text-main",
  formGrid: "grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[0.95fr_1.05fr]",
  column: "grid gap-[18px]",
  panel:
    "relative overflow-hidden rounded-[14px] border border-[rgba(180,137,46,0.28)] bg-[linear-gradient(135deg,rgba(255,255,255,.92),rgba(255,250,238,.82))] shadow-[0_18px_45px_rgba(77,54,20,.10),0_2px_10px_rgba(77,54,20,.06)] backdrop-blur-sm dark:bg-bg-card-solid",
  softPanel:
    "relative overflow-hidden rounded-[14px] border border-[rgba(180,137,46,0.28)] bg-[linear-gradient(145deg,rgba(255,253,247,.94),rgba(251,242,220,.84))] shadow-[0_18px_45px_rgba(77,54,20,.10),0_2px_10px_rgba(77,54,20,.06)] backdrop-blur-sm dark:bg-bg-card-solid",
  cardHeader: "flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 px-[22px] pb-2.5 pt-[18px]",
  cardBody: "px-[22px] pb-[22px] pt-3",
  panelTitle:
    "m-0 flex min-w-0 items-center gap-2.5 font-shippori text-lg font-medium tracking-[0.08em] text-text-main sm:text-xl",
  titleIcon:
    "grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border border-[rgba(212,165,65,0.45)] bg-[#fffaf0] text-base text-[#b3892e] dark:bg-bg-card-solid",
  ocrPanel:
    "relative min-h-[184px] overflow-hidden rounded-[14px] border border-[rgba(180,137,46,0.28)] bg-[linear-gradient(135deg,rgba(255,255,255,.92),rgba(255,250,238,.82))] shadow-[0_18px_45px_rgba(77,54,20,.10),0_2px_10px_rgba(77,54,20,.06)] backdrop-blur-sm dark:bg-bg-card-solid",
  ocrText: "max-w-[420px] text-sm leading-[1.9] tracking-[0.04em] text-text-sub",
  fieldGrid: "grid grid-cols-1 gap-3.5",
  fieldGridTwo: "grid grid-cols-1 gap-3.5 sm:grid-cols-2",
  fullSpan: "sm:col-span-2",
  label: "mb-[7px] block text-[13px] tracking-[0.07em] text-text-sub",
  field:
    "flex min-h-12 w-full items-center rounded-[10px] border border-[rgba(179,137,46,0.25)] bg-bg-card-solid px-3.5 py-0 text-sm tracking-[0.04em] text-text-main shadow-inner outline-none transition focus:border-accent-gold focus:ring-2 focus:ring-[rgba(212,165,65,0.18)] disabled:bg-bg-card disabled:text-text-muted",
  fieldInline:
    "flex min-h-12 flex-1 items-center rounded-[10px] border border-[rgba(179,137,46,0.25)] bg-bg-card-solid px-3.5 py-0 text-sm tracking-[0.04em] text-text-main shadow-inner outline-none transition focus:border-accent-gold focus:ring-2 focus:ring-[rgba(212,165,65,0.18)] disabled:bg-bg-card disabled:text-text-muted",
  radio: "accent-[var(--accent-gold)]",
  radioLabel:
    "inline-flex cursor-pointer items-center gap-2 text-sm text-text-main",
  hint: "text-xs text-text-muted",
  error: "text-xs text-text-warning",
  infoCard:
    "space-y-0.5 rounded-[10px] border border-[rgba(179,137,46,0.14)] bg-[rgba(212,165,65,0.08)] p-3 text-xs text-text-sub",
  secondaryButton:
    "inline-flex h-[42px] items-center justify-center rounded-[10px] border border-[rgba(180,137,46,0.34)] bg-[rgba(255,253,247,.78)] px-5 text-sm tracking-[0.06em] text-text-sub shadow-[0_8px_18px_rgba(77,54,20,.05)] transition hover:border-[rgba(179,137,46,0.44)] hover:bg-bg-card-hover disabled:opacity-50 dark:bg-bg-card-solid",
  mutedButton:
    "inline-flex h-[42px] items-center justify-center rounded-[10px] border border-[rgba(180,137,46,0.34)] bg-[rgba(255,253,247,.78)] px-5 text-sm tracking-[0.06em] text-text-main shadow-[0_8px_18px_rgba(77,54,20,.05)] transition hover:bg-[rgba(212,165,65,0.10)] disabled:opacity-50 dark:bg-bg-card-solid",
  goldButton:
    "inline-flex h-[42px] min-w-[148px] items-center justify-center rounded-[10px] bg-accent-gold px-4 text-sm font-medium tracking-[0.06em] text-white shadow-[0_12px_26px_rgba(179,137,46,.26)] transition hover:bg-[#b3892e] disabled:opacity-50 sm:min-w-[184px] sm:px-5",
  smallGoldButton:
    "rounded-garden-input bg-accent-gold px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#b3892e] disabled:opacity-50",
  linkButton:
    "inline-flex min-h-12 items-center justify-center rounded-[10px] border border-[rgba(180,137,46,0.34)] bg-[rgba(255,253,247,.78)] px-4 text-sm tracking-[0.06em] text-text-main shadow-[0_8px_18px_rgba(77,54,20,.05)] transition hover:bg-[rgba(212,165,65,0.10)] disabled:opacity-50 dark:bg-bg-card-solid",
  partnerRow: "grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_112px]",
  segmented:
    "grid h-12 grid-cols-2 rounded-[10px] border border-[rgba(179,137,46,0.25)] bg-bg-card-solid p-[5px]",
  segmentOption:
    "grid cursor-pointer place-items-center rounded-lg text-sm text-text-sub transition",
  segmentOptionActive:
    "bg-accent-gold text-white shadow-garden-soft",
  sourceOptions: "grid grid-cols-1 gap-2.5 sm:grid-cols-3",
  sourceOption:
    "grid min-h-[78px] cursor-pointer content-center gap-1 rounded-[12px] border border-[rgba(180,137,46,0.23)] bg-[rgba(255,253,247,.78)] p-3 text-text-main transition dark:bg-bg-card-solid",
  sourceOptionActive:
    "border-[rgba(212,165,65,0.72)] bg-[rgba(212,165,65,0.10)] shadow-garden-soft",
  sourceOptionTitle: "text-[15px] font-medium",
  sourceOptionText: "text-[11px] leading-[1.4] text-text-muted",
  fileBox:
    "grid min-h-[102px] place-items-center gap-2 rounded-[12px] border border-dashed border-[rgba(180,137,46,0.45)] bg-[linear-gradient(145deg,rgba(255,253,247,.78),rgba(255,248,229,.70))] p-[18px] text-center text-text-sub dark:bg-bg-card-solid",
  fileBoxTitle: "text-[15px] font-medium text-text-main",
  fileBoxText: "text-xs text-text-muted",
  footerPanel:
    "mt-5 flex flex-col justify-between gap-[18px] rounded-[14px] border border-[rgba(180,137,46,0.28)] bg-[rgba(255,253,247,.84)] px-[22px] py-[18px] shadow-[0_18px_45px_rgba(77,54,20,.10),0_2px_10px_rgba(77,54,20,.06)] lg:flex-row lg:items-center dark:bg-bg-card-solid",
  flowNote:
    "flex items-center gap-[13px] text-sm tracking-[0.05em] text-text-sub",
  flowRound:
    "grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full border border-[rgba(212,165,65,0.38)] bg-[#fffaf0] text-[#b3892e] dark:bg-bg-card-solid",
  footerButtons: "flex flex-wrap justify-end gap-3",
  alert:
    "rounded-[12px] border border-[rgba(201,90,74,0.28)] bg-[rgba(201,90,74,0.08)] p-3 text-sm text-text-warning",
};
