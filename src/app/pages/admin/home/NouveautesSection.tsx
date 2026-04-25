// /admin/home/nouveautes — Carousel "Nouveautés".
// Role: highlight products added recently. Pipes through the same
// products mechanism with the `new_arrivals` preset slug.
import React from 'react';
import { useHomepageConfig } from './shared/useHomepageConfig';
import { SectionShell } from './shared/SectionShell';
import { ProductsSectionBody } from './shared/ProductsSectionBody';

export default function NouveautesSection() {
  const hub = useHomepageConfig();
  return (
    <SectionShell sectionKey="new_arrivals" hub={hub}>
      <ProductsSectionBody sectionKey="new_arrivals" hub={hub} />
    </SectionShell>
  );
}
