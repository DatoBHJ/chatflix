'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Apple,
  Smartphone,
  Monitor,
  ArrowDown,
  Menu,
  X,
} from 'lucide-react';
import {
  iosChromeSteps,
  iosSafariSteps,
  androidChromeSteps,
  desktopChromeSteps,
  desktopChromeAlternativeStep,
  desktopSafariSteps,
  type Step,
} from '@/app/lib/pwaGuideConstants';
import { getChatflixLogo } from '@/lib/models/logoUtils';
import { useDarkMode } from '@/app/hooks/useDarkMode';

import './pwa-guide.css';

const navItems = [
  { label: 'iOS', href: '#ios' },
  { label: 'Android', href: '#android' },
  { label: 'Desktop', href: '#desktop' },
];

function StepCard({
  step,
  index,
  imageWrapperClass,
  badgeClass,
  badgeTextClass = 'text-[var(--chat-input-primary-foreground)]',
  iconBoxClass,
}: {
  step: Step;
  index: number;
  imageWrapperClass: string;
  badgeClass: string;
  badgeTextClass?: string;
  iconBoxClass: string;
}) {
  const Icon = step.icon;
  return (
    <div className="group">
      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${badgeTextClass} text-sm font-bold ${badgeClass} mb-3`}>
        {index + 1}
      </div>
      <div className={`relative overflow-hidden rounded-2xl mb-6 image-hover-zoom ${imageWrapperClass}`}>
        <img
          src={step.image}
          alt={step.title}
          className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0 ${iconBoxClass}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-[var(--foreground)] mb-1">{step.title}</h3>
          <p className="text-sm text-[var(--muted)] leading-relaxed">{step.description}</p>
        </div>
      </div>
    </div>
  );
}

export default function PWAGuidePage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isDark = useDarkMode();
  const logoSrc = getChatflixLogo({ isDark });

  const handleAnchorClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const href = e.currentTarget.getAttribute('href');
    if (href?.startsWith('#')) {
      e.preventDefault();
      const id = href.slice(1);
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header - theme-aware */}
      <header className="sticky top-0 z-50 w-full border-b border-[var(--subtle-divider)] bg-[var(--background)]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <img src={logoSrc} alt="Chatflix" className="h-8 w-8" />
            <span className="text-lg font-semibold text-[var(--foreground)]">PWA Guide</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={handleAnchorClick}
                className="text-sm font-medium text-[var(--muted)] hover:text-[var(--chat-input-primary)] transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <button
            className="md:hidden p-2 text-[var(--muted)] hover:text-[var(--foreground)]"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            type="button"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {isMenuOpen && (
          <div className="md:hidden">
            <nav className="flex flex-col px-4 py-4 space-y-3">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-base font-medium text-[var(--muted)] hover:text-[var(--chat-input-primary)] transition-colors"
                  onClick={(e) => {
                    handleAnchorClick(e);
                    setIsMenuOpen(false);
                  }}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* Hero - theme-aware */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[color-mix(in_srgb,var(--accent)_40%,transparent)] to-[var(--background)]">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <div className="text-center">
              <div className="inline-flex items-center rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--foreground)] mb-8">
                <span className="flex h-2 w-2 rounded-full bg-[var(--chat-input-primary)] mr-2" />
                Progressive Web App
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-5xl lg:text-6xl mb-6">
                Install as a <span className="text-[var(--chat-input-primary)]">PWA</span>
              </h1>
              <p className="mx-auto max-w-2xl text-lg text-[var(--muted)] mb-10">
                You can install this app as a Progressive Web App on your computer, tablet, or
                mobile device. A PWA runs off your browser but looks and feels like a traditional
                app, giving you a more seamless and optimized experience.
              </p>
              <div className="flex flex-wrap justify-center gap-4 mb-12">
                <a
                  href="#ios"
                  onClick={handleAnchorClick}
                  className="group flex items-center gap-3 rounded-xl bg-[var(--background)] px-6 py-4 shadow-sm border border-[var(--subtle-divider)] hover:shadow-md hover:border-[var(--chat-input-primary)]/30 transition-all"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--foreground)] text-[var(--background)]">
                    <Apple className="h-5 w-5" />
                  </div>
                  <span className="font-medium text-[var(--foreground)] group-hover:text-[var(--chat-input-primary)] transition-colors">
                    iOS
                  </span>
                </a>
                <a
                  href="#android"
                  onClick={handleAnchorClick}
                  className="group flex items-center gap-3 rounded-xl bg-[var(--background)] px-6 py-4 shadow-sm border border-[var(--subtle-divider)] hover:shadow-md hover:border-green-300 dark:hover:border-green-600 transition-all"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500 dark:bg-green-400 text-white">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <span className="font-medium text-[var(--foreground)] group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                    Android
                  </span>
                </a>
                <a
                  href="#desktop"
                  onClick={handleAnchorClick}
                  className="group flex items-center gap-3 rounded-xl bg-[var(--background)] px-6 py-4 shadow-sm border border-[var(--subtle-divider)] hover:shadow-md hover:border-[var(--chat-input-primary)]/30 transition-all"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--chat-input-primary)] text-[var(--chat-input-primary-foreground)]">
                    <Monitor className="h-5 w-5" />
                  </div>
                  <span className="font-medium text-[var(--foreground)] group-hover:text-[var(--chat-input-primary)] transition-colors">
                    Desktop
                  </span>
                </a>
              </div>
              <div className="flex flex-col items-center text-[var(--muted)]">
                <span className="text-sm mb-2">Scroll to learn more</span>
                <ArrowDown className="h-5 w-5 animate-bounce" />
              </div>
            </div>
          </div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-20 left-10 w-72 h-72 bg-[var(--chat-input-primary)]/15 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-[var(--accent)]/30 rounded-full blur-3xl" />
          </div>
        </section>

        {/* iOS - Apple: background + foreground (black/white) only */}
        <section id="ios" className="scroll-mt-20 py-20 lg:py-28 bg-[var(--background)]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 mb-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--foreground)] text-[var(--background)]">
                <Apple className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-[var(--foreground)]">iOS</h2>
                <p className="text-[var(--muted)]">Install on iPhone or iPad</p>
              </div>
            </div>

            {/* Google Chrome subsection */}
            <div className="mb-14">
              <div className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--foreground)] mb-8">
                <span className="flex h-2 w-2 rounded-full bg-[var(--foreground)]" />
                Google Chrome
              </div>
              <div className="grid gap-8 lg:grid-cols-4">
                {iosChromeSteps.map((step, index) => (
                  <StepCard
                    key={index}
                    step={step}
                    index={index}
                    imageWrapperClass="bg-[var(--accent)]"
                    badgeClass="bg-[var(--foreground)]"
                    badgeTextClass="text-[var(--background)]"
                    iconBoxClass="bg-[var(--accent)] text-[var(--foreground)] border border-[var(--subtle-divider)]"
                  />
                ))}
              </div>
            </div>

            {/* Safari subsection */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--foreground)] mb-8">
                <span className="flex h-2 w-2 rounded-full bg-[var(--foreground)]" />
                Safari
              </div>
              <div className="grid gap-8 lg:grid-cols-4">
                {iosSafariSteps.map((step, index) => (
                  <StepCard
                    key={index}
                    step={step}
                    index={index}
                    imageWrapperClass="bg-[var(--accent)]"
                    badgeClass="bg-[var(--foreground)]"
                    badgeTextClass="text-[var(--background)]"
                    iconBoxClass="bg-[var(--accent)] text-[var(--foreground)] border border-[var(--subtle-divider)]"
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Android - green on buttons/borders only, same background as others */}
        <section id="android" className="scroll-mt-20 py-20 lg:py-28 bg-[var(--background)]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 mb-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500 dark:bg-green-400 text-white">
                <Smartphone className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-[var(--foreground)]">Android</h2>
                <p className="text-[var(--muted)]">Install on Android devices</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] border border-green-200 dark:border-green-700 px-4 py-2 text-sm font-medium text-[var(--foreground)] mb-8">
              <span className="flex h-2 w-2 rounded-full bg-green-500 dark:bg-green-400" />
              Google Chrome
            </div>
            <div className="grid gap-8 lg:grid-cols-4">
              {androidChromeSteps.map((step, index) => (
                <StepCard
                  key={index}
                  step={step}
                  index={index}
                  imageWrapperClass="bg-[var(--accent)]"
                  badgeClass="bg-green-500 dark:bg-green-400"
                  badgeTextClass="text-white"
                  iconBoxClass="bg-[var(--accent)] text-green-600 dark:text-green-400 border border-green-200 dark:border-green-700"
                />
              ))}
            </div>
          </div>
        </section>

        {/* Desktop - browser별 구분 (iOS처럼 Google Chrome / Safari) */}
        <section id="desktop" className="scroll-mt-20 py-20 lg:py-28 bg-[var(--background)]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 mb-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--chat-input-primary)] text-[var(--chat-input-primary-foreground)]">
                <Monitor className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-[var(--foreground)]">Desktop</h2>
                <p className="text-[var(--muted)]">Install on Windows, macOS, or Linux</p>
              </div>
            </div>

            {/* Google Chrome subsection */}
            <div className="mb-14">
              <div className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--foreground)] mb-8">
                <span className="flex h-2 w-2 rounded-full bg-[var(--chat-input-primary)]" />
                Google Chrome
              </div>
              {/* 방법 1: 주소창 설치 아이콘 */}
              <p className="text-sm font-medium text-[var(--muted)] mb-4">Address bar install icon</p>
              <div className="grid gap-8 lg:grid-cols-2 mb-12">
                {desktopChromeSteps.map((step, index) => (
                  <StepCard
                    key={index}
                    step={step}
                    index={index}
                    imageWrapperClass="bg-[var(--accent)]"
                    badgeClass="bg-[var(--chat-input-primary)]"
                    iconBoxClass="bg-[var(--accent)] text-[var(--chat-input-primary)] border border-[var(--subtle-divider)]"
                  />
                ))}
              </div>
              {/* 방법 2: 메뉴 사용 */}
              <div className="mt-10">
                <p className="text-sm font-medium text-[var(--muted)] mb-4">Or use the menu</p>
                <div className="max-w-[calc(50%-1rem)] lg:max-w-md">
                  <StepCard
                    step={desktopChromeAlternativeStep}
                    index={0}
                    imageWrapperClass="bg-[var(--accent)]"
                    badgeClass="bg-[var(--chat-input-primary)]"
                    iconBoxClass="bg-[var(--accent)] text-[var(--chat-input-primary)] border border-[var(--subtle-divider)]"
                  />
                </div>
              </div>
            </div>

            {/* Safari subsection */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--foreground)] mb-8">
                <span className="flex h-2 w-2 rounded-full bg-[var(--chat-input-primary)]" />
                Safari
              </div>
              <div className="grid gap-8 lg:grid-cols-2">
                {desktopSafariSteps.map((step, index) => (
                  <StepCard
                    key={index}
                    step={step}
                    index={index}
                    imageWrapperClass="bg-[var(--accent)]"
                    badgeClass="bg-[var(--chat-input-primary)]"
                    iconBoxClass="bg-[var(--accent)] text-[var(--chat-input-primary)] border border-[var(--subtle-divider)]"
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer - theme-aware */}
      <footer className="border-t border-[var(--subtle-divider)] bg-[var(--background)]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-8">
            <div className="flex items-center gap-3">
              <img src={logoSrc} alt="Chatflix" className="h-10 w-10" />
              <span className="text-xl font-semibold text-[var(--foreground)]">PWA Guide</span>
            </div>
            <div className="flex flex-wrap justify-center gap-8 text-sm text-[var(--muted)]">
              <a href="#ios" onClick={handleAnchorClick} className="hover:text-[var(--chat-input-primary)] transition-colors">
                iOS Installation
              </a>
              <a href="#android" onClick={handleAnchorClick} className="hover:text-[var(--chat-input-primary)] transition-colors">
                Android Installation
              </a>
              <a href="#desktop" onClick={handleAnchorClick} className="hover:text-[var(--chat-input-primary)] transition-colors">
                Desktop Installation
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
