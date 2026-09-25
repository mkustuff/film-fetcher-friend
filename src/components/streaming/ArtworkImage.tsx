import { useEffect, useMemo, useRef, useState } from "react";

const PLACEHOLDER = "/avant-movies-logo.png";
const vimeoThumbnailCache = new Map<string, string>();

async function fetchVimeoThumbnail(vimeoVideoId: string) {
  const cached = vimeoThumbnailCache.get(vimeoVideoId);
  if (cached) return cached;
  try {
    const response = await fetch(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${vimeoVideoId}`)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) return null;
    const payload = await response.json();
    const thumbnail = typeof payload?.thumbnail_url === "string" ? payload.thumbnail_url : "";
    if (!thumbnail.includes("i.vimeocdn.com/")) return null;
    vimeoThumbnailCache.set(vimeoVideoId, thumbnail);
    return thumbnail;
  } catch {
    return null;
  }
}

function uniqueSources(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

export function ArtworkImage({
  src,
  vimeoVideoId,
  fallbacks = [],
  alt = "",
  className = "",
  loading = "lazy",
  fetchPriority,
  decoding = "async",
}: {
  src?: string;
  vimeoVideoId?: string;
  fallbacks?: string[];
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  decoding?: "async" | "sync" | "auto";
}) {
  const [vimeoThumbnail, setVimeoThumbnail] = useState("");
  const [sourceIndex, setSourceIndex] = useState(0);
  const failedSources = useRef(new Set<string>());

  useEffect(() => {
    let active = true;
    setSourceIndex(0);
    failedSources.current.clear();
    if (!vimeoVideoId || String(src || "").includes("i.vimeocdn.com/")) {
      setVimeoThumbnail("");
      return () => { active = false; };
    }
    fetchVimeoThumbnail(vimeoVideoId).then((thumbnail) => {
      if (active && thumbnail) setVimeoThumbnail(thumbnail);
    });
    return () => { active = false; };
  }, [vimeoVideoId, src]);

  const sources = useMemo(
    () => uniqueSources([vimeoThumbnail, src, ...fallbacks, PLACEHOLDER]),
    [vimeoThumbnail, src, fallbacks],
  );
  const activeSource = sources[sourceIndex] || PLACEHOLDER;

  const handleError = () => {
    failedSources.current.add(activeSource);
    setSourceIndex((current) => Math.min(current + 1, Math.max(0, sources.length - 1)));
  };

  return (
    <img
      src={activeSource}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding={decoding}
      onError={handleError}
      className={className}
    />
  );
}
