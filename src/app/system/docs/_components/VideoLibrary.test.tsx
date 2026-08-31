import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import VideoLibrary from "./VideoLibrary";
import { groupVideos, videos } from "../_data/videos";

const playable = videos.map(video => ({ ...video, videoUrl: `https://example.com/${video.id}.mp4`, posterUrl: `https://example.com/${video.id}.webp` }));

describe("動画一覧", () => {
  afterEach(() => vi.restoreAllMocks());
  it("並びが逆の入力も指定順にし、区分1本・4本でまとめる", () => {
    render(<VideoLibrary videos={[...playable].reverse()} />);
    const groups = screen.getAllByRole("region");
    expect(groups.map(group => group.getAttribute("aria-labelledby"))).toEqual(["video-category-0", "video-category-1"]);
    expect(within(screen.getByRole("region", { name: "面接のとき" })).getAllByRole("article")).toHaveLength(1);
    expect(within(screen.getByRole("region", { name: "入社したら" })).getAllByRole("article")).toHaveLength(4);
    expect(screen.getAllByRole("heading", { level: 3 }).map(h => h.textContent)).toEqual(playable.map(v => v.title));
    for (const video of playable) expect(screen.getByText(`所要時間：${video.duration}`)).toBeInTheDocument();
  });
  it("同一区分はorderが離れていてもまとめ、入力を変更しない", () => {
    const input = [playable[1], { ...playable[0], order: 10 }, { ...playable[2], category: "面接のとき", order: 1 }];
    const original = [...input]; const result = groupVideos(input);
    expect(result.map(group => group.category)).toEqual(["面接のとき", "入社したら"]);
    expect(result[0].videos.map(video => video.order)).toEqual([1, 10]);
    expect(input).toEqual(original);
  });
  it("非表示項目はHTMLにも動画URLにも含めない", () => {
    const { container } = render(<VideoLibrary videos={[...playable, { ...playable[0], id: "hidden", title: "秘密の動画", visible: false, videoUrl: "https://example.com/hidden.mp4" }]} />);
    expect(container.innerHTML).not.toContain("hidden.mp4");
    expect(screen.queryByText("秘密の動画")).not.toBeInTheDocument();
  });
  it("5本すべてをページ内のネイティブプレーヤーとポスターで表示する", () => {
    const { container } = render(<VideoLibrary videos={playable} />);
    const players = container.querySelectorAll("video"); expect(players).toHaveLength(5);
    players.forEach((player, index) => {
      expect(player).toHaveAttribute("controls"); expect(player).toHaveAttribute("playsinline");
      expect(player).toHaveAttribute("preload", "metadata"); expect(player).toHaveAttribute("poster", playable[index].posterUrl);
      expect(player).not.toHaveAttribute("autoplay");
    });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("ポスターが取得できなくても5本すべての動画と説明を表示する", () => {
    const { container } = render(<VideoLibrary videos={playable.map(video => ({ ...video, posterUrl: undefined }))} />);
    expect(container.querySelectorAll("video")).toHaveLength(5);
    expect(container.querySelector("video[poster]")).toBeNull();
    playable.forEach(video => expect(screen.getByText(video.description)).toBeInTheDocument());
  });
  it("別の動画の再生時に再生中の動画だけを止める", () => {
    const { container } = render(<VideoLibrary videos={playable} />);
    const players = [...container.querySelectorAll("video")];
    const pauses = players.map(player => vi.spyOn(player, "pause").mockImplementation(() => {}));
    Object.defineProperty(players[0], "paused", { value: false });
    fireEvent.play(players[1]);
    expect(pauses[0]).toHaveBeenCalledTimes(1);
    pauses.slice(1).forEach(pause => expect(pause).not.toHaveBeenCalled());
  });
  it("動画の読み込み失敗は再読込案内を出し、題名・説明を残す", () => {
    render(<VideoLibrary videos={playable} />);
    fireEvent.error(screen.getByLabelText("会社紹介の動画"));
    expect(screen.getByRole("status")).toHaveTextContent("ページを再読み込みしてお試しください");
    expect(screen.getByRole("heading", { name: "会社紹介" })).toBeInTheDocument();
  });
  it("動画の署名失敗でもカードを残し、壊れた空srcを出さない", () => {
    const { container } = render(<VideoLibrary videos={[{ ...playable[0], videoUrl: undefined }]} />);
    expect(screen.getByRole("article", { name: "会社紹介" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(container.querySelector("video")).toBeNull();
  });
  it("小画面用の再生ボタンも実プレーヤーを操作し、ネイティブ操作と表示を同期する", async () => {
    const { container } = render(<VideoLibrary videos={[playable[0]]} />);
    const player = container.querySelector("video")!;
    const play = vi.spyOn(player, "play").mockResolvedValue();
    const pause = vi.spyOn(player, "pause").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "会社紹介を再生" }));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    Object.defineProperty(player, "paused", { configurable: true, value: false });
    fireEvent.play(player);
    fireEvent.click(screen.getByRole("button", { name: "会社紹介を一時停止" }));
    expect(pause).toHaveBeenCalledTimes(1);
    fireEvent.pause(player);
    expect(screen.getByRole("button", { name: "会社紹介を再生" })).toBeInTheDocument();
  });
  it("再生要求が失敗しても未処理の例外にせず案内を表示する", async () => {
    const { container } = render(<VideoLibrary videos={[playable[0]]} />);
    vi.spyOn(container.querySelector("video")!, "play").mockRejectedValue(new Error("not allowed"));
    fireEvent.click(screen.getByRole("button", { name: "会社紹介を再生" }));
    expect(await screen.findByRole("status")).toBeInTheDocument();
  });
});
