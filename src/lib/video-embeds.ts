export type EmbedOptions = { autoplay?: boolean; muted?: boolean; controls?: boolean; loop?: boolean; start?: number; end?: number; jsApi?: boolean; quality?: "auto"|"360p"|"540p"|"720p"|"1080p" };
import { claimMedia, releaseMedia } from "./media-session";

export function heroTrailerUrl(embedUrl:string,muted=true,controls=false){
 try{const url=new URL(embedUrl);if(!url.hostname.includes("vimeo"))return "";url.searchParams.set("autoplay","1");url.searchParams.set("muted",muted?"1":"0");url.searchParams.set("background",controls?"0":"1");url.searchParams.set("autopause","0");url.searchParams.set("playsinline","1");url.searchParams.set("api","1");return url.toString()}catch{return ""}
}

export function pauseEmbeddedPlayer(frame:HTMLIFrameElement|null){releaseMedia(frame)}
export function playEmbeddedPlayer(frame:HTMLIFrameElement|null){if(!frame)return;claimMedia(frame);frame.contentWindow?.postMessage(JSON.stringify({event:"command",func:"playVideo",args:[]}),"*");frame.contentWindow?.postMessage({method:"play"},"*")}


export function vimeoEmbedUrl(id:string,options:EmbedOptions={}){const p=new URLSearchParams({playsinline:"1",autoplay:options.autoplay?"1":"0",muted:options.muted?"1":"0",controls:options.controls===false?"0":"1",autopause:"0",dnt:"1",quality:options.quality||"auto",max_quality:options.quality==="1080p"?"1080p":"720p",preload:"auto",responsive:"1",api:"1"});if(options.loop)p.set("loop","1");if(options.start&&options.start>0)p.set("t",String(Math.floor(options.start))+"s");return `https://player.vimeo.com/video/${encodeURIComponent(id)}?${p.toString()}`}
