// /admin/home/best-sellers — Carousel "Best sellers".
// Role: surface the top-selling SKUs under the fold, driven by the
// `products` source_mode + `best_sellers` preset (or a manual pick).
// Thin wrapper: all UI lives in ProductsSectionBody.
import React from 'react';
import { useHomepageConfig } from './shared/useHomepageConfig';
import { SectionShell } from './shared/SectionShell';
import { ProductsSectionBody } from './shared/ProductsSectionBody';

export default function BestSellersSection() {
  const hub = useHomepageConfig();
  return (
    <SectionShell sectionKey="best_sellers" hub={hub}>
      <ProductsSectionBody sectionKey="best_sellers" hub={hub} />
    </SectionShell>
  );
}
