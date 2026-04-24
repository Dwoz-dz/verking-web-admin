import { supabaseClient } from './supabaseClient';

/**
 * Hero Carousel — client wrappers around the SECURITY DEFINER RPCs:
 *   hero_slides_list_public  (anon)
 *   hero_slides_list_admin   (token-gated)
 *   hero_slides_upsert       (token-gated)
 *   hero_slides_delete       (token-gated)
 *   hero_slides_duplicate    (token-gated)
 *   hero_slides_reorder      (token-gated)
 *
 * All writes go through RPCs so we never depend on RLS write policies
 * or the edge function.
 */

export type HeroMediaType = 'image' | 'video';
export type HeroTransition = 'fade' | 'slide' | 'zoom';
export type HeroBgMode = 'solid' | 'gradient' | 'image';
export type HeroOverlayMode = 'none' | 'light' | 'dark';
export type HeroAlign = 'start' | 'center' | 'end';

export type HeroTextPanel = {
  bg_mode: HeroBgMode;
  bg_color: string;
  bg_gradient_from: string;
  bg_gradient_to: string;
  bg_gradient_angle: number;
  bg_image_url: string;
  overlay_mode: HeroOverlayMode;
  overlay_opacity: number; // 0..1
  blur_px: number;         // 0..24
  text_color: string;
  align: HeroAlign;
  show_text_overlay: boolean; // default true; when false, the text card is hidden
};

export type HeroSlide = {
  id: string;
  position: number;
  is_active: boolean;
  media_type: HeroMediaType;
  media_url: string | null;
  poster_url: string | null;
  duration_ms: number;
  transition: HeroTransition;
  title_fr: string | null;
  title_ar: string | null;
  subtitle_fr: string | null;
  subtitle_ar: string | null;
  cta_label_fr: string | null;
  cta_label_ar: string | null;
  cta_url: string | null;
  text_panel: HeroTextPanel;
  created_at?: string;
  updated_at?: string;
};

export const DEFAULT_HERO_TEXT_PANEL: HeroTextPanel = {
  bg_mode: 'gradient',
  bg_color: '#ffffff',
  bg_gradient_from: '#ffffff',
  bg_gradient_to: '#e0eaff',
  bg_gradient_angle: 135,
  bg_image_url: '',
  overlay_mode: 'light',
  overlay_opacity: 0.35,
  blur_px: 0,
  text_color: '#10223c',
  align: 'start',
  show_text_overlay: true,
};

function normalizePanel(raw: unknown): HeroTextPanel {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_HERO_TEXT_PANEL };
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
  return {
    bg_mode: (['solid', 'gradient', 'image'].includes(str(r.bg_mode, '')) ? r.bg_mode : 'gradient') as HeroBgMode,
    bg_color: str(r.bg_color, DEFAULT_HERO_TEXT_PANEL.bg_color),
    bg_gradient_from: str(r.bg_gradient_from, DEFAULT_HERO_TEXT_PANEL.bg_gradient_from),
    bg_gradient_to: str(r.bg_gradient_to, DEFAULT_HERO_TEXT_PANEL.bg_gradient_to),
    bg_gradient_angle: num(r.bg_gradient_angle, DEFAULT_HERO_TEXT_PANEL.bg_gradient_angle),
    bg_image_url: str(r.bg_image_url, ''),
    overlay_mode: (['none', 'light', 'dark'].includes(str(r.overlay_mode, '')) ? r.overlay_mode : 'light') as HeroOverlayMode,
    overlay_opacity: Math.max(0, Math.min(1, num(r.overlay_opacity, 0.35))),
    blur_px: Math.max(0, Math.min(30, num(r.blur_px, 0))),
    text_color: str(r.text_color, DEFAULT_HERO_TEXT_PANEL.text_color),
    align: (['start', 'center', 'end'].includes(str(r.align, '')) ? r.align : 'start') as HeroAlign,
    show_text_overlay: typeof r.show_text_overlay === 'boolean' ? r.show_text_overlay : true,
  };
}

function normalizeSlide(row: any): HeroSlide {
  return {
    id: String(row.id),
    position: Number(row.position ?? 0),
    is_active: Boolean(row.is_active),
    media_type: row.media_type === 'video' ? 'video' : 'image',
    media_url: row.media_url || null,
    poster_url: row.poster_url || null,
    duration_ms: Math.max(1500, Number(row.duration_ms ?? 4000)),
    transition: (['fade', 'slide', 'zoom'].includes(row.transition) ? row.transition : 'fade') as HeroTransition,
    title_fr: row.title_fr || null,
    title_ar: row.title_ar || null,
    subtitle_fr: row.subtitle_fr || null,
    subtitle_ar: row.subtitle_ar || null,
    cta_label_fr: row.cta_label_fr || null,
    cta_label_ar: row.cta_label_ar || null,
    cta_url: row.cta_url || null,
    text_panel: normalizePanel(row.text_panel),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function assertToken(token: string | undefined | null): asserts token is string {
  if (!token || typeof token !== 'string') {
    throw new Error('Missing admin token for hero slide action');
  }
}

/* ───────────── public ───────────── */

export async function listHeroSlidesPublic(): Promise<HeroSlide[]> {
  const { data, error } = await supabaseClient.rpc('hero_slides_list_public');
  if (error) throw new Error(error.message || 'Unable to load hero slides');
  return Array.isArray(data) ? data.map(normalizeSlide) : [];
}

/* ───────────── admin ───────────── */

export async function listHeroSlidesAdmin(token: string): Promise<HeroSlide[]> {
  assertToken(token);
  const { data, error } = await supabaseClient.rpc('hero_slides_list_admin', { p_token: token });
  if (error) throw new Error(error.message || 'Unable to load hero slides (admin)');
  return Array.isArray(data) ? data.map(normalizeSlide) : [];
}

export type HeroSlideUpsertInput = Partial<Omit<HeroSlide, 'id' | 'created_at' | 'updated_at'>> & {
  id?: string | null;
};

export async function upsertHeroSlide(token: string, input: HeroSlideUpsertInput): Promise<HeroSlide> {
  assertToken(token);
  const { data, error } = await supabaseClient.rpc('hero_slides_upsert', {
    p_token: token,
    p_id: input.id || null,
    p_is_active: input.is_active ?? true,
    p_media_type: input.media_type || 'image',
    p_media_url: input.media_url || null,
    p_poster_url: input.poster_url || null,
    p_duration_ms: Math.max(1500, Number(input.duration_ms ?? 4000)),
    p_transition: input.transition || 'fade',
    p_title_fr: input.title_fr ?? null,
    p_title_ar: input.title_ar ?? null,
    p_subtitle_fr: input.subtitle_fr ?? null,
    p_subtitle_ar: input.subtitle_ar ?? null,
    p_cta_label_fr: input.cta_label_fr ?? null,
    p_cta_label_ar: input.cta_label_ar ?? null,
    p_cta_url: input.cta_url ?? null,
    p_text_panel: input.text_panel ? { ...DEFAULT_HERO_TEXT_PANEL, ...input.text_panel } : DEFAULT_HERO_TEXT_PANEL,
    p_position: typeof input.position === 'number' ? input.position : null,
  });
  if (error) throw new Error(error.message || 'Unable to save hero slide');
  return normalizeSlide(data);
}

export async function deleteHeroSlide(token: string, id: string): Promise<boolean> {
  assertToken(token);
  const { error } = await supabaseClient.rpc('hero_slides_delete', { p_token: token, p_id: id });
  if (error) throw new Error(error.message || 'Unable to delete hero slide');
  return true;
}

export async function duplicateHeroSlide(token: string, id: string): Promise<HeroSlide> {
  assertToken(token);
  const { data, error } = await supabaseClient.rpc('hero_slides_duplicate', { p_token: token, p_id: id });
  if (error) throw new Error(error.message || 'Unable to duplicate hero slide');
  return normalizeSlide(data);
}

export async function reorderHeroSlides(token: string, ids: string[]): Promise<boolean> {
  assertToken(token);
  const { error } = await supabaseClient.rpc('hero_slides_reorder', { p_token: token, p_ids: ids });
  if (error) throw new Error(error.message || 'Unable to reorder hero slides');
  return true;
}
