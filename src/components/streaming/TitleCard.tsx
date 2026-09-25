import { Check, ChevronDown, Play, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CatalogueTitle } from "@/lib/site-data";
import { optimizedArtwork } from "@/lib/episodes";
import { useNetworkQuality, getAdaptiveImageWidth } from "@/lib/network";
import { freeContentId, isFreeTitle } from "@/lib/catalogue";
import { readMyList, toggleMyList } from "@/lib/my-list";
import { customerToken } from "@/lib/google-auth";
import { useAvantAuth } from "@/lib/avant-auth";
import { TitlePreviewModal } from "./TitlePreviewModal";
import {
  accessForContent,
  cachedSubscriber,
  subscribeAccessChanged,
  type AccessState,
} from "@/lib/avant-backend";

export function TitleCard({
  item,
  layout = "rail",
  badgeLabel,
}: {
  item: CatalogueTitle;
  layout?: "rail" | "grid";
  badgeLabel?: string;
}) {
  const {user:authUser,remembered,signIn}=useAvantAuth();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saved, setSaved] = useState(() => readMyList().includes(item.id));
  const [travelMode, setTravelMode] = useState(() => typeof window !== "undefined" ? localStorage.getItem("avant-travel-mode") === "true" : false);
  const cardRef = useRef<HTMLElement | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const [showHoverVideo, setShowHoverVideo] = useState(false);
  const [hoverVideoReady, setHoverVideoReady] = useState(false);
  const hoverVimeoId = item.previewVimeoId || item.vimeoVideoId || item.episodes?.[0]?.vimeoVideoId;
  const startHoverPreview = () => {
    if (typeof window !== "undefined" && window.matchMedia("(hover: none), (pointer: coarse)").matches) return;
    if (!hoverVimeoId || travelMode || hoverTimerRef.current) return;
    hoverTimerRef.current = window.setTimeout(() => { setHoverVideoReady(false); setShowHoverVideo(true); hoverTimerRef.current = null; }, 1800);
  };
  const stopHoverPreview = () => {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
    setShowHoverVideo(false);
    setHoverVideoReady(false);
  };
  const detailsButtonRef = useRef<HTMLButtonElement | null>(null);
  const firstEpisode = item.episodes?.[0];
  const freeFullTitle = isFreeTitle(item);
  const playableContentId = freeContentId(item);
  const accessLabel = item.available ? "Watch now" : "Coming soon";
  const imageCandidates = useMemo(() => Array.from(new Set([item.artwork, item.backdrop].filter(Boolean) as string[])), [item.artwork, item.backdrop]);
  const [imageIndex, setImageIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const { tier } = useNetworkQuality();
  const activeImage = imageCandidates[imageIndex] || "";

  useEffect(() => {
    setImageLoaded(false);
    stopHoverPreview();
  }, [activeImage, item.id]);
  useEffect(() => () => { if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current); }, []);

  useEffect(() => {
    const sync = (e: any) => setTravelMode(e.detail.active);
    window.addEventListener("avant:travel-mode-changed" as any, sync);
    return () => window.removeEventListener("avant:travel-mode-changed" as any, sync);
  }, []);

  const toggleSaved = async (event: React.MouseEvent) => {
    event.stopPropagation();
    const token = await customerToken(false);
    if (!token && !authUser) {
      try { await signIn(remembered?.email); } catch { return; }
    }
    setSaved(toggleMyList(item.id).includes(item.id));
  };

  return (
    <article
      ref={cardRef}
      onMouseEnter={startHoverPreview}
      onMouseLeave={stopHoverPreview}
      className={
        layout === "grid"
          ? "group relative z-0 w-full min-w-0 md:hover:z-30"
          : "group relative z-0 w-[90vw] max-w-[24rem] shrink-0 min-[420px]:w-[88vw] sm:w-[18rem] md:hover:z-30 lg:w-[21rem] lg:max-w-none"
      }
    >
      <div className="relative overflow-hidden rounded-lg border border-white/[.055] bg-surface shadow-[0_10px_28px_rgba(0,0,0,.22)] transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(.16,1,.3,1)] md:origin-center md:group-hover:-translate-y-2 md:group-hover:scale-[1.085] md:group-hover:border-white/[.16] md:group-hover:shadow-[0_30px_72px_rgba(0,0,0,.82)]">
        <button
          ref={detailsButtonRef}
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="relative block aspect-video w-full overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
        >
          {!imageLoaded && activeImage ? <div className="avant-skeleton absolute inset-0 z-0" aria-hidden="true" /> : null}
          {activeImage ? <img
            key={activeImage}
            src={optimizedArtwork(activeImage, getAdaptiveImageWidth(layout === "grid" ? 720 : 640, tier))}
            alt={`${item.title} ${item.type === "movie" ? "movie" : "series"} artwork`}
            loading="lazy"
            fetchPriority="auto"
            decoding="async"
            onLoad={() => setImageLoaded(true)}
            onError={() => { setImageLoaded(false); setImageIndex((current) => current + 1); }}
            className={`size-full object-cover transition-[opacity,transform,filter] duration-500 ease-[cubic-bezier(.16,1,.3,1)] md:group-hover:scale-[1.08] md:group-hover:brightness-[.72] ${imageLoaded ? "opacity-100" : "opacity-0"}`} data-adaptive-artwork="true" data-layout={layout}
          /> : <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_25%_20%,rgba(255,122,24,.24),transparent_32%),linear-gradient(135deg,#17191f_0%,#090a0d_62%,#030303_100%)] p-5">
            <div className="max-w-[85%] text-left">
              <span className="block text-[10px] font-black uppercase tracking-[.22em] text-orange-400">Avant Cinema</span>
              <span className="mt-2 block text-xl font-black leading-[.95] tracking-[-.035em] text-white sm:text-2xl">{item.title}</span>
              <span className="mt-3 block text-[10px] font-semibold uppercase tracking-[.16em] text-white/45">{item.type === "series" ? "Original Series" : "Original Film"}</span>
            </div>
          </div>}
          {showHoverVideo && hoverVimeoId ? <div className={`pointer-events-none absolute inset-0 z-[5] transition-opacity duration-500 ${hoverVideoReady ? "opacity-100" : "opacity-0"}`}><iframe src={`https://player.vimeo.com/video/${hoverVimeoId}?autoplay=1&muted=1&controls=0&loop=1&autopause=0&playsinline=1&dnt=1&api=1`} title={`${item.title} preview`} onLoad={() => setHoverVideoReady(true)} className="absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 border-0" allow="autoplay; encrypted-media; picture-in-picture" tabIndex={-1}/><span className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/15"/></div> : null}
          {badgeLabel || item.featured || travelMode ? (
            <span className={`absolute left-2.5 top-2.5 rounded-sm px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-primary-foreground shadow-reel ${travelMode ? "bg-blue-600" : (item.featured ? "bg-amber-500" : "bg-primary")}`}>
              {(travelMode && "Data Saver") || (item.featured && "Featured") || badgeLabel}
            </span>
          ) : null}
          <span className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(0,0,0,.16)_52%,rgba(0,0,0,.92)_100%)] opacity-90 transition-opacity duration-500 md:opacity-0 md:group-hover:opacity-100" />
          <span className="absolute inset-x-0 bottom-0 p-3 text-white md:hidden">
            <span className="block text-sm font-bold leading-tight">{item.title}</span>
            <span className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-white/70">
              <Play className="size-3 fill-current" />
              {accessLabel}
            </span>
          </span>
        </button>
        <div className="hidden h-0 overflow-hidden bg-[#181818] opacity-0 transition-[height,opacity] duration-500 ease-[cubic-bezier(.16,1,.3,1)] md:block md:group-hover:h-[5.2rem] md:group-hover:opacity-100">
          <div className="flex items-center gap-2 px-3 pt-2">
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              aria-label={`Play ${item.title}`}
              className="grid size-9 place-items-center rounded-full bg-white text-black"
            >
              <Play className="size-4 fill-current" />
            </button>
            <button
              type="button"
              onClick={toggleSaved}
              aria-label={saved ? "Remove from My List" : "Add to My List"}
              className="grid size-9 place-items-center rounded-full border-2 border-white/45 text-white"
            >
              {saved ? <Check className="size-4" /> : <Plus className="size-4" />}
            </button>
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              aria-label={`More information about ${item.title}`}
              className="ml-auto grid size-9 place-items-center rounded-full border-2 border-white/45 text-white"
            >
              <ChevronDown className="size-5" />
            </button>
          </div>
          <div className="truncate px-3 pt-2 text-xs font-semibold text-white/75">
            {accessLabel}
            <span className="px-1.5 text-white/35">•</span>
            {item.type === "series" ? "Series" : "Movie"}
            {item.quality ? (
              <>
                <span className="px-1.5 text-white/35">•</span>
                {item.quality}
              </>
            ) : null}
          </div>
        </div>
      </div>
      {detailsOpen ? <TitlePreviewModal item={item} onClose={() => { setDetailsOpen(false); window.requestAnimationFrame(() => detailsButtonRef.current?.focus()); }} /> : null}
    </article>
  );
}
