import Script from 'next/script';

export function GoogleTagManager({ ga4Id }: { ga4Id: string }) {
  if (!ga4Id) return null;

  const consentCheck = `var cs=typeof localStorage!=='undefined'&&localStorage.getItem('alpine_cookie_consent')==='granted'?'granted':'denied';gtag('consent','default',{analytics_storage:cs,ad_storage:cs,ad_user_data:cs,ad_personalization:cs});`;

  return (
    <>
      <Script
        id="gtag-js"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
      />
      <Script
        id="gtag-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}${consentCheck}gtag('js',new Date());gtag('config','${ga4Id}');`,
        }}
      />
    </>
  );
}
