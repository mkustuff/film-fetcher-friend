import type { CatalogueTitle, Episode } from "./site-data";

type RawRecord = Record<string, unknown>;

const stringValue = (value: unknown) => typeof value === "string" && value.trim() ? value : undefined;
const numberValue = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : undefined;

export function optimizedArtwork(url?: string, width = 640) {
  if (!url) return url;
  if (url.includes("res.cloudinary.com/")) { if (url.includes("/f_auto,")) return url; return url.replace("/upload/", `/upload/f_auto,q_auto:eco,c_fill,w_${Math.min(width,1280)},dpr_auto/`); }
  if (url.includes("i.vimeocdn.com/")) { try { const u=new URL(url); u.searchParams.set("mw",String(Math.min(Math.max(400,width),1280))); u.searchParams.set("q","76"); return u.toString(); } catch { return url; } }
  if (url.includes("drive.google.com/thumbnail")) return url.replace(/([?&])sz=w\d+/, `$1sz=w${Math.min(800,Math.max(400,width))}`);
  return url;
}

export function episodeArtwork(episode: Pick<Episode, "poster" | "vimeoVideoId">, fallback?: string) {
  return episode.poster || (episode.vimeoVideoId ? `https://vumbnail.com/${encodeURIComponent(episode.vimeoVideoId)}.jpg` : undefined) || fallback;
}

export function episodeContentId(item: Pick<CatalogueTitle, "slug">, episode: Episode, absoluteIndex: number) {
  return episode.legacyKey || episode.id || `${item.slug}-${absoluteIndex + 1}`;
}

export function orderedEpisodes(item: Pick<CatalogueTitle, "slug" | "episodes">) {
  const seen = new Set<string>();
  return (item.episodes ?? [])
    .map((episode, sourceIndex) => ({ episode, sourceIndex }))
    .filter(({episode,sourceIndex}) => {
      const key = `${episode.season ?? 1}:${episode.episodeNumber ?? sourceIndex + 1}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) =>
      (a.episode.season ?? 1) - (b.episode.season ?? 1) ||
      (a.episode.episodeNumber ?? a.sourceIndex + 1) - (b.episode.episodeNumber ?? b.sourceIndex + 1) ||
      a.sourceIndex - b.sourceIndex,
    )
    .map(({ episode }, absoluteIndex) => ({
      episode,
      absoluteIndex,
      season: episode.season ?? 1,
      episodeNumber: episode.episodeNumber ?? absoluteIndex + 1,
      contentId: episodeContentId(item, episode, absoluteIndex),
    }));
}

export function mapResolvedEpisodes(rawEpisodes: unknown[], rawSeasons: unknown[] = []): Episode[] {
  const seasons = rawSeasons.filter((value): value is RawRecord => Boolean(value && typeof value === "object"));
  const seasonNumber = (seasonId: unknown) =>
    numberValue(seasons.find((season) => season["id"] === seasonId)?.["season_number"]) ?? 1;

  const mapped = rawEpisodes
    .filter((value): value is RawRecord => Boolean(value && typeof value === "object"))
    .map((raw, sourceIndex) => {
      const seconds = numberValue(raw["duration_seconds"]);
      const id = stringValue(raw["id"]);
      const vimeoVideoId = stringValue(raw["vimeo_video_id"]);
      const poster = stringValue(raw["thumbnail_url"]);
      const description = stringValue(raw["description"]);
      const legacyKey = stringValue(raw["legacy_key"]);
      const previewVimeoVideoId = stringValue(raw["preview_vimeo_video_id"]);
      const previewEmbedUrl = stringValue(raw["preview_embed_url"]) || stringValue(raw["trailer_embed_url"]);
      const previewStart = numberValue(raw["preview_start_seconds"]);
      const previewDuration = numberValue(raw["preview_duration_seconds"]);
      const introStart = numberValue(raw["intro_start_seconds"]);
      const introEnd = numberValue(raw["intro_end_seconds"]);
      const recapStart = numberValue(raw["recap_start_seconds"]);
      const recapEnd = numberValue(raw["recap_end_seconds"]);
      const creditsStart = numberValue(raw["credits_start_seconds"]);
      return {
        ...(id ? { id } : {}),
        title: stringValue(raw["title"]) || `Episode ${sourceIndex + 1}`,
        season: numberValue(raw["season_number"]) ?? seasonNumber(raw["season_id"]),
        episodeNumber: numberValue(raw["episode_number"]) ?? sourceIndex + 1,
        duration: stringValue(raw["duration"]) || (seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : ""),
        ...(vimeoVideoId ? { vimeoVideoId } : {}),
        ...(poster ? { poster } : {}),
        locked: typeof raw["access_required"] === "boolean" ? raw["access_required"] : true,
        ...(description ? { description } : {}),
        ...(legacyKey ? { legacyKey } : {}),
        ...(previewStart !== undefined ? { previewStart } : {}),
        ...(previewDuration !== undefined ? { previewDuration } : {}),
        ...(previewVimeoVideoId ? { previewVimeoVideoId } : {}),
        ...(previewEmbedUrl ? { previewEmbedUrl } : {}),
        ...(introStart !== undefined ? { introStart } : {}),
        ...(introEnd !== undefined ? { introEnd } : {}),
        ...(recapStart !== undefined ? { recapStart } : {}),
        ...(recapEnd !== undefined ? { recapEnd } : {}),
        ...(creditsStart !== undefined ? { creditsStart } : {}),
      } satisfies Episode;
    })
    .sort((a, b) => (a.season ?? 1) - (b.season ?? 1) || (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0));
  const byEpisode = new Map<string, Episode>();
  for (const episode of mapped) {
    const key = `${episode.season ?? 1}:${episode.episodeNumber ?? 0}`;
    const current = byEpisode.get(key);
    if (!current || (!current.poster?.includes("i.vimeocdn.com/") && episode.poster?.includes("i.vimeocdn.com/"))) byEpisode.set(key, episode);
  }
  return [...byEpisode.values()].sort((a,b)=>(a.season??1)-(b.season??1)||(a.episodeNumber??0)-(b.episodeNumber??0));
}

export function episodeLabel(episode: Episode, fallbackNumber: number) {
  return `S${episode.season ?? 1} E${episode.episodeNumber ?? fallbackNumber}`;
}