'use client'

export default function ControlSection() {
  return (
    <div className="mt-8 sm:mt-12 md:mt-16 lg:mt-20">
      <h1 className="text-[clamp(3rem,10vw,4.5rem)] font-semibold tracking-tight leading-none text-[var(--foreground)] mb-12 sm:mb-12">
        Control<span className="sm:hidden"><br /></span> is yours.
      </h1>
      <p className="text-[clamp(1.25rem,5vw,1.5rem)] leading-normal text-[var(--foreground)] max-w-3xl mb-16 sm:mb-20">
        Take direct control of your Memory Bank through two methods: direct editing of any memory category and immediate input during conversations.
      </p>
      
      <div className="space-y-8 max-w-3xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Mobile: Image first, then text */}
          <div className="lg:hidden">
            <div className="flex justify-center mb-6">
              <img 
                src="/memory/edit_iphone-removebg-preview.png" 
                alt="Edit button on memory card" 
                className="w-64 h-auto"
              />
            </div>
            <h3 className="text-2xl font-semibold mb-4 text-[var(--foreground)]">Direct Editing</h3>
            <p className="text-lg text-[var(--muted)]">
              You can directly edit any memory category by clicking the "Edit" button on any memory card. This allows you to modify the content and save changes, giving you complete control over what Chatflix remembers about you.
            </p>
          </div>
          
          {/* Desktop: Image on the left */}
          <div className="hidden lg:flex justify-center">
            <img 
              src="/memory/edit_iphone-removebg-preview.png" 
              alt="Edit button on memory card" 
              className="w-80 h-auto"
            />
          </div>
          
          {/* Desktop: Text on the right */}
          <div className="hidden lg:block">
            <h3 className="text-2xl font-semibold mb-4 text-[var(--foreground)]">Direct Editing</h3>
            <p className="text-lg text-[var(--muted)]">
              You can directly edit any memory category by clicking the "Edit" button on any memory card. This allows you to modify the content and save changes, giving you complete control over what Chatflix remembers about you.
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Mobile: Image first, then text */}
          <div className="lg:hidden">
            <div className="flex justify-center mb-6">
              <img 
                src="/memory/input_iphone.png" 
                alt="User input example in chat" 
                className="w-64 h-auto"
              />
            </div>
            <h3 className="text-2xl font-semibold mb-4 text-[var(--foreground)]">Immediate User Input</h3>
            <p className="text-lg text-[var(--muted)]">
              You can explicitly tell Chatflix to remember specific information by saying things like "Remember that I prefer concise responses" or "Save this as my preference." These updates are immediately reflected in your Memory Bank.
            </p>
          </div>
          
          {/* Desktop: Text first, then image */}
          <div className="hidden lg:block">
            <h3 className="text-2xl font-semibold mb-4 text-[var(--foreground)]">Immediate User Input</h3>
            <p className="text-lg text-[var(--muted)]">
              You can explicitly tell Chatflix to remember specific information by saying things like "Remember that I prefer concise responses" or "Save this as my preference." These updates are immediately reflected in your Memory Bank.
            </p>
          </div>
          
          {/* Desktop: Image on the right */}
          <div className="hidden lg:flex justify-center">
            <img 
              src="/memory/input_iphone.png" 
              alt="User input example in chat" 
              className="w-80 h-auto"
            />
          </div>
        </div>
      </div>
      
      {/* Contact Footer */}
      <div className="mt-28 mb-8 text-center">
        <p className="text-sm text-[var(--muted)]">
          If you have any questions,<br className="sm:hidden" />contact us at <a href="mailto:sply@chatflix.app" className="hover:text-[var(--foreground)] transition-colors">sply@chatflix.app</a>
        </p>
      </div>
    </div>
  )
}
