import Script from 'next/script';

export function GoogleTagManager({ gtmId, gadsId, nonce }: { gtmId: string; gadsId?: string; nonce?: string }) {
  if (!gtmId) return null;
  const gadsConfig = gadsId ? `gtag('config','${gadsId}');` : '';
  // Check localStorage for prior consent; default to "denied" for GDPR compliance
  const consentCheck = `var cs=typeof localStorage!=='undefined'&&localStorage.getItem('fbar_cookie_consent')==='granted'?'granted':'denied';gtag('consent','default',{analytics_storage:cs,ad_storage:cs,ad_user_data:cs,ad_personalization:cs});`;
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
