import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SafarixMaps',
  description: 'Safety-aware navigation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-900 overflow-hidden">{children}</body>
    </html>
  );
}