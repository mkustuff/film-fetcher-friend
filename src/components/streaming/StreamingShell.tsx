import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

function ConnectionNotice(){const [online,setOnline]=useState(true);const [reconnected,setReconnected]=useState(false);useEffect(()=>{setOnline(navigator.onLine);let timer:number|undefined;const off=()=>{setOnline(false);setReconnected(false)};const on=()=>{setOnline(true);setReconnected(true);timer=window.setTimeout(()=>setReconnected(false),2600)};window.addEventListener("offline",off);window.addEventListener("online",on);return()=>{window.removeEventListener("offline",off);window.removeEventListener("online",on);if(timer)window.clearTimeout(timer)}},[]);if(online&&!reconnected)return null;return <div role="status" aria-live="polite" className={`fixed inset-x-0 top-[64px] z-[49] mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-2 rounded-b-lg border border-t-0 px-4 py-2 text-xs font-bold shadow-xl sm:top-[72px] ${online?"border-emerald-400/20 bg-emerald-950/95 text-emerald-100":"border-amber-400/20 bg-black/95 text-amber-100"}`}><span className={`size-2 rounded-full ${online?"bg-emerald-400":"bg-amber-400 animate-pulse"}`}/>{online?"Back online · reconnecting Avant":"Offline mode · cached pages and artwork stay available"}</div>}

export function StreamingShell({
  children,
  footer = true,
  backTo,
  backLabel = "Back",
}: {
  children: ReactNode;
  footer?: boolean;
  backTo?: string;
  backLabel?: string;
}) {
  const navigate = useNavigate();
  const goBack = () => {
    if (backTo) { void navigate({ to: backTo as any }); return; }
    if (typeof window !== "undefined" && window.history.length > 1) { window.history.back(); return; }
    void navigate({ to: "/" });
  };
  return (
    <div className="min-h-[100svh] bg-background text-foreground">
      <SiteHeader />
      <ConnectionNotice />
      {backTo ? <button type="button" onClick={goBack} aria-label={backLabel} className="fixed left-4 top-[76px] z-40 inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3.5 py-2 text-xs font-semibold text-white/75 backdrop-blur-md transition hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:left-8 sm:top-[84px]"><ArrowLeft className="size-4"/><span>{backLabel}</span></button> : null}
      <div className="relative min-h-[72svh] bg-background">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white/[.018] to-transparent" />
        <div className="relative">{children}</div>
      </div>
      {footer ? <SiteFooter /> : null}
    </div>
  );
}
