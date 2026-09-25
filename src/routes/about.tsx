import { createFileRoute } from "@tanstack/react-router";
import { StreamingShell } from "@/components/streaming/StreamingShell";
import { publicPageLinks, publicPageMeta } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: publicPageMeta("/about", "About Avant Cinema — Kenyan Film & Storytelling", "Learn about Avant Cinema, an independent Kenyan storytelling company creating films and series rooted in culture and the human experience.", "https://static.wixstatic.com/media/57086b_f94334c3e6d24692a3c297230928ed11~mv2.jpg/v1/fill/w_1920,h_1080,q_90,enc_auto/file.jpeg"), links: publicPageLinks("/about") }),
  component: Page,
});

function Page() {
  return <StreamingShell backTo="/" backLabel="Home"><main className="mx-auto max-w-5xl px-5 pb-24 pt-32 sm:px-10"><p className="eyebrow">Our story</p><h1 className="mt-4 text-5xl font-black sm:text-7xl">Stories with something to say.</h1><p className="mt-8 max-w-3xl text-lg leading-8 text-muted-foreground">Avant is an independent Kenyan storytelling company committed to authentic stories driven by purpose, culture and the human experience.</p><div className="mt-16 grid gap-6 border-t border-white/10 pt-10 sm:grid-cols-3"><div><p className="text-3xl font-black">Kenyan</p><p className="mt-2 text-sm text-muted-foreground">Stories rooted here.</p></div><div><p className="text-3xl font-black">Independent</p><p className="mt-2 text-sm text-muted-foreground">A distinct creative voice.</p></div><div><p className="text-3xl font-black">Human</p><p className="mt-2 text-sm text-muted-foreground">Made to be felt.</p></div></div></main></StreamingShell>;
}