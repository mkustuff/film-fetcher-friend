import { createFileRoute, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Check, CircleAlert, Clock3, CreditCard, LockKeyhole, Mail, Phone, RefreshCw, ShieldCheck, Smartphone, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { broadcastAccessChanged, capturePayPalOrder, clearPlaybackCache, createPayPalOrder, loginWithAccessCode, paymentStatus, publicCatalogue, publicPaymentChannels, reconcilePayments, recoverPayment, resolveCatalogueKey, startPalplussPayment } from '@/lib/avant-backend'
import { BACKEND_PRODUCT_IDS, knownProduct, productForLegacyContent } from '@/lib/backend-catalogue-map'
import { optimizedArtwork } from '@/lib/episodes'
import { customerToken } from '@/lib/google-auth'
import { normalizePaymentState, paymentStateMessage, type PaymentUiState } from '@/lib/payments/status'

export const Route = createFileRoute('/checkout/$productId')({
  head: () => ({ meta: [
    { title: 'Secure Checkout — Avant Movies' },
    { name: 'description', content: 'Complete your Avant Movies access securely with PayPal or M-PESA.' },
    { property: 'og:title', content: 'Secure Checkout — Avant Movies' },
    { property: 'og:description', content: 'Complete your Avant Movies access securely with PayPal or M-PESA.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
    { name: 'robots', content: 'noindex, nofollow' },
  ] }),
  component: CheckoutRoute,
})

type Method = 'mpesa' | 'paypal'

function MPesaMark() {
  return (
    <svg viewBox="0 0 120 40" className="h-full w-full" role="img" aria-label="M-PESA">
      <rect width="120" height="40" rx="6" fill="#4CAF50" />
      <text x="60" y="21" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="17" fontWeight="800" fill="#ffffff" letterSpacing="0.5">M-PESA</text>
      <text x="60" y="33" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="8" fontWeight="600" fill="#e8f5e9" letterSpacing="2">SAFARICOM</text>
    </svg>
  )
}
function PayPalMark() {
  return (
    <svg viewBox="0 0 120 40" className="h-full w-full" role="img" aria-label="PayPal">
      <rect width="120" height="40" rx="6" fill="#ffffff" />
      <path d="M30.5 9h10.2c4.6 0 7.6 2.8 7.6 7 0 5.4-4 8.4-8.9 8.4h-3.2l-1.2 6.6h-5.6L30.5 9zm6 10.4h2.2c2.2 0 3.6-1.3 3.6-3.4 0-1.9-1.3-3-3.2-3h-2.9l-.8 6.4z" fill="#003087" />
      <path d="M47.5 12h10.2c4.6 0 7.6 2.8 7.6 7 0 5.4-4 8.4-8.9 8.4h-3.2l-1.2 6.6h-5.6L47.5 12zm6 10.4h2.2c2.2 0 3.6-1.3 3.6-3.4 0-1.9-1.3-3-3.2-3h-2.9l-.8 6.4z" fill="#0079C1" opacity="0.85" />
      <text x="92" y="26" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="15" fontWeight="800" fontStyle="italic"><tspan fill="#003087">Pay</tspan><tspan fill="#0079C1">Pal</tspan></text>
    </svg>
  )
}
function MPesaLogoBadge() {
  return <div className="flex items-center gap-3"><div className="flex h-10 w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-md"><MPesaMark /></div><div className="text-left"><p className="text-sm font-bold leading-tight text-white">Safaricom M-PESA</p><p className="text-[11px] text-white/60">Instant STK Push to Phone</p></div></div>
}
function PayPalLogoBadge() {
  return <div className="flex items-center gap-3"><div className="flex h-10 w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-md"><PayPalMark /></div><div className="text-left"><p className="text-sm font-bold leading-tight text-white">PayPal & Cards</p><p className="text-[11px] text-white/60">Credit / Debit Card / USD</p></div></div>
}

function CheckoutRoute() {
  const { productId } = Route.useParams()
  const router = useRouter()
  const [checkoutQuery] = useState(() => typeof window === 'undefined' ? { embedded: false, returnTo: '', origin: '/movies', originScroll: 0 } : (() => {
    const query = new URLSearchParams(window.location.search)
    const base = String(import.meta.env.BASE_URL || '/').replace(/\/$/, '')
    const normalizePath = (value: string) => {
      let path = String(value || '')
      while (base && base !== '/' && path.startsWith(base + base)) path = path.slice(base.length)
      if (base && base !== '/' && path.startsWith(base)) path = path.slice(base.length) || '/'
      return path && path.startsWith('/') ? path : path ? '/' + path : ''
    }
    const returnTo = normalizePath(query.get('returnTo') || '')
    const rawOrigin = query.get('origin') || returnTo || '/movies'
    return { embedded: query.get('embedded') === '1', returnTo, origin: normalizePath(rawOrigin) || '/movies', originScroll: Number(query.get('originScroll') || 0) }
  })())
  const { embedded, returnTo, origin, originScroll } = checkoutQuery
  const [accessCode, setAccessCode] = useState('')
  const [verifyingAccessCode, setVerifyingAccessCode] = useState(false)
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [mpesaCode, setMpesaCode] = useState('')
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [product, setProduct] = useState<any>(null)
  const [purchaseTitle, setPurchaseTitle] = useState<any>(null)
  const [backendProductId, setBackendProductId] = useState('')
  const [paymentChannels, setPaymentChannels] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stage, setStage] = useState<PaymentUiState>('ready')
  const [reference, setReference] = useState('')
  const [online, setOnline] = useState(true)
  const [leaving, setLeaving] = useState(false)
  const [method, setMethod] = useState<Method>('mpesa')
  const [methodChosen, setMethodChosen] = useState(false)
  const [switchingMethod, setSwitchingMethod] = useState(false)
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const paypalOn = paymentChannels?.paypal?.enabled === true
  const palplusOn = paymentChannels?.palpluss?.enabled !== false
  const activeMethod: Method = paypalOn ? method : 'mpesa'

  useEffect(() => { try { setReference(sessionStorage.getItem(`avant_payment_${productId}`) || '') } catch { /* unavailable */ } }, [productId])
  useEffect(() => { const sync=()=>setOnline(navigator.onLine); sync(); window.addEventListener('online',sync); window.addEventListener('offline',sync); return()=>{window.removeEventListener('online',sync);window.removeEventListener('offline',sync)} }, [])
  useEffect(() => { let active=true; publicPaymentChannels().then((x:any)=>{if(active)setPaymentChannels(x)}).catch(()=>{}); return()=>{active=false} }, [])
  useEffect(() => {
    let active = true
    const routeKey = String(productId || '').replace(/^title\//, '').replace(/^\/+|\/+$/g, '')
    const mapped = productForLegacyContent(routeKey) || routeKey
    const known = knownProduct(routeKey)
    // Paint known checkout metadata synchronously; live catalogue refreshes it.
    setBackendProductId(known?.id || mapped)
    setProduct((current:any) => current || (known ? { id: known.id, name: known.name, currency: known.currency, price_minor: known.priceMinor } : null))
    if (known) setPurchaseTitle((current:any) => current || { slug: known.slug, title: known.titleName, poster_url: known.artwork, backdrop_url: known.artwork })
    setLoading(false)
    Promise.allSettled([resolveCatalogueKey(routeKey), publicCatalogue()]).then(([resolvedResult, catalogueResult]) => {
      if (!active) return
      const resolvedPayload = resolvedResult.status === 'fulfilled' ? resolvedResult.value : null
      const resolved = resolvedPayload?.product || null
      const payload = catalogueResult.status === 'fulfilled' ? catalogueResult.value : null
      const list = payload?.products || []
      const selected = resolved || list.find((entry: any) => entry.id === mapped) || list.find((entry: any) => entry.id === routeKey) || null
      const canonicalProductId = selected?.id || resolved?.id || mapped
      setBackendProductId(canonicalProductId)
      if (selected) setProduct(selected)
      const titles = payload?.titles || []
      const directTitle = resolvedPayload?.title || null
      const season = resolvedPayload?.season || resolvedPayload?.seasons?.find?.((entry: any) => selected?.season_ids?.includes?.(entry.id)) || resolvedPayload?.seasons?.[0]
      const seasonTitle = season?.series_id ? titles.find((entry: any) => entry.id === season.series_id) : null
      const contentTitle = selected?.content_ids?.length ? titles.find((entry: any) => selected.content_ids.includes(entry.id)) : null
      const namedTitle = titles.find((entry: any) => selected?.name && String(selected.name).toLowerCase().includes(String(entry.title || '').toLowerCase()))
      setPurchaseTitle((current:any) => directTitle || seasonTitle || contentTitle || namedTitle || current)
    })
    return () => { active = false }
  }, [productId])

  const payableMinor = product ? product.promotional_price_minor ?? product.price_minor : 0
  const amount = product ? `${product.currency || 'KES'} ${(payableMinor / 100).toLocaleString()}` : '—'
  const regularAmount = product?.promotional_price_minor != null ? `${product.currency || 'KES'} ${(product.price_minor / 100).toLocaleString()}` : ''
  function clearSavedPayment() { try { sessionStorage.removeItem(`avant_payment_${productId}`); sessionStorage.removeItem(`avant_payment_key_${productId}`) } catch { /* unavailable */ } }
  async function finish(referenceValue: string) {
    clearSavedPayment(); setStage('success'); setBusy(false)
    clearPlaybackCache()
    broadcastAccessChanged({ reference: referenceValue, source: 'checkout' })
    if (embedded) window.parent.postMessage({ type: 'avant-payment-success', reference: referenceValue, returnTo }, window.location.origin)
    else await router.navigate({ to: '/payment/success', search: { reference: referenceValue, returnTo: returnTo || origin, origin, originScroll: String(originScroll) } })
  }
  function handleTerminal(state: PaymentUiState) {
    // A cancelled/failed attempt must never poison the next checkout with the
    // same idempotency key. A new press of Pay intentionally creates a fresh
    // provider request and therefore a fresh prompt.
    try {
      sessionStorage.removeItem(`avant_payment_${productId}`)
      sessionStorage.removeItem(`avant_payment_key_${productId}`)
    } catch { /* unavailable */ }
    setReference('')
    setBusy(false)
    setStage('ready')
    setError(`${paymentStateMessage(state)} You can retry the payment now.`)
  }
  function normalizeKenyanMobile(value: string) {
    const digits = value.replace(/\D/g, '')
    let local = digits
    if (digits.startsWith('254')) local = '0' + digits.slice(3)
    else if (digits.length === 9 && (digits.startsWith('7') || digits.startsWith('1'))) local = '0' + digits
    if (!/^0(?:7|1)\d{8}$/.test(local)) return null
    return '254' + local.slice(1)
  }

  function playbackTarget() {
    const productKey = backendProductId || product?.id || productForLegacyContent(productId) || productId
    if (productKey === BACKEND_PRODUCT_IDS.aBetterLifeSeason2) return '/watch/a-better-life-s2e1'
    if (productKey === BACKEND_PRODUCT_IDS.aBetterLifeSeason1) return '/watch/a-better-life-1'
    if (productKey === BACKEND_PRODUCT_IDS.masterclass) return '/watch/jennifer-gatero-writing-masterclass-1'
    if (productKey === BACKEND_PRODUCT_IDS.thisIsLife) return '/watch/this-is-life-1'
    if (productKey === BACKEND_PRODUCT_IDS.backToUs) return '/watch/back-to-us'
    if (productKey === BACKEND_PRODUCT_IDS.nairobby) return '/watch/nairobby'
    const source = (returnTo || origin || '').trim()
    const slug = source.match(/\/title\/([^/?#]+)/)?.[1] || purchaseTitle?.slug || ''
    if (slug === 'a-better-life') return '/watch/a-better-life-1'
    if (slug === 'this-is-life') return '/watch/this-is-life-1'
    if (slug === 'jennifer-gatero-writing-masterclass') return '/watch/jennifer-gatero-writing-masterclass-1'
    if (source.startsWith('/watch/')) return source
    if (slug) return '/watch/' + slug
    return source && source.startsWith('/') && !source.startsWith('//') ? source : '/'
  }

  async function verifyAccessCode() {
    const code = accessCode.trim().toUpperCase().replace(/\s/g, '')
    if (!code) { setError('Enter the access code from your Avant payment email.'); return }
    setVerifyingAccessCode(true); setError('')
    try {
      let deviceId = ''
      try { deviceId = localStorage.getItem('avant_device_id') || '' } catch { /* unavailable */ }
      if (!deviceId) {
        deviceId = crypto.randomUUID()
        try { localStorage.setItem('avant_device_id', deviceId) } catch { /* unavailable */ }
      }
      await loginWithAccessCode(code, deviceId, 'Avant Web')
      try {
        const { accessCodeStorage } = await import('../lib/access-code-storage')
        const productKey = backendProductId || product?.id || productForLegacyContent(productId) || productId
        accessCodeStorage.save(code, '', productKey, displayTitle)
      } catch (storageError) {
        console.warn('Could not save access code locally:', storageError)
      }
      broadcastAccessChanged({ source: 'access-code-checkout' })
      clearPlaybackCache()
      setAccessCode('')
      const target = playbackTarget()
      setLeaving(true)
      await new Promise<void>((resolve) => window.setTimeout(resolve, 340))
      window.location.assign(target)
    } catch (e: any) {
      setError(e?.body?.error || e?.body?.message || e?.message || 'Access code not recognized. Check the code in your payment email.')
    } finally {
      setVerifyingAccessCode(false)
    }
  }

  async function start() {
    if (!online) { setError('You are offline. Reconnect before starting an M-PESA payment.'); return }
    if (!validEmail) { setError('Enter a valid email address. Your Avant access code will be sent there.'); return }
    const normalizedMobile = normalizeKenyanMobile(mobile)
    if (!normalizedMobile) { setError('Enter a valid Kenyan mobile number, for example 0712 345 678 or 0115 475 543.'); return }
    setMobile(normalizedMobile)
    setStage('sending'); setBusy(true); setError('')
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    try {
      const token = await customerToken(false)
      const resolved = backendProductId || product?.id || productForLegacyContent(productId) || productId
      // Every explicit Pay click is a new payment attempt. Never reuse an
      // idempotency key from an older/cancelled M-PESA attempt.
      let key = crypto.randomUUID()
      try { sessionStorage.setItem(`avant_payment_key_${productId}`, key) } catch { /* unavailable */ }
      const result = await startPalplussPayment(token, { productId: resolved, phone: normalizedMobile, email: email.trim().toLowerCase(), idempotencyKey: key })
      const nextReference = result.reference || result.payment?.reference
      if (!nextReference) throw new Error('Payment was not started.')
      setReference(nextReference); try { sessionStorage.setItem(`avant_payment_${productId}`, nextReference) } catch { /* unavailable */ }
      setStage('phone'); window.setTimeout(() => setStage('confirming'), 1400)
      if (!embedded) { await router.navigate({ to: '/payment/success', search: { reference: nextReference, returnTo: returnTo || origin, origin, originScroll: String(originScroll) } }); return }
      let attempts = 0
      const poll = async () => {
        attempts += 1
        try {
          const freshToken = await customerToken(false)
          let response = await paymentStatus(freshToken, nextReference)
          let state = normalizePaymentState(response.payment?.status || response.status, (response.entitlements?.length ?? 0) > 0)
          // A provider can mark M-PESA paid before the entitlement row is visible.
          // Reconcile immediately instead of leaving a paid customer locked.
          const providerPaid = /paid|success|successful|completed|complete/i.test(String(response.payment?.status || response.status || ''))
          if (providerPaid && (response.entitlements?.length ?? 0) === 0) {
            try {
              await reconcilePayments(freshToken)
              clearPlaybackCache()
              response = await paymentStatus(freshToken, nextReference)
              state = normalizePaymentState(response.payment?.status || response.status, (response.entitlements?.length ?? 0) > 0)
            } catch { /* polling will retry safely */ }
          }
          if (state === 'success') { await finish(nextReference); return }
          if (['failed', 'cancelled', 'timed_out'].includes(state)) { handleTerminal(state); return }
        } catch { /* retry safely */ }
        if (attempts < 80) window.setTimeout(poll, attempts < 10 ? 2500 : attempts < 30 ? 4000 : 7000)
        else { setBusy(false); setStage('pending'); setError('Confirmation is delayed. Do not pay again—verify this payment below.') }
      }
      void poll()
    } catch (e: any) {
      const raw=String(e?.body?.error||e?.body?.message||e?.message||'').trim()
      const authError=/invalid or expired customer session|customer session|401/i.test(raw)
      const timeout=/took too long|abort|timeout/i.test(raw)
      let saved=''
      try { saved=sessionStorage.getItem(`avant_payment_${productId}`)||'' } catch { /* unavailable */ }
      if (timeout && saved) {
        setReference(saved); setStage('pending'); setBusy(false)
        setError('M-PESA may still be processing. Do not pay again—use Check saved payment.')
        return
      }
      setStage('ready'); setBusy(false)
      setError(authError?'Your Avant session expired. Sign in again, then retry the payment.':timeout?'M-PESA is taking longer than expected. Check your phone first; if a prompt arrived, do not pay again.':(raw||'We could not send the M-PESA request. Please try again.'))
    }
  }
  async function startPayPal() {
    if (!online) { setError('You are offline. Reconnect before starting a PayPal payment.'); return }
    if (!validEmail) { setError('Enter a valid email address. Your Avant access code will be sent there.'); return }
    if (loading) return
    setBusy(true); setError(''); setStage('sending')
    try {
      const token = await customerToken(false)
      const resolved = product?.id || backendProductId || productForLegacyContent(productId) || productId
      // A cancelled PayPal order must not be reused. Each explicit checkout
      // attempt gets a fresh idempotency key and therefore a fresh PayPal order.
      let key = crypto.randomUUID()
      try { sessionStorage.setItem(`avant_paypal_key_${productId}`, key) } catch { /* unavailable */ }
      const created = await createPayPalOrder(token, { productId: resolved, email: email.trim().toLowerCase(), idempotencyKey: key })
      if (!created?.reference || !created?.orderId) throw new Error('PayPal order was not created.')
      setReference(created.reference)
      const clientId = paymentChannels?.paypal?.clientId
      if (!clientId) throw new Error('PayPal client configuration is unavailable.')
      const w = window as any
      if (!w.paypal) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector<HTMLScriptElement>('script[data-avant-paypal="1"]')
          if (existing) { existing.addEventListener('load', () => resolve(), { once: true }); existing.addEventListener('error', () => reject(new Error('Could not load PayPal')), { once: true }); return }
          const script = document.createElement('script')
          script.dataset['avantPaypal'] = '1'
          script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(created?.currency || 'USD')}&intent=capture`
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Could not load PayPal'))
          document.head.appendChild(script)
        })
      }
      setBusy(false); setStage('ready')
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      const host = document.getElementById('avant-paypal-buttons')
      if (!host || !w.paypal?.Buttons) throw new Error('PayPal checkout unavailable.')
      host.innerHTML = ''
      await w.paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal', height: 44 },
        createOrder: () => created.orderId,
        onApprove: async (data: any) => {
          setBusy(true); setStage('confirming'); setError('')
          try {
            const freshToken = await customerToken(false)
            const done = await capturePayPalOrder(freshToken, { orderId: data.orderID, reference: created.reference })
            if (!done?.ok) throw new Error('PayPal capture failed.')
            try { sessionStorage.removeItem(`avant_paypal_key_${productId}`) } catch { /* unavailable */ }
            await finish(created.reference)
          } catch (e: any) {
            setBusy(false); setStage('ready'); setError(e?.body?.error || e?.message || 'PayPal payment could not be confirmed.')
          }
        },
        onCancel: () => {
          try { sessionStorage.removeItem(`avant_paypal_key_${productId}`) } catch { /* unavailable */ }
          setReference('')
          setBusy(false)
          setStage('ready')
          setError('PayPal checkout was cancelled. You were not charged. You can try PayPal again now.')
        },
        onError: (e: any) => {
          try { sessionStorage.removeItem(`avant_paypal_key_${productId}`) } catch { /* unavailable */ }
          setReference('')
          setBusy(false)
          setStage('ready')
          setError(e?.message || 'PayPal checkout failed. You can try again now.')
        },
      }).render('#avant-paypal-buttons')
    } catch (e: any) {
      setBusy(false); setStage('ready'); setError(e?.body?.error || e?.body?.message || e?.message || 'Unable to start PayPal checkout.')
    }
  }

  async function checkPayment(referenceValue = reference) {
    if (!online) { setError('You are offline. Reconnect to verify this payment.'); return }
    if (!referenceValue) { setError('No payment reference is saved on this device.'); return }
    setBusy(true); setStage('confirming'); setError('')
    try {
      const token = await customerToken(false)
      let response = await paymentStatus(token, referenceValue)
      let state = normalizePaymentState(response.payment?.status || response.status, (response.entitlements?.length ?? 0) > 0)
      const providerPaid = /paid|success|successful|completed|complete/i.test(String(response.payment?.status || response.status || ''))
      if (providerPaid && (response.entitlements?.length ?? 0) === 0) {
        try {
          await reconcilePayments(token)
          clearPlaybackCache()
          response = await paymentStatus(token, referenceValue)
          state = normalizePaymentState(response.payment?.status || response.status, (response.entitlements?.length ?? 0) > 0)
        } catch { /* keep the confirmed payment recoverable */ }
      }
      if (state === 'success') { await finish(referenceValue); return }
      if (['failed', 'cancelled', 'timed_out'].includes(state)) { handleTerminal(state); return }
      setBusy(false); setStage('pending'); setError('Still awaiting provider confirmation. Do not pay again; check again shortly.')
    } catch { setBusy(false); setStage('pending'); setError('We could not check right now. Your payment is not lost—try again shortly.') }
  }
  async function recoverPaid() {
    if (!online) { setError('You are offline. Reconnect to verify this payment.'); return }
    if (!mobile.trim() && !mpesaCode.trim()) { setError('Enter the M-PESA number or transaction code.'); return }
    setBusy(true); setStage('confirming'); setError('')
    try {
      const token = await customerToken(false)
      const response = await recoverPayment(token, { ...(mobile.trim() ? { phone: mobile.trim() } : {}), ...(mpesaCode.trim() ? { mpesaCode: mpesaCode.trim() } : {}) })
      if (response.confirmed && response.reference) { await finish(response.reference); return }
      setBusy(false); setStage('pending'); setError(response.message || 'No confirmed payment matches those details yet.')
    } catch { setBusy(false); setStage('pending'); setError('Payment verification is temporarily unavailable. Please try again shortly.') }
  }
  function changePaymentMethod() {
    if (switchingMethod) return
    setSwitchingMethod(true); setError(''); setRecoveryOpen(false)
    const host=document.getElementById('avant-paypal-buttons'); if(host)host.innerHTML=''
    window.setTimeout(() => { setMethodChosen(false); setSwitchingMethod(false) }, 170)
  }
  function goBack() {
    if (leaving) return
    setLeaving(true)
    // Let the checkout visibly dissolve before changing route. Prefer the real
    // browser history entry so Back returns to the exact title/list/scroll state.
    window.setTimeout(() => {
      if (embedded) {
        window.parent.postMessage({ type: 'avant-checkout-close' }, '*')
        return
      }
      if (window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)) {
        window.history.back()
        return
      }
      const target = (returnTo || '').trim()
      if (target && target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/checkout/')) {
        void router.navigate({ to: target as any, replace: true })
        return
      }
      const fallback = (origin || '/').trim()
      void router.navigate({ to: (fallback.startsWith('/') && !fallback.startsWith('//') && !fallback.startsWith('/checkout/') ? fallback : '/') as any, replace: true })
    }, 340)
  }

  const stageCopy = activeMethod === 'paypal' ? (stage === 'sending' ? ['Preparing secure PayPal checkout', 'Creating your PayPal order securely…'] : ['Confirming your PayPal payment', 'Avant unlocks automatically after PayPal confirms.']) : stage === 'sending' ? ['Sending your M-PESA request', 'Connecting securely to your phone…'] : stage === 'phone' ? ['Check your phone', 'Enter your M-PESA PIN to approve the payment.'] : ['Confirming your payment', 'Avant unlocks automatically the moment M-PESA confirms.']
  const processing = busy || ['phone', 'confirming'].includes(stage)
  const fieldWrap = 'flex min-h-14 items-center gap-3 rounded-xl border border-border bg-background/60 px-4 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15'
  const fieldInput = 'min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground/60'

  const titleArtwork = optimizedArtwork(purchaseTitle?.backdrop_url || purchaseTitle?.poster_url || purchaseTitle?.backdrop || purchaseTitle?.artwork || '', embedded ? 640 : 960) || ''
  const displayTitle = purchaseTitle?.title || product?.name || 'Avant Cinema access'

  return <main className={`${embedded ? 'min-h-full' : 'min-h-[100svh]'} relative overflow-hidden bg-[#080808] text-foreground transition-[opacity,filter,transform] duration-[340ms] ease-[cubic-bezier(.16,1,.3,1)] will-change-[opacity,filter,transform] ${leaving ? 'pointer-events-none scale-[.975] opacity-0 blur-[8px]' : 'scale-100 opacity-100 blur-0'}`}>
    <div className={`relative mx-auto w-full ${embedded ? 'max-w-xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3' : 'max-w-6xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8'}`}>
      {!embedded && <header className="flex items-center justify-between pb-5">
        <Button type="button" variant="ghost" onClick={goBack} className="-ml-2 min-h-10 gap-2 px-2 text-white/60 hover:bg-white/5 hover:text-white"><ArrowLeft className="size-4"/>Back</Button>
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] text-white/45"><LockKeyhole className="size-3.5 text-primary"/>Secure checkout</span>
      </header>}

      <div className={`overflow-hidden ${embedded ? '' : 'rounded-[1.75rem] border border-white/10 bg-[#0d0d0d] shadow-2xl shadow-black/60 lg:grid lg:min-h-[650px] lg:grid-cols-[.88fr_1.12fr]'}`}>
        {!embedded && <CinematicPurchase product={product} displayTitle={displayTitle} loading={loading} amount={amount} artwork={titleArtwork}/>}

        <section className={`${embedded ? '' : 'flex min-w-0 flex-col justify-center px-5 py-7 sm:px-9 sm:py-10 lg:px-12'}`}>
          {!embedded && <div className="mb-8 border-b border-white/10 pb-6">
            <p className="text-[10px] font-bold uppercase tracking-[.26em] text-primary">Your screening</p>
            <div className="mt-3 flex items-end justify-between gap-5">
              <div className="min-w-0"><h1 className="truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl">{product?.name || displayTitle}</h1><p className="mt-1.5 text-sm text-white/45">{product?.duration_days ? `${product.duration_days} days of access` : 'Access confirmed before payment'}</p></div>
              <div className="shrink-0 text-right">{regularAmount && <p className="text-xs text-white/35 line-through">{regularAmount}</p>}<strong className="text-xl font-semibold text-white sm:text-2xl">{amount}</strong></div>
            </div>
          </div>}

          {processing ? <div className="py-12 text-center" role="status" aria-live="polite">
            <div className="relative mx-auto grid size-14 place-items-center rounded-full border border-primary/30 text-primary"><span className="absolute inset-1 rounded-full border border-primary/20 motion-safe:animate-ping"/>{stage === 'phone' ? <Phone className="size-5"/> : <Clock3 className="size-5 motion-safe:animate-pulse"/>}</div>
            <h2 className="mt-6 text-xl font-semibold text-white">{stageCopy[0]}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/45">{stageCopy[1]}</p>
            {reference && <p className="mt-5 truncate font-mono text-[10px] text-white/25">Ref {reference}</p>}
            <p className="mt-5 text-xs text-white/35">Keep this screen open · don't pay twice</p>
          </div> : <>
            <section className="mb-7 rounded-2xl border border-primary/25 bg-primary/[.06] p-4">
              <div className="flex items-start gap-3">
                <LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[.16em] text-primary">Access code verification</p>
                  <p className="mt-1 text-sm font-semibold text-white">Already paid? Check your email.</p>
                  <p className="mt-1 text-xs leading-5 text-white/45">Enter the access code sent to you after payment. We’ll save it on this device so you can access your purchase without paying again.</p>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={accessCode}
                  onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
                  onKeyDown={(event) => { if (event.key === 'Enter') void verifyAccessCode() }}
                  placeholder="Access code from your email"
                  aria-label="Access code"
                  autoCapitalize="characters"
                  autoComplete="one-time-code"
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-sm font-mono tracking-wider text-white outline-none placeholder:text-white/25 focus:border-primary"
                />
                <Button type="button" onClick={() => void verifyAccessCode()} disabled={verifyingAccessCode || !accessCode.trim()} className="min-h-11 rounded-lg px-5 font-bold">
                  {verifyingAccessCode ? 'Verifying…' : 'Verify access code'}
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-white/30">Paid already? Look in your email for the Avant access code before starting another payment.</p>
            </section>

            <div>
              <label htmlFor="avant-email" className="text-[11px] font-bold uppercase tracking-[.16em] text-white/50">Email</label>
              <div className="mt-2 flex min-h-12 items-center gap-3 border-b border-white/20 bg-transparent transition focus-within:border-primary">
                <Mail className="size-4 shrink-0 text-white/35"/>
                <input id="avant-email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" inputMode="email" autoComplete="email" className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/25"/>
              </div>
              <p className="mt-2 text-xs text-white/35">Receipt and access code will be sent here.</p>
            </div>

            {!methodChosen ? <div className="mt-8 animate-in fade-in duration-300">
              <p className="text-[11px] font-bold uppercase tracking-[.16em] text-white/50">Pay with</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {palplusOn && <button type="button" onClick={() => { setMethod('mpesa'); setMethodChosen(true); setError('') }} className="flex min-h-[72px] items-center justify-between rounded-xl border border-emerald-500/45 bg-emerald-950/20 p-3.5 text-left transition duration-200 hover:border-emerald-400 hover:bg-emerald-950/35"><MPesaLogoBadge/><span className="size-4 rounded-full border border-emerald-400 bg-emerald-500 shadow-[inset_0_0_0_4px_rgba(0,0,0,.35)]"/></button>}
                {paypalOn && <button type="button" onClick={() => { setMethod('paypal'); setMethodChosen(true); setError('') }} className="flex min-h-[72px] items-center justify-between rounded-xl border border-sky-500/45 bg-sky-950/20 p-3.5 text-left transition duration-200 hover:border-sky-400 hover:bg-sky-950/35"><PayPalLogoBadge/><span className="size-4 rounded-full border border-sky-400 bg-sky-500 shadow-[inset_0_0_0_4px_rgba(0,0,0,.35)]"/></button>}
              </div>
              <p className="mt-4 text-xs text-white/30">Choose a payment method to continue.</p>
            </div> : <div className={`mt-8 transition-all duration-200 ${switchingMethod ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100'}`}>
              <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3.5">
                {activeMethod === 'mpesa' ? <MPesaLogoBadge /> : <PayPalLogoBadge />}
                {(paypalOn && palplusOn) ? <button type="button" onClick={changePaymentMethod} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/20"><ArrowLeft className="size-3"/>Change</button> : null}
              </div>

              {activeMethod === 'mpesa' && <div>
                <label htmlFor="mpesa-number" className="text-[11px] font-bold uppercase tracking-[.16em] text-white/50">Mobile number</label>
                <div className="mt-2 flex min-h-12 items-center gap-3 border-b border-white/20 transition focus-within:border-primary">
                  <span className="border-r border-white/10 pr-3 text-sm font-semibold text-white/45">+254</span>
                  <input id="mpesa-number" value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="07XX XXX XXX" inputMode="tel" autoComplete="tel" className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/25"/>
                </div>
                <Button onClick={() => void start()} disabled={!online || !validEmail || !normalizeKenyanMobile(mobile) || loading || !product} size="lg" className="mt-6 min-h-12 w-full rounded-lg text-sm font-bold">{loading ? 'Loading price…' : product ? `Pay ${amount}` : 'Payment unavailable'}</Button>
                <p className="mt-3 text-center text-xs text-white/30">We'll send an M-PESA prompt to your phone.</p>
              </div>}

              {activeMethod === 'paypal' && <div>
                <Button type="button" onClick={() => void startPayPal()} disabled={!online || loading || busy} className="min-h-12 w-full rounded-lg text-sm font-bold">Continue with PayPal · {amount}</Button>
                {!validEmail && <p className="mt-2 text-center text-xs font-semibold text-primary">Enter your email above first.</p>}
                <div id="avant-paypal-buttons" className="mt-4 min-h-0 w-full"/>
                <p className="mt-3 text-center text-xs text-white/30">Your title unlocks after PayPal confirms payment.</p>
              </div>}
            </div>}
          </>}

          {activeMethod === 'mpesa' && methodChosen && !processing && <button type="button" onClick={() => setRecoveryOpen((value) => !value)} disabled={!online} className="mt-6 text-center text-xs font-semibold text-white/35 transition hover:text-white">Already paid? Verify payment</button>}

          {recoveryOpen && !busy && <section className="mt-4 border-t border-white/10 pt-4">
            <p className="text-sm font-semibold text-white">Find a completed payment</p>
            <input value={mpesaCode} onChange={(event) => setMpesaCode(event.target.value.toUpperCase())} placeholder="M-PESA transaction code" autoCapitalize="characters" className="mt-3 min-h-11 w-full border-b border-white/20 bg-transparent px-1 text-sm text-white outline-none focus:border-primary"/>
            <Button type="button" onClick={() => void recoverPaid()} disabled={!mobile.trim() && !mpesaCode.trim()} variant="outline" className="mt-3 min-h-11 w-full rounded-lg font-semibold">Verify payment</Button>
          </section>}

          {reference && !busy && <Button type="button" variant="ghost" onClick={() => void checkPayment()} className="mt-3 min-h-10 w-full gap-2 text-white/40"><RefreshCw className="size-4"/>Check saved payment</Button>}
          {!online && <div className="mt-4 flex gap-3 border-t border-white/10 pt-4 text-sm text-white/60" role="status"><CircleAlert className="mt-0.5 size-4 shrink-0"/>Checkout is paused while you're offline.</div>}
          {error && <div className="mt-4 flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm" role="alert"><CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive"/><span>{error}</span></div>}

          {!embedded && <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 pt-5 text-[11px] text-white/30">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-primary"/>Secure payment</span>
            <span className="inline-flex items-center gap-1.5"><Zap className="size-3.5 text-primary"/>Instant access</span>
            <span className="inline-flex items-center gap-1.5"><Mail className="size-3.5 text-primary"/>Code by email</span>
          </div>}
        </section>
      </div>
    </div>
  </main>
}

function CinematicPurchase({ product, displayTitle, loading, amount, artwork }: { product: any; displayTitle: string; loading: boolean; amount: string; artwork: string }) {
  return <aside className="relative aspect-[16/9] overflow-hidden bg-[#111] sm:min-h-[330px] lg:aspect-auto lg:min-h-full">
    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-[#161616] to-black"/>{artwork ? <img src={artwork} alt="" className="absolute inset-0 size-full object-cover" loading="eager" fetchPriority="high" decoding="async"/> : null}
    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/5"/>
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/35"/>
    <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 lg:p-10">
      <p className="text-[10px] font-bold uppercase tracking-[.25em] text-primary">You're unlocking</p>
      {loading ? <div className="mt-3 h-9 w-2/3 animate-pulse rounded bg-white/10"/> : <h2 className="mt-2 max-w-md text-2xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">{displayTitle}</h2>}
      <div className="mt-4 flex items-center gap-3 text-xs text-white/55"><span>{product?.duration_days ? `${product.duration_days} days access` : 'Premium access'}</span><span className="size-1 rounded-full bg-primary"/><span>{amount}</span></div>
    </div>
  </aside>
}
