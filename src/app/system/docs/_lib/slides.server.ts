import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  findVisibleSlideDeck,
  slideImagePath,
  slides,
  type ListedSlideDeck,
  type PlayableSlideDeck,
} from "../_data/slides";
import { requireDocsUser } from "./company-doc.server";

export const SLIDE_URL_LIFETIME = 60 * 60;

async function signSlideAsset(path: string): Promise<string | undefined> {
  try {
    const { data, error } = await getSupabaseAdmin().storage.from("system-docs")
      .createSignedUrl(path, SLIDE_URL_LIFETIME);
    return error ? undefined : data?.signedUrl;
  } catch {
    // 署名できなかった画像は表示対象から外し、取得できた画像だけで描画する。
    return undefined;
  }
}

export async function loadSlideDecks(): Promise<ListedSlideDeck[]> {
  await requireDocsUser("/system/docs/slides");
  return Promise.all(slides.filter(deck => deck.visible).sort((a, b) => a.order - b.order).map(async deck => ({
    ...deck,
    coverUrl: await signSlideAsset(slideImagePath(deck.id, 1)),
  })));
}

export async function loadSlideDeck(id: string, returnTo?: string): Promise<PlayableSlideDeck | undefined> {
  const deck = findVisibleSlideDeck(id);
  // 戻り先は承認済みデータのidからだけ作る。URLで受け取った文字列をそのまま使わない。
  const safeReturnTo = deck
    ? (returnTo?.endsWith("/present") ? `/system/docs/slides/${deck.id}/present` : `/system/docs/slides/${deck.id}`)
    : "/system/docs/slides";
  await requireDocsUser(safeReturnTo);
  if (!deck) return undefined;
  const signed = await Promise.all(Array.from({ length: deck.slideCount }, async (_, index) => {
    const slideIndex = index + 1;
    const src = await signSlideAsset(slideImagePath(deck.id, slideIndex));
    return src ? { index: slideIndex, src } : undefined;
  }));
  return { ...deck, slides: signed.filter(slide => slide !== undefined) };
}
