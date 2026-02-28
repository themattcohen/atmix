import Script from 'next/script';

export function GoogleTagManager({ gtmId, nonce }: { gtmId: string; nonce?: string }) {
  if (!gtmId) return null;
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
          __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gtmId}');`,
        }}
      />
    </>
  );
}
