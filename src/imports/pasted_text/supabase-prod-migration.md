Now I want to close the Supabase phase completely and move this platform from prototype-grade storage into a real production-grade Supabase architecture.

This is a critical milestone.

I want the platform to use Supabase as the true backend foundation for:

- Database
- Authentication
- Storage
- Real data persistence
- Admin control synchronization
- Web + Mobile app synchronization

Do this as an ULTRA PREMIUM production migration phase.

==================================================
PRIMARY GOAL

Replace or prepare the current KV/prototype storage approach with a real Supabase production architecture.

The final result must make the platform operate like a real e-commerce system, not only a prototype.

I want Supabase to become the real source of truth for:

- products
- categories
- banners
- homepage config
- orders
- customers
- media
- settings
- theme
- admin authentication

==================================================

1. DATABASE ARCHITECTURE
   ==================================================

Design and implement a real production-ready Supabase database structure for the platform.

I need clear and modular real data models for:

- admin_users
- customers
- categories
- products
- product_images
- product_variants (if needed)
- banners
- homepage_sections
- orders
- order_items
- wholesale_requests
- media_assets
- store_settings
- theme_settings
- app_settings

Requirements:

- relational and scalable structure
- production-grade naming
- support Arabic + French content where needed
- support dynamic storefront placement
- support homepage builder
- support future app growth

Do not keep the data layer as a prototype-only structure.

==================================================
2. ADMIN AUTHENTICATION

Move admin authentication to a real production-grade Supabase auth flow.

Requirements:

- secure admin login
- no fragile static token logic
- no mock auth
- no hardcoded admin token
- role-based admin access
- protected admin routes
- persistent authenticated session
- logout support
- robust auth validation

If needed, use:

- Supabase Auth
- admin role / metadata
- secure route guards

The admin panel must become truly secure and production-ready.

==================================================
3. MEDIA STORAGE

Use real Supabase Storage for all uploaded media.

Requirements:

- product images stored in Supabase Storage
- banner images stored in Supabase Storage
- homepage media stored in Supabase Storage
- optional product video support if possible
- media URLs stored properly in database
- delete flow removes real storage references when needed
- reusable media library for admin panel

I want the media system to be real, durable, and reusable.

==================================================
4. PRODUCTS + STOREFRONT MERCHANDISING

Migrate product data and control to real Supabase-backed persistence.

Each product must support real stored fields such as:

- name
- bilingual titles if applicable
- description
- price
- old price
- stock
- category
- image list
- tags
- featured flag
- visibility
- sort order

Very important:
I want the admin to control exactly where each product appears.

Support real stored placement controls such as:

- show_on_homepage
- show_in_featured
- show_in_best_sellers
- show_in_new_arrivals
- show_in_promotions
- show_in_cartables
- show_in_trousses
- show_in_school_supplies
- section_priority

These must be persisted in Supabase and respected by the real storefront.

==================================================
5. BANNERS + HOMEPAGE BUILDER

Migrate banner and homepage configuration to real Supabase persistence.

Requirements:

- banners stored in database
- banner image URLs stored in database
- activate / deactivate banners
- banner ordering
- CTA text and links
- bilingual banner content if applicable

Homepage builder config must also be stored for real:

- section enabled/disabled
- section order
- section titles
- section subtitles
- section limits
- selected products
- hero section content
- hero background

This must no longer be prototype-only behavior.

==================================================
6. STORE SETTINGS + THEME SETTINGS

Store settings and theme customization must be persisted in real Supabase storage/data.

Support real persistence for:

- store name
- phone
- WhatsApp
- email
- address
- social links
- primary color
- secondary color
- background colors
- branding settings
- logo
- homepage branding text

Any changes from admin must be saved in Supabase and reflected on the real storefront.

==================================================
7. ORDERS + CUSTOMERS

Move orders and customer data to real Supabase-backed storage.

Requirements:

- orders stored in database
- order items stored relationally
- customer data stored properly
- order status updates persist
- admin can read real order history
- storefront checkout writes real order records
- future app can read user order history

Support a clean workflow:

- New
- Processing
- Delivered
- Cancelled / optional

==================================================
8. WEB + MOBILE APP SHARED BACKEND

This is extremely important.

I want ONE shared Supabase-backed backend/data system for:

- Website
- Mobile app / APK
- Admin panel

Do NOT create separate data sources.

Any changes in admin must be reflected on:

- web storefront
- mobile app / APK

This includes:

- products
- banners
- categories
- homepage sections
- media
- settings
- theme

The app and the website must consume the same backend truth.

==================================================
9. REMOVE PROTOTYPE-ONLY LIMITATIONS

At this stage, reduce reliance on prototype-only KV logic wherever possible.

If some parts still need temporary compatibility, make that clear.

But the final goal is:

- real Supabase persistence
- real admin auth
- real media storage
- real storefront data
- real sync

==================================================
10. MIGRATION STRATEGY

Handle this phase carefully and professionally.

I want a clean migration strategy from the current prototype logic to the real Supabase architecture.

Requirements:

- do not break the admin UI
- do not break storefront rendering
- preserve the current platform structure
- gradually replace prototype storage with real Supabase-backed data
- keep the code modular and scalable
- prepare the system for real launch

==================================================
11. PRODUCTION VALIDATION

After implementation, verify the following:

- admin login works with real auth
- products save and load from Supabase
- banners save and load from Supabase
- homepage config saves and loads from Supabase
- media uploads work in real storage
- theme settings persist
- orders persist
- customers persist
- web storefront reads real data
- mobile app / APK can consume the same real data

==================================================
FINAL GOAL

I want to fully close the Supabase phase with an ultra-premium production-ready backend foundation.

The platform must behave like a real centralized e-commerce operating system powered by Supabase.

No more fragile prototype-only logic.
No fake UI-only behavior.
No static admin token hacks.

I want real production-grade Supabase architecture for VERKING SCOLAIRE.