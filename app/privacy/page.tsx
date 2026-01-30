'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { getChatflixLogo } from '@/lib/models/logoUtils'

type Tab = 'privacy' | 'terms'

export default function PrivacyPage() {
  const [isDark, setIsDark] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('privacy')

  // Detect theme changes
  useEffect(() => {
    const detectTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme')
      setIsDark(theme === 'dark')
    }

    detectTheme()
    const observer = new MutationObserver(detectTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    })

    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] py-12 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Home Navigation */}
        <div className="mb-12 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <Link
            href="/"
            className="cursor-pointer transition-opacity hover:opacity-80 inline-block"
          >
            <Image
              src={getChatflixLogo({ isDark })}
              alt="Chatflix"
              width={100}
              height={32}
              className="h-8 w-auto"
            />
          </Link>

          {/* Tab Navigation */}
          <div className="flex bg-[var(--muted)]/20 p-1 rounded-lg self-start sm:self-center">
            <button
              onClick={() => setActiveTab('privacy')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                activeTab === 'privacy'
                  ? 'bg-[var(--background)] shadow-sm text-[var(--foreground)]'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setActiveTab('terms')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                activeTab === 'terms'
                  ? 'bg-[var(--background)] shadow-sm text-[var(--foreground)]'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              Terms of Service
            </button>
          </div>
        </div>

        {activeTab === 'privacy' ? (
          <>
            <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
            <div className="space-y-6 text-sm leading-relaxed">
              <section>
                <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
                <p>We collect information you provide directly to us, such as when you create an account, including your email address, name, and authentication credentials from third-party providers (Google, Twitter, etc.).</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
                <p>We use the information we collect to provide, maintain, and improve our services, process your conversations, and communicate with you about your account and our services.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">3. Conversation Data</h2>
                <p>Your chat conversations are processed to provide AI responses and may be stored to improve your experience. We do not share your conversations with third parties except as necessary to provide our services.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">4. Third-Party Services</h2>
                <p>We use third-party services including Supabase for authentication and data storage, and various AI model providers for generating responses. These services have their own privacy policies.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">5. Data Security</h2>
                <p>We implement appropriate security measures to protect your personal information. However, no method of transmission over the internet is 100% secure.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
                <p>We retain your account information and conversations as long as your account is active. You may request deletion of your data by contacting us.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
                <p>You have the right to access, correct, or delete your personal information. You can manage your account settings or contact us for assistance.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">8. Cookies and Tracking</h2>
                <p>We use cookies and similar technologies to enhance your experience and analyze usage patterns. You can control cookie settings through your browser.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9. Contact Us</h2>
                <p>If you have questions about this privacy policy, please contact us at sply@chatflix.app</p>
              </section>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
            <div className="space-y-6 text-sm leading-relaxed">
              <section>
                <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
                <p>By accessing and using Chatflix.app ("Service"), you accept and agree to be bound by the terms and provision of this agreement.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
                <p>Chatflix is an AI-powered chat platform that provides access to various language models and tools for conversation, content creation, and information retrieval.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
                <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">4. Acceptable Use</h2>
                <p>You agree not to use the Service for any unlawful purpose or to violate any applicable laws or regulations. You must not attempt to gain unauthorized access to the Service or its systems.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">5. Content and Privacy</h2>
                <p>Your conversations and data are processed according to our Privacy Policy. We do not claim ownership of your content, but you grant us license to process it for service provision.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6. Service Availability</h2>
                <p>We strive to maintain high availability but do not guarantee uninterrupted access. We may modify, suspend, or discontinue the Service at any time.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">7. Limitation of Liability</h2>
                <p>Chatflix is provided "as is" without warranties. We are not liable for any damages arising from your use of the Service.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">8. Changes to Terms</h2>
                <p>We may update these terms at any time. Continued use of the Service constitutes acceptance of updated terms.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9. Contact</h2>
                <p>For questions about these terms, contact us at sply@chatflix.app</p>
              </section>
            </div>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-[var(--subtle-divider)]">
          <p className="text-xs text-[var(--muted)]">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  )
}
