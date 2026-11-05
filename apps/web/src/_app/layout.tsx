import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { StoreHeader } from '@/widgets/store-header';
import './styles.css';

export const metadata: Metadata = {
  title: 'Gear Drop — Desk gear, done right',
  description: 'Explore a curated drop of mechanical keyboards, keycaps, and desk essentials.',
};

export function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <StoreHeader />
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            <span>GEAR DROP / THE DESK EDIT</span>
            <span>Demo storefront · Simulated payments</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
