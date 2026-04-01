import Script from 'next/script';

export function GoogleTagManager({ gtmId, gadsId, nonce }: { gtmId: string; gadsId?: string; nonce?: string }) {
  if (!gtmId) return null;
  const gadsConfig = gadsId ? `gtag('config','${gadsId}');` : '';
  // US-only site: all consent defaults to "granted" (no GDPR requirement).
  // Cookie consent banner still shown for transparency but does not gate tracking.
  const consentCheck = `gtag('consent','default',{analytics_storage:'granted',ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted'});`;
  return (
    <>
      <Script
        id="gtag-js"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${gtmId}`}
        nonce={nonce}
      />
      <Script
        id="gtag-init"
        strategy="afterInteractive"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}${consentCheck}gtag('js',new Date());gtag('config','${gtmId}');${gadsConfig}`,
        }}
      />
    </>
  );
}
