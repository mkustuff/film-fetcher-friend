import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CatalogueTitle, Episode } from "@/lib/site-data";
import { useCatalogue } from "@/lib/catalogue";
import {
  formatWatchTime,
  readProgress,
  type WatchProgress,
} from "@/lib/watch-progress";
import { getWatchProgress } from "@/lib/avant-backend";
import { customerToken } from "@/lib/google-auth";
import { ArtworkImage } from "./ArtworkImage";

type ProgressRow = {
  item: CatalogueTitle;
  episode: Episode;
  index: number;
  progress: WatchProgress;
};

export function ContinueWatching() {
  const { items } = useCatalogue();
  const [progress, setProgress] = useState<WatchProgress[]>([]);
  const [serverProgress, setServerProgress] = useState<WatchProgress[]>([]);
  useEffect(() => {
    const sync = () => setProgress(readProgress());
    sync();
    let cancelled = false;
    customerToken(false).then(async (token) => {
      if (!token || cancelled) return;
      try {
        const result = await getWatchProgress(token);
        if (cancelled) return;
        const remote = (result.progress ?? [])
          .filter((row: any) => row.legacy_key)
          .map((row: any) => ({
            contentId: row.legacy_key,
            seconds: Number(row.progress_seconds) || 0,
            duration: Number(row.duration_seconds) || undefined,
            updatedAt: Date.parse(row.last_watched_at) || Date.now(),
          }));
        setServerProgress(remote);
      } catch {
        /* local progress remains available */
      }
    });
    window.addEventListener("avant-progress", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("avant-progress", sync);
    };
  }, []);

  const rows = useMemo(() => {
    const merged = new Map<string, WatchProgress>();
    [...progress, ...serverProgress].forEach((entry) => {
      const previous = merged.get(entry.contentId);
      if (!previous || entry.updatedAt >= previous.updatedAt) merged.set(entry.contentId, entry);
    });
    const combined = [...merged.values()];
    const episodes = items.flatMap((item) =>
      (item.episodes ?? []).map((episode, index) => ({ item, episode, index })),
    );
    return combined
      .filter((entry) => !entry.duration || entry.seconds < entry.duration * 0.95)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .flatMap((entry): ProgressRow[] => {
        const match = episodes.find(
          ({ item, episode, index }) =>
            entry.contentId === (episode.legacyKey ?? `${item.slug}-${index + 1}`),
        );
        return match ? [{ ...match, progress: entry }] : [];
      });
  }, [progress, serverProgress, items]);

  if (!rows.length) return null;

  return (
    <section className="py-5" aria-labelledby="continue-watching-heading">
      <div className="mb-4 px-5 sm:px-10 lg:px-14">
        <h2 id="continue-watching-heading" className="text-xl font-bold sm:text-2xl">
          Continue Watching
        </h2>
      </div>
      <div className="hide-scrollbar avant-horizontal-rail avant-rail-fade flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 overscroll-x-contain px-5 pb-5 touch-pan-y sm:scroll-px-10 sm:px-10 lg:scroll-px-14 lg:px-14">
        {rows.map(({ item, episode, index, progress: entry }) => {
          const percent = entry.duration
            ? Math.min(100, Math.max(4, (entry.seconds / entry.duration) * 100))
            : null;
          return (
            <Link
              key={entry.contentId}
              to="/watch/$contentId"
              params={{ contentId: entry.contentId }}
              className="group relative w-[72vw] max-w-[18rem] shrink-0 snap-start min-[420px]:w-[64vw] sm:w-[18rem] sm:max-w-none lg:w-[21rem] rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="relative aspect-video overflow-hidden rounded-md bg-surface">
                <ArtworkImage
                  src={episode.poster}
                  vimeoVideoId={episode.vimeoVideoId}
                  fallbacks={[item.backdrop, item.artwork]}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition duration-300 group-hover:scale-105"
                />
                <span className="absolute inset-0 grid place-items-center bg-black/20 opacity-100 transition md:opacity-0 md:group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Play className="size-9 fill-white" />
                </span>
                {percent !== null ? (
                  <span className="absolute inset-x-0 bottom-0 h-1 bg-white/20" aria-hidden="true">
                    <span
                      className="block h-full bg-white transition-[width] duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm font-bold">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                Episode {episode.episodeNumber ?? index + 1} ·{" "}
                {percent !== null
                  ? `${Math.round(percent)}% watched`
                  : `Resume at ${formatWatchTime(entry.seconds)}`}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
