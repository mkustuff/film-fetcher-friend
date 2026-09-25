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

export function episodeContentId(item: Pick<CatalogueTitle, "slug">, episode: Episode, absoluteIndex: number) {
  return episode.legacyKey || episode.id || `${item.slug}-${absoluteIndex + 1}`;
}

export function orderedEpisodes(item: Pick<CatalogueTitle, "slug" | "episodes">) {
  return (item.episodes ?? [])
    .map((episode, sourceIndex) => ({ episode, sourceIndex }))
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

function episodeCandidateScore(raw: RawRecord, season: number) {
  const status = stringValue(raw["status"])?.toLowerCase();
  const thumbnail = stringValue(raw["thumbnail_url"]) || "";
  const vimeoVideoId = stringValue(raw["vimeo_video_id"]) || "";
  let score = 0;
  if (status === "published") score += 100;
  if (vimeoVideoId) score += 20;
  if (thumbnail.includes("i.vimeocdn.com/")) score += 40;
  if (thumbnail) score += 5;
  if (stringValue(raw["legacy_key"])) score += 5;
  score += season > 0 ? 1 : 0;
  return score;
}

function dedupeRawEpisodes(rawEpisodes: unknown[], rawSeasons: RawRecord[]) {
  const seasonNumber = (seasonId: unknown) =>
    numberValue(rawSeasons.find((season) => season["id"] === seasonId)?.["season_number"]) ?? 1;
  const selected = new Map<string, { raw: RawRecord; season: number; sourceIndex: number; score: number }>();

  rawEpisodes
    .filter((value): value is RawRecord => Boolean(value && typeof value === "object"))
    .forEach((raw, sourceIndex) => {
      const season = numberValue(raw["season_number"]) ?? seasonNumber(raw["season_id"]);
      const episodeNumber = numberValue(raw["episode_number"]) ?? sourceIndex + 1;
      const key = `${season}:${episodeNumber}`;
      const candidate = { raw, season, sourceIndex, score: episodeCandidateScore(raw, season) };
      const previous = selected.get(key);
      if (!previous || candidate.score > previous.score) selected.set(key, candidate);
    });

  return [...selected.values()]
    .sort((a, b) => a.season - b.season || (numberValue(a.raw["episode_number"]) ?? a.sourceIndex + 1) - (numberValue(b.raw["episode_number"]) ?? b.sourceIndex + 1) || a.sourceIndex - b.sourceIndex)
    .map(({ raw }) => raw);
}

export function mapResolvedEpisodes(rawEpisodes: unknown[], rawSeasons: unknown[] = []): Episode[] {
  const seasons = rawSeasons.filter((value): value is RawRecord => Boolean(value && typeof value === "object"));
  const deduped = dedupeRawEpisodes(rawEpisodes, seasons);

  return deduped
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
}

export function episodeLabel(episode: Episode, fallbackNumber: number) {
  return `S${episode.season ?? 1} E${episode.episodeNumber ?? fallbackNumber}`;
}