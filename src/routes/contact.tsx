import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle } from "lucide-react";
import { StreamingShell } from "@/components/streaming/StreamingShell";
import { WHATSAPP } from "@/lib/site-data";
import { publicPageLinks, publicPageMeta } from "@/lib/seo";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: publicPageMeta("/contact", "Contact Avant Cinema", "Contact Avant Cinema about productions, streaming access and support.", "https://static.wixstatic.com/media/57086b_f94334c3e6d24692a3c297230928ed11~mv2.jpg/v1/fill/w_1920,h_1080,q_90,enc_auto/file.jpeg"), links: publicPageLinks("/contact") }),
  component: Page,
});

function Page() {
  return <StreamingShell backTo="/" backLabel="Home"><main className="mx-auto min-h-[70vh] max-w-5xl px-5 pb-24 pt-32 sm:px-10"><p className="eyebrow">Avant Movies</p><h1 className="mt-4 text-5xl font-black sm:text-7xl">Contact</h1><p className="mt-5 max-w-xl text-muted-foreground">Questions about Avant, streaming access or our productions? Reach the team through the official channels below.</p><div className="mt-10 grid gap-4 sm:grid-cols-2"><a href="mailto:business@avantcinema.com" className="rounded-lg border border-white/10 bg-surface p-6 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Mail/><p className="mt-5 font-bold">Email</p><p className="mt-1 text-sm text-muted-foreground">business@avantcinema.com</p></a><a href={`https://wa.me/${WHATSAPP.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 bg-surface p-6 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><MessageCircle/><p className="mt-5 font-bold">WhatsApp</p><p className="mt-1 text-sm text-muted-foreground">{WHATSAPP}</p></a></div></main></StreamingShell>;
}