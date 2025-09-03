export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] py-12 px-6">
      <div className="max-w-4xl mx-auto">
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
            <h2 className="text-xl font-semibold mb-3">9. Children's Privacy</h2>
            <p>Our service is not intended for children under 13. We do not knowingly collect personal information from children under 13.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Changes to This Policy</h2>
            <p>We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
            <p>If you have questions about this privacy policy, please contact us at sply@chatflix.app</p>
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
