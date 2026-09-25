import { createFileRoute, notFound } from "@tanstack/react-router";
import { TitleDetail } from "@/components/streaming/TitleDetail";
import { getTitle, type CatalogueTitle } from "@/lib/site-data";
import { resolveCatalogueKey } from "@/lib/avant-backend";
import { absoluteUrl, publicPageLinks, publicPageMeta, titleSchema } from "@/lib/seo";
import { useEffect } from "react";
import { mapResolvedEpisodes } from "@/lib/episodes";

export const Route = createFileRoute("/title/$slug")({
  loader: async ({ params }) => { const fallback: CatalogueTitle | undefined=getTitle(params.slug);const loadRemote=async(bypass=false)=>{try{return await resolveCatalogueKey(params.slug,bypass)}catch{return null}};let l=await loadRemote();if(!l?.title){await new Promise(r=>setTimeout(r,650));l=await loadRemote(true)}try{if(l?.title){const t=l.title,ss=l.seasons||[],eps=l.episodes||[];const releaseAt=t.scheduled_publish_at;const item:any={id:t.legacy_key||t.slug,slug:t.slug,title:t.title,type:t.content_type,year:t.year?String(t.year):undefined,genres:t.genres||[],synopsis:t.synopsis||"",shortDescription:t.short_description||t.synopsis||"",artwork:t.poster_url||"",backdrop:t.backdrop_url||t.poster_url||"",legacyPath:"/"+t.slug,featured:!!t.featured,available:t.status==="published"&&(!releaseAt||new Date(releaseAt).getTime()<=Date.now()),accessRequired:typeof t.access_required==="boolean"?t.access_required:true,heroAutoplay:t.hero_autoplay!==false,previewVimeoId:t.trailer_vimeo_id||undefined,trailerEmbedUrl:t.trailer_vimeo_id?`https://player.vimeo.com/video/${t.trailer_vimeo_id}`:undefined,previewStart:t.preview_start_seconds??undefined,previewDuration:t.preview_duration_seconds??undefined,vimeoVideoId:t.vimeo_video_id||undefined,episodes:eps.length?mapResolvedEpisodes(eps,ss):undefined,cast:t.cast_names||[],creators:t.creator_names||[],directors:t.director_names||[],maturityRating:t.maturity_rating||undefined,maturityReasons:t.maturity_reasons||[],quality:t.quality_label||undefined,languages:t.languages||[],countries:t.countries||[],releaseAt,storyWorld:t.story_world||undefined,seoTitle:t.seo_title||undefined,metaDescription:t.meta_description||undefined};return item as CatalogueTitle}}catch{}if(fallback)return fallback;throw notFound();},
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const path = `/title/${loaderData.slug}`;
    const title = (loaderData as any).seoTitle || `${loaderData.title} | Watch Kenyan ${loaderData.type === "movie" ? "Movie" : "Series"} Online | Avant Cinema`;
    const fallbackDescription = `Watch ${loaderData.title} online on Avant Cinema, a Kenyan ${loaderData.type === "movie" ? "movie" : "series"}${loaderData.genres?.length ? ` in ${loaderData.genres.slice(0, 2).join(" and ")}` : ""}. Explore the story, cast, trailer, episodes and streaming details.`;
    const rawDescription = (loaderData as any).metaDescription || loaderData.shortDescription || loaderData.synopsis || fallbackDescription;
    const cleanDescription = String(rawDescription).replace(/\s+/g, " ").trim();
    const description = cleanDescription.length >= 70 ? cleanDescription.slice(0, 157).replace(/\s+\S*$/, "") + (cleanDescription.length > 157 ? "…" : "") : `${cleanDescription.replace(/[. ]+$/, "")}. ${fallbackDescription}`.slice(0, 160);
    return {
      meta: publicPageMeta(path, title, description, loaderData.backdrop, loaderData.type === "movie" ? "video.movie" : "video.tv_show"),
      links: publicPageLinks(path),
      scripts: [{ type: "application/ld+json", children: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          titleSchema(loaderData),
          {
            "@type": "WebPage",
            "@id": `${absoluteUrl(path)}#webpage`,
            url: absoluteUrl(path),
            name: title,
            description,
            primaryImageOfPage: loaderData.backdrop || loaderData.artwork ? { "@type": "ImageObject", url: loaderData.backdrop || loaderData.artwork } : undefined,
            mainEntity: { "@id": `${absoluteUrl(path)}#title` },
            isPartOf: { "@type": "WebSite", name: "Avant Cinema", url: absoluteUrl("/") },
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Avant Cinema", item: absoluteUrl("/") },
              { "@type": "ListItem", position: 2, name: loaderData.type === "movie" ? "Movies" : "TV Shows", item: absoluteUrl(loaderData.type === "movie" ? "/movies" : "/tv-shows") },
              { "@type": "ListItem", position: 3, name: loaderData.title, item: absoluteUrl(path) },
            ],
          },
        ],
      }) }],
    };
  },
  component: TitleRoute,
});

function TitleRoute() {
  const item=Route.useLoaderData();
  useEffect(()=>{
    // Every newly opened title starts at its hero, regardless of the previous page scroll position.
    window.scrollTo({top:0,left:0,behavior:"auto"});
  },[item.slug]);
  return <TitleDetail item={item} />;
}
