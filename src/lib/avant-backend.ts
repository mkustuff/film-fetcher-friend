const SUPABASE_URL="https://bnuyhrsezkepsaebwlmu.supabase.co";
const SUPABASE_ANON_KEY=import.meta.env["VITE_SUPABASE_ANON_KEY"]||import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]||"sb_publishable_B3mlx-n0maE2rSIusRZmKw_ITK6QUeo";
export const ADMIN_EMAIL="";
/** Client-side admin hints are not authorization. The backend admin-session endpoint is the source of truth. */
export function isAdminEmail(_email?:string|null){return true}
export type AdminSession={admin:boolean;role?:string;requireMfa?:boolean;email?:string;reason?:string};
export function getAdminToken(){return typeof window==="undefined"?null:window.sessionStorage.getItem("avant_admin_token")}
export function setAdminToken(token:string|null){if(typeof window==="undefined")return;token?window.sessionStorage.setItem("avant_admin_token",token):window.sessionStorage.removeItem("avant_admin_token")}
const GUEST_KEY="avant_guest_id";function guestId(){if(typeof window==="undefined")return null;let id=localStorage.getItem(GUEST_KEY);if(!id||!/^[0-9a-f-]{36}$/i.test(id)){id=crypto.randomUUID();localStorage.setItem(GUEST_KEY,id)}return id}function adoptGuestCustomer(externalCustomerId?:string|null){if(typeof window==="undefined")return;const raw=String(externalCustomerId||"");if(raw.startsWith("guest:")){const id=raw.slice(6);if(/^[0-9a-f-]{36}$/i.test(id))localStorage.setItem(GUEST_KEY,id)}}
async function request<T>(name:string,token?:string|null,init:RequestInit={}){const adminProof=typeof window!=="undefined"&&name.startsWith("admin-")?sessionStorage.getItem("avant_admin_mfa_proof"):null;const headers={...(SUPABASE_ANON_KEY?{apikey:SUPABASE_ANON_KEY}:{}),...(token?{Authorization:`Bearer ${token}`} :{}),...(!token&&["palpluss-checkout","paypal-checkout","payment-status","payment-recover","payment-reconcile","account-access","my-library","resolve-playback","authorize-watch","watch-progress","access-code-issue"].includes(name)&&guestId()?{"x-avant-guest":guestId()!}:{}),...(adminProof?{"x-admin-mfa":adminProof}:{}),"Content-Type":"application/json",...(init.headers||{})};const method=String(init.method||"GET").toUpperCase();const safeRetry=method==="GET"||method==="HEAD"||name==="payment-status"||name==="account-access"||name==="my-library"||name==="resolve-playback"||name==="authorize-watch";let last:any;for(let attempt=0;attempt<(safeRetry?2:1);attempt++){const controller=new AbortController();const timeoutMs=name==="palpluss-checkout"?30000:(name==="resolve-playback"||name==="authorize-watch"?18000:12000);const timer=typeof window!=="undefined"?window.setTimeout(()=>controller.abort(),timeoutMs):null;try{const r=await fetch(`${SUPABASE_URL}/functions/v1/${name}`,{...init,signal:init.signal||controller.signal,headers});const body=await r.json().catch(()=>({}));if(!r.ok){const e:any=new Error(body.error||body.detail||`${name} failed (${r.status})`);e.status=r.status;e.body=body;throw e}return body as T}catch(e:any){last=e;if(e?.status||!safeRetry||attempt===1)break;if(typeof window!=="undefined")await new Promise(x=>window.setTimeout(x,900))}finally{if(timer)window.clearTimeout(timer)}}if(last?.name==="AbortError")throw new Error("Avant services took too long to respond. Please retry.");throw last||new Error("Unable to reach Avant services. Check your connection and retry.")}
let publicCatalogueCache:any=null,publicCataloguePending:Promise<any>|null=null,publicCatalogueAt=0;const PUBLIC_CATALOGUE_TTL=900000,PUBLIC_CATALOGUE_STALE_TTL=86400000;const PUBLIC_CATALOGUE_STORAGE="avant_public_catalogue_v3";function hydratePublicCatalogue(){if(publicCatalogueCache||typeof window==="undefined")return;try{const raw=localStorage.getItem(PUBLIC_CATALOGUE_STORAGE)||sessionStorage.getItem(PUBLIC_CATALOGUE_STORAGE);if(!raw)return;const saved=JSON.parse(raw);if(saved?.payload&&Date.now()-Number(saved.savedAt||0)<PUBLIC_CATALOGUE_STALE_TTL){publicCatalogueCache=saved.payload;publicCatalogueAt=Number(saved.savedAt)}}catch{}}function refreshPublicCatalogue(){if(publicCataloguePending)return publicCataloguePending;publicCataloguePending=request<any>("catalogue-public").then(x=>{publicCatalogueCache=x;publicCatalogueAt=Date.now();if(typeof window!=="undefined")try{const packed=JSON.stringify({savedAt:publicCatalogueAt,payload:x});localStorage.setItem(PUBLIC_CATALOGUE_STORAGE,packed);sessionStorage.setItem(PUBLIC_CATALOGUE_STORAGE,packed)}catch{}return x}).catch(error=>{if(publicCatalogueCache)return publicCatalogueCache;throw error}).finally(()=>{publicCataloguePending=null});return publicCataloguePending}const missingCatalogueKeys=new Set<string>();export const publicCatalogue=()=>{hydratePublicCatalogue();const now=Date.now();if(publicCatalogueCache){if(now-publicCatalogueAt>=PUBLIC_CATALOGUE_TTL)void refreshPublicCatalogue();return Promise.resolve(publicCatalogueCache)}return refreshPublicCatalogue()};
export const resolveCatalogueKey=async(key:string,bypassMissingCache=false)=>{if(missingCatalogueKeys.has(key)&&!bypassMissingCache)return null;
  // Static catalogue slugs are intentionally allowed to fall back locally without
  // generating noisy 404/500 Edge Function requests on public discovery pages.
  const localKnown=typeof key==="string"&&!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(key);
  try{return await request<any>(`catalogue-public?key=${encodeURIComponent(key)}`)}
  catch(e:any){
    if(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(key)){
      const headers={apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`};
      const er=await fetch(`${SUPABASE_URL}/rest/v1/episodes?id=eq.${encodeURIComponent(key)}&status=eq.published&select=id,legacy_key,season_id,episode_number,title,description,duration_seconds,thumbnail_url,status,access_required,vimeo_video_id,preview_start_seconds,preview_duration_seconds`,{headers});
      const episode=er.ok?(await er.json())?.[0]:null;
      if(episode?.vimeo_video_id){
        const sr=await fetch(`${SUPABASE_URL}/rest/v1/seasons?id=eq.${encodeURIComponent(episode.season_id)}&select=id,series_id,season_number,title,status`,{headers});
        const season=sr.ok?(await sr.json())?.[0]:null;
        if(season?.series_id){
          const tr=await fetch(`${SUPABASE_URL}/rest/v1/catalogue_titles?id=eq.${encodeURIComponent(season.series_id)}&select=*`,{headers});
          const title=tr.ok?(await tr.json())?.[0]:null;
          if(title)return {title,episode,seasons:[season],episodes:[episode],product:null};
        }
      }
    }
    if(e?.status===404||e?.status===500||localKnown){if(e?.status===404&&!localKnown)missingCatalogueKeys.add(key);return null}throw e
  }
};
export const publicCommerceSettings=()=>request<any>("catalogue-public?view=commerce").catch(()=>publicCatalogue().then((x:any)=>({products:x?.products||[]})));
export const publicPaymentChannels=()=>request<any>("catalogue-public?view=payment_channels").catch(()=>publicCommerceSettings().then((x:any)=>({paypal:x?.paypal||x?.paymentChannels?.paypal||null,palpluss:x?.palpluss||x?.paymentChannels?.palpluss||null,paybill:x?.paybill||x?.paymentChannels?.paybill||null})));
let publicPagesCache:any=null,publicPagesAt=0;export const publicPages=()=>{const now=Date.now();if(publicPagesCache&&now-publicPagesAt<60000)return Promise.resolve(publicPagesCache);return request<any>("public-pages?navigation=1").then(x=>{publicPagesCache=x;publicPagesAt=Date.now();return x})};
export const publicPage=(slug:string)=>request<any>(`public-pages?slug=${encodeURIComponent(slug)}`);
export type ConciergeResult={answer:string;slugs:string[];reasons?:Record<string,string>;suggestions:string[];mode:"ai-grounded"|"catalogue-fallback"|"grounded"};
export const avantConcierge=(query:string,context:string[]=[])=>request<ConciergeResult>("avant-concierge",null,{method:"POST",body:JSON.stringify({query,context:context.slice(-4)})});
export const startPalplussPayment=(token:string|null,input:{productId:string;phone:string;email:string;idempotencyKey:string})=>request<any>("palpluss-checkout",token,{method:"POST",body:JSON.stringify(input)});
export const createPayPalOrder=(token:string|null,input:{productId:string;email:string;idempotencyKey:string})=>request<any>("paypal-checkout",token,{method:"POST",body:JSON.stringify({action:"create",...input})});
export const capturePayPalOrder=(token:string|null,input:{orderId:string;reference:string})=>request<any>("paypal-checkout",token,{method:"POST",body:JSON.stringify({action:"capture",...input})});
export const paymentStatus=(token:string|null,reference:string)=>request<any>("payment-status",token,{method:"POST",body:JSON.stringify({reference})});
export const reconcilePayments=(token?:string|null)=>request<any>("payment-reconcile",token,{method:"POST",body:"{}"});
export const recoverPayment=(token:string|null,input:{phone?:string;mpesaCode?:string})=>request<any>("payment-recover",token,{method:"POST",body:JSON.stringify(input)});
export const issueAccessCode=(token:string|null,paymentId:string,resend=false)=>request<any>("paypal-checkout",token,{method:"POST",body:JSON.stringify({action:"issue_code",paymentId,resend})});
export const loginWithAccessCode=async(accessCode:string,deviceId:string,deviceName?:string,expectedProductId?:string)=>{const result=await request<any>("access-code-login",null,{method:"POST",body:JSON.stringify({accessCode,deviceId,deviceName,expectedProductId})});adoptGuestCustomer(result?.externalCustomerId);clearPlaybackCache();broadcastAccessChanged({source:"access-code"});return result};
export const authorizeWatch=(token:string,contentId:string,seasonId?:string)=>request<any>("authorize-watch",token,{method:"POST",body:JSON.stringify({contentId,seasonId})});
const playbackCache=new Map<string,{at:number,value:any}>();const playbackPending=new Map<string,Promise<any>>();export const resolvePlayback=(token:string|null,contentId:string)=>{const key=contentId;const cached=playbackCache.get(key);if(cached&&Date.now()-cached.at<15000)return Promise.resolve(cached.value);const pending=playbackPending.get(key);if(pending)return pending;const run=request<any>("resolve-playback",token,{method:"POST",body:JSON.stringify({contentId})}).catch((error:any)=>{const message=String(error?.message||error?.body?.error||error?.body?.detail||"");if(message.includes("content_unavailable")||message.includes('"reason":"content_unavailable"'))return{authorized:false,reason:"content_unavailable",content:null};return{authorized:false,reason:"payment_required",content:null}}).then(value=>{playbackCache.set(key,{at:Date.now(),value});return value}).finally(()=>playbackPending.delete(key));playbackPending.set(key,run);return run};export function clearPlaybackCache(contentId?:string){if(contentId)playbackCache.delete(contentId);else playbackCache.clear()}
export const getWatchProgress=(token:string)=>request<any>("get-watch-progress",token,{method:"GET"});
export const saveWatchProgress=(token:string,input:{contentId:string;episodeId?:string;progressSeconds:number;durationSeconds:number})=>request<any>("save-watch-progress",token,{method:"POST",body:JSON.stringify(input)});
export const adminSession=(token:string)=>request<AdminSession>("admin-session",token,{method:"POST"});
const adminScopeQuery=()=>typeof window!=="undefined"&&sessionStorage.getItem("avant-admin-workspace")==="production"?"&scope=production":"";export const adminDashboard=(token:string)=>adminView(token,"dashboard" as any);
export const adminApiPost=(token:string,payload:Record<string,unknown>)=>request<any>("admin-api",token,{method:"POST",body:JSON.stringify(payload)});
export type AdminView="content"|"customers"|"payments"|"products"|"entitlements"|"audit"|"pages"|"seo"|"appearance"|"media"|"system_settings"|"gemini_settings"|"cloudinary_settings"|"settings_bundle"|"integration_settings";
const adminViewCache=new Map<string,{at:number,value:any}>();const adminViewPending=new Map<string,Promise<any>>();export const adminView=(token:string,view:AdminView)=>{const scope=adminScopeQuery(),key=`${view}${scope}`,cached=adminViewCache.get(key);if(cached&&Date.now()-cached.at<180000)return Promise.resolve(cached.value);const pending=adminViewPending.get(key);if(pending)return pending;const run=request<any>(`admin-api?view=${view}${scope}`,token,{method:"GET"}).then(value=>{adminViewCache.set(key,{at:Date.now(),value});return value}).finally(()=>adminViewPending.delete(key));adminViewPending.set(key,run);return run};export function clearAdminViewCache(view?:AdminView){if(view){for(const key of adminViewCache.keys())if(key.startsWith(view))adminViewCache.delete(key)}else adminViewCache.clear()}
export const adminContent=(token:string,payload:Record<string,unknown>)=>request<any>("admin-content",token,{method:"POST",body:JSON.stringify(payload)});
export const adminVideoVariants=(token:string,input:{titleId?:string;episodeId?:string})=>adminContent(token,{operation:"list_video_variants",...input});
export const saveAdminVideoVariant=(token:string,input:Record<string,unknown>)=>adminContent(token,{operation:"upsert_video_variant",...input});
export const publishAdminVideoVariant=(token:string,id:string)=>adminContent(token,{operation:"publish_video_variant",id});
export const deleteAdminVideoVariant=(token:string,id:string)=>adminContent(token,{operation:"delete_video_variant",id});
export const adminCustomers=(token:string,payload:Record<string,unknown>)=>request<any>("admin-customers",token,{method:"POST",body:JSON.stringify(payload)});
export async function hasAdminSession(){const token=getAdminToken();if(!token)return false;try{return (await adminSession(token)).admin===true}catch{return false}}

export const getCloudMyList=(token:string)=>request<{ids:string[]}>("my-list",token,{method:"GET"});
export const setCloudMyList=(token:string,key:string,saved:boolean)=>request<any>("my-list",token,{method:"POST",body:JSON.stringify({key,saved})});

export const myLibrary=(token:string|null)=>request<any>("my-library",token,{method:"GET"});
export type AccountAccess={authenticated:boolean;subscriber:boolean;email?:string;customerId?:string;subscription?:{active:boolean;plan:string;productType:string;expiresAt:string|null}|null;reason?:string};
let accountAccessCache:{token:string;at:number;value:AccountAccess}|null=null,accountAccessPending:Promise<AccountAccess>|null=null;
export const accountAccess=(token:string)=>{const now=Date.now();if(accountAccessCache?.token===token&&now-accountAccessCache.at<60000)return Promise.resolve(accountAccessCache.value);if(accountAccessPending)return accountAccessPending;accountAccessPending=request<AccountAccess>("account-access",token,{method:"GET"}).then(x=>{accountAccessCache={token,at:Date.now(),value:x};rememberSubscriber(Boolean(x.subscriber));return x}).finally(()=>{accountAccessPending=null});return accountAccessPending};
export function cachedSubscriber(){if(typeof window==="undefined")return false;return sessionStorage.getItem("avant_subscriber")==="1"}
export function rememberSubscriber(active:boolean){if(typeof window!=="undefined")sessionStorage.setItem("avant_subscriber",active?"1":"0");if(!active)accountAccessCache=null}
export type AccessState="loading"|"signed_out"|"authorized"|"locked"|"unavailable"|"error";
export async function accessForContent(contentId:string,seasonId?:string){const {customerToken}=await import("./google-auth");const token=await customerToken(false);if(!token)return{state:"signed_out" as AccessState,authorized:false,reason:"login_required"};try{const r=await authorizeWatch(token,contentId,seasonId);return{...r,state:r.authorized?"authorized" as AccessState:"locked" as AccessState}}catch(e:any){const reason=e?.body?.reason;if(reason==="payment_required")return{state:"locked" as AccessState,authorized:false,reason};if(reason==="content_unavailable")return{state:"unavailable" as AccessState,authorized:false,reason};if(reason==="login_required")return{state:"signed_out" as AccessState,authorized:false,reason};return{state:"error" as AccessState,authorized:false,reason:reason||"authorization_failed"}}}
export const ACCESS_CHANGED_EVENT="avant:access-changed";
export function broadcastAccessChanged(detail:Record<string,unknown>={}){clearPlaybackCache();accountAccessCache=null;if(typeof window!=="undefined")sessionStorage.removeItem("avant_subscriber");if(typeof window==="undefined")return;window.dispatchEvent(new CustomEvent(ACCESS_CHANGED_EVENT,{detail}));try{localStorage.setItem("avant_access_changed",JSON.stringify({at:Date.now(),...detail}))}catch{}}
export function subscribeAccessChanged(handler:()=>void){if(typeof window==="undefined")return()=>{};const local=()=>handler();const storage=(e:StorageEvent)=>{if(e.key==="avant_access_changed")handler()};window.addEventListener(ACCESS_CHANGED_EVENT,local);window.addEventListener("storage",storage);return()=>{window.removeEventListener(ACCESS_CHANGED_EVENT,local);window.removeEventListener("storage",storage)}}

export const adminVimeoGet=(token:string)=>request<any>("admin-vimeo",token,{method:"GET"});
export const adminVimeoSave=(token:string,payload:{clientId?:string;clientSecret?:string;accessToken?:string;testOnly?:boolean})=>request<any>("admin-vimeo",token,{method:"POST",body:JSON.stringify(payload)});
export const adminVimeoDisconnect=(token:string,mode:"disconnect"|"replace"="disconnect")=>request<any>("admin-vimeo",token,{method:"DELETE",body:JSON.stringify({mode})});

export const adminVimeoVideos=(token:string,query="")=>request<any>(`admin-vimeo?view=videos&query=${encodeURIComponent(query)}`,token,{method:"GET"});

export const adminUsersGet=(token:string)=>request<any>("admin-users",token,{method:"GET"});
export const adminUserSave=(token:string,payload:{email:string;role:string;active:boolean;requireMfa:boolean})=>request<any>("admin-users",token,{method:"POST",body:JSON.stringify(payload)});

export const adminAssistant=(token:string,payload:Record<string,unknown>)=>request<any>("admin-assistant",token,{method:"POST",body:JSON.stringify(payload)});

// --- Device-side record of verified purchases -------------------------------
// The backend remains the source of truth. This local record only keeps a
// verified payment usable on the buyer's device while the server-side
// entitlement propagates (guest checkout, slow reconciliation, refreshes).
const PURCHASE_KEY="avant_verified_purchases_v1";
export type VerifiedPurchase={productId:string;reference:string;at:number};
export function readVerifiedPurchases():VerifiedPurchase[]{if(typeof window==="undefined")return[];try{const raw=localStorage.getItem(PURCHASE_KEY);const list=raw?JSON.parse(raw):[];return Array.isArray(list)?list.filter((x:any)=>x&&typeof x.productId==="string"):[]}catch{return[]}}
export function recordVerifiedPurchase(entry:{productId?:string|null;reference?:string|null;accessCode?:string|null}){if(typeof window==="undefined")return;const productId=String(entry.productId||"").trim();if(!productId)return;const list=readVerifiedPurchases().filter(x=>x.productId!==productId);list.push({productId,reference:String(entry.reference||""),at:Date.now()});try{localStorage.setItem(PURCHASE_KEY,JSON.stringify(list.slice(-50)))}catch{}}
export function hasVerifiedPurchase(productId?:string|null){const id=String(productId||"").trim();if(!id)return false;return readVerifiedPurchases().some(x=>x.productId===id)}
