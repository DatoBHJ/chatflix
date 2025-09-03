export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] py-12 px-6">
      <div className="max-w-4xl mx-auto">
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

          <div className="mt-8 pt-6 border-t border-[var(--subtle-divider)]">
            <p className="text-xs text-[var(--muted)]">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
