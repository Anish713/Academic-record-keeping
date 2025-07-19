'use client';

import MainLayout from '@/components/layout/MainLayout';
import About from './About';

/**
 * Renders the About page with the main layout and about content.
 *
 * Displays the About component wrapped inside the MainLayout component.
 */
export default function AboutPage() {
  return (
    <MainLayout>
      <About />
    </MainLayout>
  );
}