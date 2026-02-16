import React from 'react';
import { DeadlineBanner } from './components/landing/DeadlineBanner';
import { Header } from './components/landing/Header';
import { Hero } from './components/landing/Hero';
import { TrustBar } from './components/landing/TrustBar';
import { WhoNeedsToFile } from './components/landing/WhoNeedsToFile';
import { WhatYouNeed } from './components/landing/WhatYouNeed';
import { HowItWorks } from './components/landing/HowItWorks';
import { Pricing } from './components/landing/Pricing';
import { FAQ } from './components/landing/FAQ';
import { Footer } from './components/landing/Footer';
export function App() {
  return (
    <div className="min-h-screen bg-white font-body text-text-primary">
      <DeadlineBanner />
      <Header />
      <main>
        <Hero />
        <TrustBar />
        <WhoNeedsToFile />
        <WhatYouNeed />
        <HowItWorks />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </div>);

}