"use client";

import Link from "next/link";
import { CheckCircle, Shield, Lock, User, Landmark, FileCheck, CreditCard, Clock } from "lucide-react";

const STEPS = [
  {
    number: 1,
    title: "Personal Info",
    time: "about 2 min",
    icon: User,
    description:
      "Name, address, and taxpayer ID \u2014 encrypted with AES-256, the same standard used by the U.S. government for classified data.",
  },
  {
    number: 2,
    title: "Foreign Accounts",
    time: "about 3 min",
    icon: Landmark,
    description:
      "Bank name, country, and maximum account balance. Upload a statement to auto-fill account details.",
  },
  {
    number: 3,
    title: "Review and Sign",
    time: "about 1 min",
    icon: FileCheck,
    description:
      "Review your information and sign electronically with Form 114a.",
  },
  {
    number: 4,
    title: "Pay and File",
    time: "$59",
    icon: CreditCard,
    description:
      "We submit directly to FinCEN. You\u2019ll receive your BSA tracking ID within 48 hours.",
  },
];

const TRUST_SIGNALS = [
  {
    icon: Shield,
    text: "Your data is encrypted end-to-end",
  },
  {
    icon: Lock,
    text: "FinCEN-registered transmitter (TCC PBSA8180)",
  },
  {
    icon: CheckCircle,
    text: "Free resubmission if rejected",
  },
];

export default function WelcomePage() {
  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      {/* Success header */}
      <div className="text-center mb-10">
        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-navy-900 mb-2">Email Verified</h1>
        <p className="text-gray-600">Here&apos;s what filing your FBAR looks like</p>
      </div>

      {/* Steps */}
      <div className="space-y-6 mb-10">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.number} className="flex gap-4">
              <div className="flex-shrink-0 flex items-start pt-1">
                <span className="flex items-center justify-center w-8 h-8 bg-navy-900 text-white text-sm font-bold">
                  {step.number}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <Icon className="w-5 h-5 text-navy-900 flex-shrink-0" aria-hidden="true" />
                  <h2 className="text-base font-semibold text-navy-900">{step.title}</h2>
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 border border-gray-200">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    {step.time}
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trust signals */}
      <div className="border-t border-gray-200 pt-6 mb-8">
        <div className="space-y-3">
          {TRUST_SIGNALS.map((signal) => {
            const Icon = signal.icon;
            return (
              <div key={signal.text} className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-navy-900 flex-shrink-0" aria-hidden="true" />
                <span className="text-sm text-gray-600">{signal.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <Link
        href="/threshold"
        className="block w-full py-3 px-6 bg-navy-900 text-white text-center font-medium hover:bg-navy-800"
      >
        Start Filing
      </Link>
    </div>
  );
}
