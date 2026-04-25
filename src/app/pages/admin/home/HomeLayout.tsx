// Shell for every /admin/home/* route. Keeps a thin top-of-page breadcrumb
// (so sub-pages always have a "← Retour au hub" link) and renders the
// nested route via <Outlet />. The heavier state — config, lookups, draft —
// lives in useHomepageConfig, which each sub-page imports directly. That
// way we avoid prop-drilling through Context while keeping each page
// independently lazy-loadable.
import React from 'react';
import { Outlet } from 'react-router';

export default function HomeLayout() {
  return (
    <div className="space-y-6">
      <Outlet />
    </div>
  );
}
