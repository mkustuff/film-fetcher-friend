import { createFileRoute } from "@tanstack/react-router";
import { StreamingShell } from "@/components/streaming/StreamingShell";
import { publicPageLinks, publicPageMeta } from "@/lib/seo";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, follow" }, ...publicPageMeta("/terms", "Terms of Use — Avant Movies", "Terms information for the Avant Movies streaming service.")].filter((entry) => entry.name !== "robots"), links: publicPageLinks("/terms") }),
  component: Page,
});

function Page() {
  return <StreamingShell backTo="/" backLabel="Home"><main className="mx-auto min-h-[70vh] max-w-4xl px-5 pb-24 pt-28 sm:px-10 sm:pt-32"><p className="eyebrow">Legal</p><h1 className="mt-4 text-4xl font-black sm:text-6xl">Terms of Use</h1><div className="mt-8 rounded-lg border border-white/10 bg-surface p-6 sm:p-8"><p className="leading-7 text-muted-foreground">Streaming access, purchase validity, refunds and account rules will be published here once the final commercial model and payment provider terms are approved.</p></div></main></StreamingShell>;
}