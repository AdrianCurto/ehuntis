import { notFound } from 'next/navigation';
import CatalogClient from './CatalogClient';

export const metadata = {
  title: 'EHUntis UI Component Showcase',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DevUIPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return <CatalogClient />;
}
