import { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';

interface MainLayoutProps {
  children: ReactNode;
}

/**
 * Provides a page layout with a fixed header and footer, and a main content area that expands to fill the available vertical space.
 *
 * @param children - The content to display within the main section of the layout
 * @returns The composed layout with header, main content, and footer
 */
export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  );
}