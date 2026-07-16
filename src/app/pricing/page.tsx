'use client';

import Link from 'next/link';
import { Check, Zap, Shield, Sparkles } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Get started with basic processing',
    features: [
      '5 minutes video transcription (one-time)',
      '50 ZIP/folder extractions per day',
      'Basic text export',
      'Community support',
    ],
    cta: 'Get Started',
    href: '/login',
    highlighted: false,
    icon: Zap,
  },
  {
    name: 'Pro',
    price: '$9',
    period: '/month',
    description: 'For professionals and teams',
    features: [
      '600 minutes video transcription per month',
      'Unlimited ZIP/folder extractions',
      'Priority processing',
      'All export formats',
      'Priority support',
      'Top up credits anytime',
    ],
    cta: 'Subscribe',
    href: '/api/payments/create-subscription',
    highlighted: true,
    icon: Sparkles,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900">Source2Txt</Link>
          <Link
            href="/login"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Sign In
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h1>
            <p className="text-lg text-gray-600">Choose the plan that fits your needs</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {plans.map((plan) => {
              const Icon = plan.icon;
              return (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl p-8 ${
                    plan.highlighted
                      ? 'bg-white border-2 border-blue-500 shadow-lg shadow-blue-100'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </div>
                  )}

                  <div className="flex items-center space-x-3 mb-4">
                    <div className={`p-2 rounded-lg ${plan.highlighted ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      <Icon className={`w-6 h-6 ${plan.highlighted ? 'text-blue-600' : 'text-gray-600'}`} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">{plan.name}</h2>
                  </div>

                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-500 ml-1">{plan.period}</span>
                  </div>

                  <p className="text-gray-600 mb-6">{plan.description}</p>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start space-x-3">
                        <Check className={`w-5 h-5 mt-0.5 flex-shrink-0 ${plan.highlighted ? 'text-blue-600' : 'text-green-500'}`} />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.href}
                    className={`block w-full text-center py-3 px-6 rounded-xl font-semibold transition-all ${
                      plan.highlighted
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              );
            })}
          </div>

          <div className="mt-16 text-center">
            <div className="inline-flex items-center space-x-2 text-gray-500">
              <Shield className="w-5 h-5" />
              <span>Secure payments via Stripe</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
