// /admin/home/produits-vedettes — Carousel "Produits vedettes".
// Role: editorial hand-picked products. Defaults to the `featured`
// preset slug so any SKU marked featured=true appears automatically,
// with a manual override via the product id picker.
import React from 'react';
import { useHomepageConfig } from './shared/useHomepageConfig';
import { SectionShell } from './shared/SectionShell';
import { ProductsSectionBody } from './shared/ProductsSectionBody';

export default function VedettesSection() {
  const hub = useHomepageConfig();
  return (
    <SectionShell sectionKey="featured" hub={hub}>
      <ProductsSectionBody sectionKey="featured" hub={hub} />
    </SectionShell>
  );
}
