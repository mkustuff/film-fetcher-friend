import { ChevronDown, Film, Play, Search, SlidersHorizontal, Tv, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogueTitle } from "@/lib/site-data";
import { isFreeTitle, useCatalogue } from "@/lib/catalogue";
import { catalogueGenres } from "@/lib/discovery";
import { rememberReturnContext } from "@/lib/navigation-memory";
import { StreamingShell } from "./StreamingShell";
import { DiscoveryGrid } from "./DiscoveryGrid";

type CatalogueMode = "movies" | "series" | "free";
type SortMode = "curated" | "az" | "newest";

export function CataloguePage({
  mode,
  title,
  intro,
}: {
  mode: CatalogueMode;
  title: string;
  intro: string;
}) {
  const [query, setQuery] = useState(""),
    [genre, setGenre] = useState("All"),
    [sort, setSort] = useState<SortMode>("curated");
  const { items, loading, usingFallback, offline } = useCatalogue();
  const pool = useMemo(
    () => items.filter((item) => mode === "free" ? isFreeTitle(item) : item.type === (mode === "movies" ? "movie" : "series")),
    [items, mode],
  );
  const genres = useMemo(() => ["All", ...new Set(pool.flatMap((i) => i.genres))], [pool]);
  const visible = useMemo(() => {
    const filtered = pool.filter(
        (i) =>
          (genre === "All" || i.genres.includes(genre)) &&
          `${i.title} ${i.synopsis} ${i.genres.join(" ")}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      );
    if (sort === "az") return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "newest") return [...filtered].sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
    return filtered;
  }, [genre, pool, query, sort]);
  const hero = pool.find((item) => item.featured) || pool[0];
  const quickGenres = catalogueGenres(pool).slice(0, 4);
  const label = mode === "series" ? "series" : mode === "free" ? "free titles" : "films";
  const icon = mode === "series" ? <Tv className="size-4" /> : <Film className="size-4" />;
  return (
    <StreamingShell backTo="/" backLabel="Home">
      <main id="main-content" className="min-h-[80vh] overflow-x-clip pb-16 pt-20 sm:pb-24 sm:pt-24">
        <header className="mx-auto max-w-[1600px] px-5 pt-8 sm:px-10 lg:px-14 lg:pt-12">
          <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,.65fr)]">
            <div>
              <p className="eyebrow">Avant catalogue · {mode === "free" ? "Open access" : "Discover"}</p>
              <h1 className="mt-3 text-[clamp(2.8rem,10vw,7rem)] font-black leading-[.86]">{title}</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-foreground/70 sm:text-lg">{intro}</p>
            </div>
            {hero ? <Link to="/title/$slug" params={{ slug: hero.slug }} onClick={() => rememberReturnContext(mode, hero.slug)} className="group relative hidden aspect-[16/8] overflow-hidden rounded-md border border-border/60 bg-surface shadow-reel lg:block">
              <img src={hero.backdrop || hero.artwork} alt={`${hero.title} ${hero.type === "movie" ? "film" : "series"} artwork`} loading="eager" fetchPriority="high" decoding="async" className="size-full object-cover transition duration-700 group-hover:scale-[1.03]" />
              <span className="hero-shade absolute inset-0" />
              <span className="absolute inset-x-0 bottom-0 p-6">
                <span className="eyebrow">Editor’s opening frame</span>
                <span className="mt-2 block text-2xl font-black">{hero.title}</span>
                <span className="mt-3 inline-flex items-center gap-2 text-sm font-bold"><Play className="size-4 fill-current" />Open story</span>
              </span>
            </Link> : null}
          </div>
        </header>

        <section className="relative z-20 mt-5 border-y border-border/60 bg-background sm:mt-9">
          <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-2 px-5 py-2.5 sm:flex sm:flex-wrap sm:items-center sm:px-10 sm:py-3 lg:px-14">
            <label className="relative col-span-2 min-w-0 sm:flex-[1_1_15rem] lg:max-w-sm">
              <span className="sr-only">Search {label}</span>
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${label}`} className="h-10 sm:h-11 bg-surface pl-10 pr-10" />
              {query ? <Button size="icon" variant="ghost" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-0.5 top-0.5"><X className="size-4" /></Button> : null}
            </label>
            <div className="relative flex-1 sm:flex-none">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <select aria-label="Filter by genre" value={genre} onChange={(event) => setGenre(event.target.value)} className="h-10 sm:h-11 w-full appearance-none rounded-md border border-border bg-surface pl-9 pr-9 text-sm font-semibold outline-none sm:w-auto">
                {genres.map((value) => <option key={value} value={value}>{value === "All" ? "All genres" : value}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" />
            </div>
            <div className="relative flex-1 sm:flex-none">
              <select aria-label="Sort catalogue" value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="h-10 sm:h-11 w-full appearance-none rounded-md border border-border bg-surface px-3 pr-9 text-sm font-semibold outline-none sm:w-auto">
                <option value="curated">Curated</option><option value="az">A–Z</option><option value="newest">Newest</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1600px] px-5 py-5 sm:px-10 sm:py-12 lg:px-14">
          {!query && genre === "All" && quickGenres.length ? <div className="mb-4 hidden flex-wrap items-center gap-2 sm:flex sm:mb-8"><span className="mr-1 text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Browse by mood</span>{quickGenres.map((value) => <Button key={value} type="button" size="sm" variant="outline" onClick={() => setGenre(value)}>{value}</Button>)}</div> : null}
          <div className="mb-4 flex items-end justify-between gap-4 border-b border-border/60 pb-3 sm:mb-6 sm:pb-4">
            <div><p className="flex items-center gap-2 text-sm font-bold">{icon}{visible.length} {visible.length === 1 ? label.replace(/s$/, "") : label}</p>{offline ? <p className="mt-1 text-xs text-amber-200/75">Offline · showing the most recent Avant catalogue saved on this device.</p> : usingFallback ? <p className="mt-1 text-xs text-muted-foreground">Showing the available Avant selection while live updates reconnect.</p> : null}</div>
            {(query || genre !== "All") ? <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setGenre("All"); }}>Clear filters</Button> : null}
          </div>
          <div key={`${query}-${genre}-${sort}`} className="avant-filter-results">{loading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div key={index} className="aspect-video animate-pulse rounded-md bg-surface" />)}</div> : visible.length ? <DiscoveryGrid items={visible} {...(mode === "free" ? { badgeLabel: "Free to watch" } : {})} /> : <div className="border-y border-border py-20 text-center"><h2 className="text-2xl font-bold">No matching stories</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Try another title or genre, or clear the filters to return to the full catalogue.</p><Button className="mt-5" onClick={() => { setQuery(""); setGenre("All"); }}>Show all {label}</Button></div>}</div>
        </section>
      </main>
    </StreamingShell>
  );
}
