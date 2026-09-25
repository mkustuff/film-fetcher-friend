import type { CatalogueTitle } from "@/lib/site-data";
import { TitleCard } from "./TitleCard";

export function DiscoveryGrid({ items, badgeLabel }: { items: CatalogueTitle[]; badgeLabel?: string }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-5 min-[520px]:grid-cols-2 sm:gap-x-6 sm:gap-y-8 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.id} className="min-w-0">
          <TitleCard item={item} layout="grid" {...(badgeLabel ? { badgeLabel } : {})} />
          <div className="mt-2 hidden min-w-0 px-0.5 sm:block sm:mt-3">
            <h3 className="truncate text-lg font-extrabold leading-tight tracking-[-0.02em] sm:text-xl">{item.title}</h3>
            <p className="mt-2 flex flex-wrap items-center gap-x-2.5 text-sm font-medium text-muted-foreground">
              <span>{item.type === "series" ? `${item.episodes?.length || 1} episode${item.episodes?.length === 1 ? "" : "s"}` : "Film"}</span>
              {item.year ? <span>{item.year}</span> : null}
              {item.genres[0] ? <span>{item.genres[0]}</span> : null}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}