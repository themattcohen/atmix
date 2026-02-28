import Script from 'next/script';

export function GoogleTagManager({ gtmId, gadsId, nonce }: { gtmId: string; gadsId?: string; nonce?: string }) {
  if (!gtmId) return null;
  const gadsConfig = gadsId ? `gtag('config','${gadsId}');` : '';
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
          __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gtmId}');${gadsConfig}`,
        }}
      />
    </>
  );
}
