import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { videos, type PlayableDocVideo } from "../_data/videos";
import { requireDocsUser } from "./company-doc.server";

export const VIDEO_URL_LIFETIME = 60 * 60;

async function signVideoAsset(path: string): Promise<string | undefined> {
  try {
    const { data, error } = await getSupabaseAdmin().storage.from("system-docs")
      .createSignedUrl(path, VIDEO_URL_LIFETIME);
    return error ? undefined : data?.signedUrl;
  } catch {
    // 署名URLや内部エラーを表示・ログ出力せず、取得できた素材だけで描画する。
    return undefined;
  }
}

export async function loadVideos(): Promise<PlayableDocVideo[]> {
  // Layoutに頼らず、URL発行前にログイン・在籍を検証する。結果を共有キャッシュしない。
  await requireDocsUser("/system/docs/videos");
  return Promise.all(videos.filter(video => video.visible).sort((a, b) => a.order - b.order).map(async video => {
    // パスは承認済みの静的データだけから生成。利用者から任意のパスを受け取らない。
    const [videoUrl, posterUrl] = await Promise.all([
      signVideoAsset(`videos/${video.id}.mp4`),
      signVideoAsset(`videos/posters/${video.id}.webp`),
    ]);
    return { ...video, videoUrl, posterUrl };
  }));
}
