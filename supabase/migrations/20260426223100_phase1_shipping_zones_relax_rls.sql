-- Phase 1.1 follow-up — relax mobile_shipping_zones SELECT policy.
--
-- Original migration restricted anon SELECT to is_enabled=TRUE so the
-- mobile app never sees a disabled wilaya by accident. That's correct
-- for the mobile read path, but it also blinded the Gestionnaire Mobile
-- "Livraison" tab, because admin pages read directly via the anon
-- supabase-js client (matching the precedent set by mobile_home_sections
-- and mobile_theme).
--
-- Decision: align with the existing pattern — anon SELECT sees ALL rows,
-- and the mobile app filters `is_enabled = true` itself in
-- `getShippingZones()`. Writes still go through admin-mobile-config and
-- the X-Admin-Token gate.

DROP POLICY IF EXISTS shipping_zones_anon_read   ON public.mobile_shipping_zones;
DROP POLICY IF EXISTS shipping_zones_authed_read ON public.mobile_shipping_zones;

CREATE POLICY shipping_zones_anon_read
  ON public.mobile_shipping_zones FOR SELECT TO anon
  USING (true);

CREATE POLICY shipping_zones_authed_read
  ON public.mobile_shipping_zones FOR SELECT TO authenticated
  USING (true);
