'use client'

import React from 'react'

export default function PricingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md p-8 border border-[var(--subtle-divider)] rounded-md backdrop-blur-sm">
        <h1 className="text-2xl font-bold mb-4">We're updating our pricing</h1>
        <p className="text-[var(--muted)] mb-6">
          Our pricing page is currently being updated. Please check back later for our new plans and offers.
        </p>
        <div className="w-16 h-1 bg-gradient-to-r from-purple-500 to-blue-500 mx-auto"></div>
      </div>
    </div>
  )
}
 