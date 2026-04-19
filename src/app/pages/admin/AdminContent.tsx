import React, { useEffect, useMemo, useState } from 'react';
import {
  Save, Plus, Trash2, HelpCircle, Phone, Info, BookOpen, Star, Eye,
  EyeOff, ArrowUp, ArrowDown, MessageSquare, MapPin, Clock, Mail, Instagram,
  Facebook, Megaphone, Search as SearchIcon, MailCheck, Play, Pause,
  GripVertical, Pencil, Copy, Monitor, Smartphone, CheckCircle2, UserCircle2,
  SlidersHorizontal, Layers,
} from 'lucide-react';
import { adminApi, api } from '../../lib/api';
import { CategoriesMarketingStrip } from '../../components/home/CategoriesMarketingStrip';
import { InlineAnnouncementStrip } from '../../components/home/InlineAnnouncementStrip';
import { normalizeCategoriesStrip } from '../../lib/categoriesStrip';
import { useAuth } from '../../context/AuthContext';
import { useAdminUI } from '../../context/AdminUIContext';
import { toast } from 'sonner';

type SearchTrendItem = {
  id: string;
  text_fr: string;
  text_ar: string;
  is_active: boolean;
  sort_order: number;
};

type AnnouncementMessage = {
  id: string;
  text_fr: string;
  text_ar: string;
  color: string;
  text_color: string;
  icon: string;
  priority: number;
  is_active: boolean;
  duration_ms: number;
  start_at: string | null;
  end_at: string | null;
  sort_order: number;
};

type AnnouncementAnimationDirection = 'ltr' | 'rtl';
type AnnouncementAnimationMode = 'auto' | 'manual';
type PreviewDevice = 'desktop' | 'mobile';

type MarketingPreviewMeta = {
  activeMessage: AnnouncementMessage | null;
  effectiveDurationMs: number;
  nextInSeconds: number;
  isPaused: boolean;
  hasRotation: boolean;
};

const TABS = [
  { key: 'about', label: 'À propos', icon: BookOpen, desc: 'Présentation de la marque' },
  { key: 'contact', label: 'Contact', icon: Phone, desc: 'Coordonnees et reseaux' },
  { key: 'faq', label: 'FAQ', icon: HelpCircle, desc: 'Questions frequentes' },
  { key: 'marketing', label: 'Marketing', icon: Megaphone, desc: 'Annonces, recherche et newsletter' },
] as const;

const DEFAULT_NEWSLETTER_POPUP = {
  enabled: true,
  title_fr: 'Bienvenue chez VERKING SCOLAIRE',
  title_ar: 'مرحبا بك في VERKING SCOLAIRE',
  description_fr: 'Recevez nos nouveautes et offres exclusives par email.',
  description_ar: 'توصل بآخر المنتجات والعروض الحصرية عبر البريد الإلكتروني.',
  email_placeholder_fr: 'Votre email',
  email_placeholder_ar: 'بريدك الإلكتروني',
  button_text_fr: "S'abonner",
  button_text_ar: 'اشتراك',
  success_message_fr: 'Merci, votre inscription est confirmee.',
  success_message_ar: 'شكرا، تم تسجيل اشتراكك بنجاح.',
};

const DEFAULT_ANNOUNCEMENT_BAR_COLOR = '#1A3C6E';
const DEFAULT_ANNOUNCEMENT_DURATION_MS = 6000;
const MIN_ANNOUNCEMENT_DURATION_MS = 5000;
const DEFAULT_ANNOUNCEMENT_PRIORITY = 0;
const DEFAULT_ANNOUNCEMENT_ANIMATION_ENABLED = true;
const DEFAULT_ANNOUNCEMENT_ANIMATION_DIRECTION: AnnouncementAnimationDirection = 'rtl';
const DEFAULT_ANNOUNCEMENT_ANIMATION_MODE: AnnouncementAnimationMode = 'auto';
const DEFAULT_ANNOUNCEMENT_ENGINE_ENABLED = true;
const DEFAULT_ANNOUNCEMENT_RADIUS_PX = 12;
const MIN_ANNOUNCEMENT_RADIUS_PX = 0;
const MAX_ANNOUNCEMENT_RADIUS_PX = 24;
const DEFAULT_ANNOUNCEMENT_SPEED_SECONDS = 50;
const MIN_ANNOUNCEMENT_SPEED_SECONDS = 5;
const MAX_ANNOUNCEMENT_SPEED_SECONDS = 120;
const DEFAULT_ANNOUNCEMENT_LOOP_INFINITE = true;
const DEFAULT_ANNOUNCEMENT_PAUSE_ON_HOVER = true;
const DEFAULT_ANNOUNCEMENT_RESUME_AUTO = true;
const DEFAULT_ANNOUNCEMENT_MULTI_MESSAGES = true;
const DEFAULT_ANNOUNCEMENT_GLOBAL_ICON = '';
const DEFAULT_ANNOUNCEMENT_GLOBAL_PRIORITY = 1;
const DEFAULT_CATEGORIES_MARQUEE_ENABLED = false;
const DEFAULT_CATEGORIES_MARQUEE_TEXT_FR = '';
const DEFAULT_CATEGORIES_MARQUEE_TEXT_AR = '';
const DEFAULT_CATEGORIES_MARQUEE_ICON = '';
const PREVIEW_DEFAULT_COUNTDOWN_SECONDS = 3.2;
const CONTENT_UPDATED_KEY = 'vk_content_updated_at';
const PREVIEW_TRANSITION_MS = 320;

function scoreCorruption(value: string) {
  const mojibakeMatches = value.match(/[\u00C3\u00D8\u00D9\u00C2\u00F0\u0178]/g) || [];
  const replacementMatches = value.match(/\uFFFD/g) || [];
  return (mojibakeMatches.length * 2) + (replacementMatches.length * 4);
}

function decodeLatin1AsUtf8(value: string) {
  const codePoints = Array.from(value).map((char) => char.codePointAt(0) ?? 0);
  if (codePoints.some((code) => code > 255)) return value;
  return new TextDecoder().decode(Uint8Array.from(codePoints));
}

function repairLikelyMojibake(value: string) {
  if (!/[\u00C3\u00D8\u00D9\u00C2\u00F0\u0178\uFFFD]/.test(value)) return value;

  try {
    const repaired = decodeLatin1AsUtf8(value);
    if (!repaired || repaired === value) return value;
    return scoreCorruption(repaired) < scoreCorruption(value) ? repaired : value;
  } catch {
    return value;
  }
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return '';

  let normalized = repairLikelyMojibake(value)
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n');

  try {
    normalized = normalized.normalize('NFC');
  } catch {
    // Ignore environments without Unicode normalization support.
  }

  return normalized.trim();
}

function normalizeIsoDate(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const local = new Date(parsed.getTime() - (parsed.getTimezoneOffset() * 60000));
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value: string) {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function createSearchTrendItem(): SearchTrendItem {
  return {
    id: `mk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text_fr: '',
    text_ar: '',
    is_active: true,
    sort_order: 0,
  };
}

function createAnnouncementMessage(defaults?: {
  icon?: string;
  priority?: number;
  start_at?: string | null;
  end_at?: string | null;
  duration_ms?: number;
}): AnnouncementMessage {
  const safeDuration = normalizeBoundedInteger(
    defaults?.duration_ms,
    DEFAULT_ANNOUNCEMENT_DURATION_MS,
    MIN_ANNOUNCEMENT_DURATION_MS,
    120000,
  );
  return {
    id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text_fr: '',
    text_ar: '',
    color: '',
    text_color: '',
    icon: normalizeText(defaults?.icon),
    priority: Number.isFinite(Number(defaults?.priority))
      ? Math.trunc(Number(defaults?.priority))
      : DEFAULT_ANNOUNCEMENT_PRIORITY,
    is_active: true,
    duration_ms: safeDuration,
    start_at: normalizeIsoDate(defaults?.start_at),
    end_at: normalizeIsoDate(defaults?.end_at),
    sort_order: 0,
  };
}

function normalizeSearchTrending(list: any): SearchTrendItem[] {
  if (!Array.isArray(list)) return [];

  return list
    .map((item, index) => ({
      id: item?.id || `mk-${Date.now()}-${index}`,
      text_fr: normalizeText(item?.text_fr),
      text_ar: normalizeText(item?.text_ar),
      is_active: item?.is_active !== false,
      sort_order: Number.isFinite(Number(item?.sort_order)) ? Number(item.sort_order) : index,
    }))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item, index) => ({ ...item, sort_order: index }));
}

function normalizeHexColor(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  const raw = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) {
    return `#${raw.toUpperCase()}`;
  }
  return fallback;
}

function normalizeOptionalHexColor(value: unknown) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const raw = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) {
    return `#${raw.toUpperCase()}`;
  }
  return '';
}

function normalizeDraftHexColor(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase();
}

function isValidHexColor(value: unknown) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const raw = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  return /^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw);
}

function isValidCtaLink(value: unknown) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return trimmed.startsWith('/') || /^https?:\/\//i.test(trimmed);
}

function normalizeAnimationDirection(
  value: unknown,
  fallback: AnnouncementAnimationDirection = DEFAULT_ANNOUNCEMENT_ANIMATION_DIRECTION,
): AnnouncementAnimationDirection {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'ltr' || normalized === 'rtl') return normalized;
  return fallback;
}

function normalizeAnimationMode(
  value: unknown,
  fallback: AnnouncementAnimationMode = DEFAULT_ANNOUNCEMENT_ANIMATION_MODE,
): AnnouncementAnimationMode {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'auto' || normalized === 'manual') return normalized;
  return fallback;
}

function normalizeBoundedNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeBoundedInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  return Math.trunc(normalizeBoundedNumber(value, fallback, min, max));
}

function normalizeAnnouncementMessages(list: any): AnnouncementMessage[] {
  if (!Array.isArray(list)) return [];

  return list
    .map((item, index) => {
      const priorityValue = Number(item?.priority);
      const durationValue = Number(item?.duration_ms);

      return {
        id: item?.id || `ann-${Date.now()}-${index}`,
        text_fr: normalizeText(item?.text_fr),
        text_ar: normalizeText(item?.text_ar),
        color: normalizeOptionalHexColor(item?.color),
        text_color: normalizeOptionalHexColor(item?.text_color),
        icon: normalizeText(item?.icon),
        priority: Number.isFinite(priorityValue) ? Math.trunc(priorityValue) : DEFAULT_ANNOUNCEMENT_PRIORITY,
        is_active: item?.is_active !== false,
        duration_ms: Number.isFinite(durationValue) && durationValue > 0
          ? Math.max(MIN_ANNOUNCEMENT_DURATION_MS, Math.trunc(durationValue))
          : DEFAULT_ANNOUNCEMENT_DURATION_MS,
        start_at: normalizeIsoDate(item?.start_at ?? item?.startAt),
        end_at: normalizeIsoDate(item?.end_at ?? item?.endAt),
        sort_order: Number.isFinite(Number(item?.sort_order)) ? Number(item.sort_order) : index,
      };
    })
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.sort_order - b.sort_order;
    })
    .map((item, index) => ({ ...item, sort_order: index }));
}

function normalizeAnnouncementMessagesForEditor(list: any): AnnouncementMessage[] {
  if (!Array.isArray(list)) return [];

  return list
    .map((item, index) => {
      const priorityValue = Number(item?.priority);
      const durationValue = Number(item?.duration_ms);

      return {
        id: item?.id || `ann-${Date.now()}-${index}`,
        text_fr: normalizeText(item?.text_fr),
        text_ar: normalizeText(item?.text_ar),
        color: normalizeDraftHexColor(item?.color),
        text_color: normalizeDraftHexColor(item?.text_color),
        icon: normalizeText(item?.icon),
        priority: Number.isFinite(priorityValue) ? Math.trunc(priorityValue) : DEFAULT_ANNOUNCEMENT_PRIORITY,
        is_active: item?.is_active !== false,
        duration_ms: Number.isFinite(durationValue) && durationValue > 0
          ? Math.max(MIN_ANNOUNCEMENT_DURATION_MS, Math.trunc(durationValue))
          : DEFAULT_ANNOUNCEMENT_DURATION_MS,
        start_at: normalizeIsoDate(item?.start_at ?? item?.startAt),
        end_at: normalizeIsoDate(item?.end_at ?? item?.endAt),
        sort_order: Number.isFinite(Number(item?.sort_order)) ? Number(item.sort_order) : index,
      };
    })
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.sort_order - b.sort_order;
    })
    .map((item, index) => ({ ...item, sort_order: index }));
}

function normalizeContentPayload(raw: any) {
  const source = raw || {};
  const animationEnabled = source.animation_enabled !== false;
  const animationDirection = normalizeAnimationDirection(
    source.animation_direction,
    DEFAULT_ANNOUNCEMENT_ANIMATION_DIRECTION,
  );
  const animationMode = normalizeAnimationMode(
    source.animation_mode,
    DEFAULT_ANNOUNCEMENT_ANIMATION_MODE,
  );
  const categoriesStrip = normalizeCategoriesStrip(source);

  return {
    ...source,
    faq: Array.isArray(source.faq) ? source.faq : [],
    announcement_messages: normalizeAnnouncementMessages(source.announcement_messages),
    announcement_bar_color: normalizeHexColor(
      source.announcement_bar_color,
      DEFAULT_ANNOUNCEMENT_BAR_COLOR,
    ),
    animation_enabled: animationEnabled,
    animation_direction: animationDirection,
    animation_mode: animationMode,
    announcement_engine_enabled: source.announcement_engine_enabled !== false,
    announcement_radius_px: normalizeBoundedInteger(
      source.announcement_radius_px,
      DEFAULT_ANNOUNCEMENT_RADIUS_PX,
      MIN_ANNOUNCEMENT_RADIUS_PX,
      MAX_ANNOUNCEMENT_RADIUS_PX,
    ),
    announcement_speed_seconds: normalizeBoundedInteger(
      source.announcement_speed_seconds,
      DEFAULT_ANNOUNCEMENT_SPEED_SECONDS,
      MIN_ANNOUNCEMENT_SPEED_SECONDS,
      MAX_ANNOUNCEMENT_SPEED_SECONDS,
    ),
    announcement_loop_infinite: source.announcement_loop_infinite !== false,
    announcement_pause_on_hover: source.announcement_pause_on_hover !== false,
    announcement_resume_auto: source.announcement_resume_auto !== false,
    announcement_multi_messages: source.announcement_multi_messages !== false,
    announcement_global_icon: normalizeText(source.announcement_global_icon),
    announcement_global_priority: Number.isFinite(Number(source.announcement_global_priority))
      ? Math.trunc(Number(source.announcement_global_priority))
      : DEFAULT_ANNOUNCEMENT_GLOBAL_PRIORITY,
    announcement_global_start_at: normalizeIsoDate(source.announcement_global_start_at),
    announcement_global_end_at: normalizeIsoDate(source.announcement_global_end_at),
    search_trending: normalizeSearchTrending(source.search_trending),
    categories_strip_enabled: categoriesStrip.enabled,
    categories_strip_title_fr: categoriesStrip.title_fr,
    categories_strip_title_ar: categoriesStrip.title_ar,
    categories_strip_subtitle_fr: categoriesStrip.subtitle_fr,
    categories_strip_subtitle_ar: categoriesStrip.subtitle_ar,
    categories_strip_icon: categoriesStrip.icon,
    categories_strip_bg_color: categoriesStrip.background_color,
    categories_strip_text_color: categoriesStrip.text_color,
    categories_strip_cta_fr: categoriesStrip.cta_fr,
    categories_strip_cta_ar: categoriesStrip.cta_ar,
    categories_strip_cta_link: categoriesStrip.cta_link,
    categories_marquee_enabled: source.categories_marquee_enabled === true,
    categories_marquee_text_fr: normalizeText(
      source.categories_marquee_text_fr ?? DEFAULT_CATEGORIES_MARQUEE_TEXT_FR,
    ),
    categories_marquee_text_ar: normalizeText(
      source.categories_marquee_text_ar ?? DEFAULT_CATEGORIES_MARQUEE_TEXT_AR,
    ),
    categories_marquee_icon: normalizeText(
      source.categories_marquee_icon ?? DEFAULT_CATEGORIES_MARQUEE_ICON,
    ),
    newsletter_popup: {
      ...DEFAULT_NEWSLETTER_POPUP,
      ...(source.newsletter_popup || {}),
      enabled: source.newsletter_popup?.enabled !== false,
      title_fr: normalizeText(source.newsletter_popup?.title_fr ?? DEFAULT_NEWSLETTER_POPUP.title_fr),
      title_ar: normalizeText(source.newsletter_popup?.title_ar ?? DEFAULT_NEWSLETTER_POPUP.title_ar),
      description_fr: normalizeText(source.newsletter_popup?.description_fr ?? DEFAULT_NEWSLETTER_POPUP.description_fr),
      description_ar: normalizeText(source.newsletter_popup?.description_ar ?? DEFAULT_NEWSLETTER_POPUP.description_ar),
      email_placeholder_fr: normalizeText(source.newsletter_popup?.email_placeholder_fr ?? DEFAULT_NEWSLETTER_POPUP.email_placeholder_fr),
      email_placeholder_ar: normalizeText(source.newsletter_popup?.email_placeholder_ar ?? DEFAULT_NEWSLETTER_POPUP.email_placeholder_ar),
      button_text_fr: normalizeText(source.newsletter_popup?.button_text_fr ?? DEFAULT_NEWSLETTER_POPUP.button_text_fr),
      button_text_ar: normalizeText(source.newsletter_popup?.button_text_ar ?? DEFAULT_NEWSLETTER_POPUP.button_text_ar),
      success_message_fr: normalizeText(source.newsletter_popup?.success_message_fr ?? DEFAULT_NEWSLETTER_POPUP.success_message_fr),
      success_message_ar: normalizeText(source.newsletter_popup?.success_message_ar ?? DEFAULT_NEWSLETTER_POPUP.success_message_ar),
    },
  };
}

function Tooltip({ children, label }: { children: React.ReactNode; label: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-[10px] font-semibold rounded-lg whitespace-nowrap z-50 pointer-events-none shadow-xl max-w-[240px] text-center">
          {label}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  const { t } = useAdminUI();
  const count = value.length;
  const isOver = count > max;
  return (
    <span className={`text-[10px] font-bold ${isOver ? 'text-red-500' : t.textMuted}`}>
      {count}/{max}
    </span>
  );
}

function TextareaField({
  label, value, onChange, rows = 4, dir, maxLength, placeholder,
  lang,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  dir?: string;
  lang?: string;
  maxLength?: number;
  placeholder?: string;
}) {
  const { t } = useAdminUI();
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className={`text-xs font-bold uppercase tracking-wide ${t.textMuted}`}>{label}</label>
        {maxLength && <CharCount value={value} max={maxLength} />}
      </div>
      <textarea
        rows={rows}
        dir={dir}
        lang={lang}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        style={{ unicodeBidi: 'plaintext' }}
        className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 resize-none transition-colors ${t.input}`}
      />
    </div>
  );
}

function InputField({
  label, value, onChange, placeholder, icon: Icon, tooltip, dir, lang, type = 'text', min, max, step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ElementType;
  tooltip?: string;
  dir?: string;
  lang?: string;
  type?: React.HTMLInputTypeAttribute;
  min?: number | string;
  max?: number | string;
  step?: number | string;
}) {
  const { t } = useAdminUI();
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <label className={`text-xs font-bold uppercase tracking-wide ${t.textMuted}`}>{label}</label>
        {tooltip && (
          <Tooltip label={tooltip}>
            <Info size={11} className={`${t.textMuted} cursor-help`} />
          </Tooltip>
        )}
      </div>
      <div className="relative">
        {Icon && <Icon size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} />}
        <input
          type={type}
          dir={dir}
          lang={lang}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          style={{ unicodeBidi: 'plaintext' }}
          className={`w-full ${Icon ? 'pl-9' : 'pl-4'} pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-colors ${t.input}`}
        />
      </div>
    </div>
  );
}

function listItemCountLabel(count: number) {
  return `${count} element(s)`;
}

function pickAnnouncementText(item: AnnouncementMessage, lang: 'fr' | 'ar') {
  const primary = lang === 'ar' ? item.text_ar : item.text_fr;
  const fallback = lang === 'ar' ? item.text_fr : item.text_ar;
  return normalizeText(primary) || normalizeText(fallback);
}

function isAnnouncementScheduledNow(item: AnnouncementMessage, now: number) {
  const start = item.start_at ? Date.parse(item.start_at) : Number.NaN;
  const end = item.end_at ? Date.parse(item.end_at) : Number.NaN;
  if (Number.isFinite(start) && now < start) return false;
  if (Number.isFinite(end) && now > end) return false;
  return true;
}

function buildPreviewTone(backgroundColor: string, textColor?: string) {
  if (textColor) {
    return {
      textColor,
      borderColor: 'rgba(255,255,255,0.18)',
      chipBackground: 'rgba(255,255,255,0.12)',
      chipBorder: 'rgba(255,255,255,0.18)',
      separatorColor: 'rgba(255,255,255,0.28)',
      textShadow: 'none',
    };
  }

  const raw = backgroundColor.replace('#', '');
  const hex = raw.length === 3 ? raw.split('').map((char) => `${char}${char}`).join('') : raw;
  const parsed = Number.parseInt(hex, 16);
  if (!Number.isFinite(parsed)) {
    return {
      textColor: '#FFFFFF',
      borderColor: 'rgba(255,255,255,0.18)',
      chipBackground: 'rgba(255,255,255,0.12)',
      chipBorder: 'rgba(255,255,255,0.18)',
      separatorColor: 'rgba(255,255,255,0.28)',
      textShadow: '0 1px 1px rgba(0,0,0,0.18)',
    };
  }

  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const useDarkText = luminance >= 0.72;

  return {
    textColor: useDarkText ? '#0F172A' : '#FFFFFF',
    borderColor: useDarkText ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.18)',
    chipBackground: useDarkText ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.10)',
    chipBorder: useDarkText ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.20)',
    separatorColor: useDarkText ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.28)',
    textShadow: useDarkText ? 'none' : '0 1px 1px rgba(0,0,0,0.18)',
  };
}

function validateAnnouncementMessagesForSave(messages: AnnouncementMessage[]) {
  const errors: string[] = [];

  messages.forEach((item, index) => {
    const label = `Message #${index + 1}`;
    const textFr = normalizeText(item.text_fr);
    const textAr = normalizeText(item.text_ar);
    const start = item.start_at ? Date.parse(item.start_at) : Number.NaN;
    const end = item.end_at ? Date.parse(item.end_at) : Number.NaN;

    if (item.is_active && !textFr && !textAr) {
      errors.push(`${label}: active message must contain FR or AR text.`);
    }

    if (item.color.trim() && !isValidHexColor(item.color)) {
      errors.push(`${label}: background color must be HEX (#RGB or #RRGGBB).`);
    }

    if (item.text_color.trim() && !isValidHexColor(item.text_color)) {
      errors.push(`${label}: text color must be HEX (#RGB or #RRGGBB).`);
    }

    if (!Number.isFinite(item.duration_ms) || item.duration_ms < MIN_ANNOUNCEMENT_DURATION_MS) {
      errors.push(`${label}: duration must be at least ${MIN_ANNOUNCEMENT_DURATION_MS} ms.`);
    }

    if (Number.isFinite(start) && Number.isFinite(end) && start > end) {
      errors.push(`${label}: start date must be before end date.`);
    }
  });

  return errors;
}

function AnnouncementBarLivePreview({
  messages,
  fallbackBarColor,
  animationEnabled,
  animationDirection,
  animationMode,
  isDark,
  engineEnabled,
  radiusPx,
  speedSeconds,
  loopInfinite,
  pauseOnHover,
  resumeAuto,
  multiMessages,
  previewDevice,
  globalIcon,
  onMetaChange,
}: {
  messages: AnnouncementMessage[];
  fallbackBarColor: string;
  animationEnabled: boolean;
  animationDirection: AnnouncementAnimationDirection;
  animationMode: AnnouncementAnimationMode;
  isDark: boolean;
  engineEnabled: boolean;
  radiusPx: number;
  speedSeconds: number;
  loopInfinite: boolean;
  pauseOnHover: boolean;
  resumeAuto: boolean;
  multiMessages: boolean;
  previewDevice: PreviewDevice;
  globalIcon: string;
  onMetaChange?: (meta: MarketingPreviewMeta) => void;
}) {
  const [isHovering, setIsHovering] = useState(false);
  const [hoverLocked, setHoverLocked] = useState(false);
  const [cycleStartedAt, setCycleStartedAt] = useState<number>(Date.now());
  const [nowTick, setNowTick] = useState<number>(Date.now());

  const eligibleMessages = useMemo(() => {
    const now = Date.now();
    return messages
      .filter((item) => item.is_active && isAnnouncementScheduledNow(item, now))
      .filter((item) => {
        const hasArabic = pickAnnouncementText(item, 'ar').length > 0;
        const hasFrench = pickAnnouncementText(item, 'fr').length > 0;
        return hasArabic || hasFrench;
      });
  }, [messages]);

  const activeMessages = useMemo(() => {
    if (!multiMessages && eligibleMessages.length > 0) return [eligibleMessages[0]];
    return eligibleMessages;
  }, [eligibleMessages, multiMessages]);

  const currentMessage = activeMessages[0] || null;
  const effectiveDurationMs = Math.max(
    MIN_ANNOUNCEMENT_DURATION_MS,
    Math.trunc(speedSeconds * 1000),
  );
  const canRotate = (
    engineEnabled
    && animationEnabled
    && animationMode === 'auto'
    && activeMessages.length > 0
  );
  const isPaused = !engineEnabled || !animationEnabled || (pauseOnHover && (isHovering || hoverLocked));
  const shouldRotate = canRotate && !isPaused;

  useEffect(() => {
    setCycleStartedAt(Date.now());
  }, [activeMessages.length, animationEnabled, animationMode, engineEnabled, loopInfinite, speedSeconds]);

  useEffect(() => {
    if (!pauseOnHover) {
      setIsHovering(false);
      setHoverLocked(false);
    }
  }, [pauseOnHover]);

  useEffect(() => {
    if (!animationEnabled && hoverLocked) {
      setHoverLocked(false);
    }
  }, [animationEnabled, hoverLocked]);

  useEffect(() => {
    if (animationEnabled && resumeAuto && hoverLocked) {
      setHoverLocked(false);
    }
  }, [animationEnabled, resumeAuto, hoverLocked]);

  useEffect(() => {
    if (!canRotate || isPaused) return undefined;
    const timer = window.setInterval(() => setNowTick(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [canRotate, isPaused]);

  const nextInSeconds = useMemo(() => {
    if (!canRotate) return PREVIEW_DEFAULT_COUNTDOWN_SECONDS;
    const elapsed = Math.max(0, nowTick - cycleStartedAt);
    if (!loopInfinite && elapsed >= effectiveDurationMs) return 0;
    const remaining = Math.max(0, effectiveDurationMs - (elapsed % effectiveDurationMs));
    return remaining / 1000;
  }, [canRotate, nowTick, cycleStartedAt, effectiveDurationMs, loopInfinite]);

  useEffect(() => {
    if (!onMetaChange) return;
    onMetaChange({
      activeMessage: currentMessage,
      effectiveDurationMs,
      nextInSeconds,
      isPaused,
      hasRotation: canRotate,
    });
  }, [onMetaChange, currentMessage, effectiveDurationMs, nextInSeconds, isPaused, canRotate]);

  return (
    <div className="space-y-3">
      {!currentMessage ? (
        <div className={`rounded-xl border p-3 text-xs ${isDark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
          Aucune annonce active a previsualiser.
        </div>
      ) : (() => {
        const rounded = normalizeBoundedInteger(
          radiusPx,
          DEFAULT_ANNOUNCEMENT_RADIUS_PX,
          MIN_ANNOUNCEMENT_RADIUS_PX,
          MAX_ANNOUNCEMENT_RADIUS_PX,
        );
        const renderPreviewTickerItem = (item: AnnouncementMessage, key: string) => {
          const frText = normalizeText(item.text_fr);
          const arText = normalizeText(item.text_ar);
          const hasFrench = frText.length > 0;
          const hasArabic = arText.length > 0;
          const text = [frText, arText].filter(Boolean).join(' • ');
          const chipColor = normalizeHexColor(item.color, fallbackBarColor);
          const tone = buildPreviewTone(chipColor, normalizeOptionalHexColor(item.text_color) || undefined);
          const icon = normalizeText(item.icon) || normalizeText(globalIcon);

          return (
            <div
              key={key}
              className="flex shrink-0 items-center gap-3 px-3 py-1.5"
              style={{
                backgroundColor: 'rgba(255,255,255,0.14)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: '#FFFFFF',
                borderRadius: rounded,
                boxShadow: '0 12px 34px rgba(15,23,42,0.14)',
                backdropFilter: 'blur(10px)',
              }}
            >
              {icon ? (
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] leading-none"
                  style={{
                    backgroundColor: chipColor,
                    color: tone.textColor,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
                  }}
                >
                  {icon}
                </span>
              ) : null}
              {icon ? <span className="h-4 w-px shrink-0 rounded-full bg-white/18" /> : null}

              <div className="flex shrink-0 items-center gap-3 whitespace-nowrap">
                {hasFrench ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="rounded-full border border-white/16 bg-white/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-white/72">
                      FR
                    </span>
                    <span className="text-[13px] font-semibold leading-none tracking-[0.01em] text-white md:text-sm" lang="fr" title={frText}>
                      {frText}
                    </span>
                  </span>
                ) : null}

                {hasFrench && hasArabic ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-white/36" aria-hidden />
                ) : null}

                {hasArabic ? (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="text-[13px] font-semibold leading-none tracking-[0.01em] text-white md:text-sm"
                      dir="rtl"
                      lang="ar"
                      style={{ unicodeBidi: 'plaintext', textShadow: tone.textShadow }}
                      title={arText}
                    >
                      {arText}
                    </span>
                    <span className="rounded-full border border-white/16 bg-white/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-white/72">
                      AR
                    </span>
                  </span>
                ) : null}
              </div>
            </div>
          );
        };

        return (
          <div
            className={`${previewDevice === 'mobile' ? 'mx-auto max-w-[280px]' : ''} h-11 border overflow-hidden relative`}
            style={{
              backgroundColor: fallbackBarColor,
              borderColor: 'rgba(255,255,255,0.16)',
              color: '#FFFFFF',
              borderRadius: rounded,
            }}
            onMouseEnter={() => {
              if (!pauseOnHover) return;
              setIsHovering(true);
              if (!resumeAuto) setHoverLocked(true);
            }}
            onMouseLeave={() => {
              if (!pauseOnHover) return;
              setIsHovering(false);
              if (resumeAuto) setHoverLocked(false);
            }}
          >
            <style>
              {`
                @keyframes vk-admin-announcement-marquee-rtl {
                  from { transform: translate3d(0, 0, 0); }
                  to { transform: translate3d(-50%, 0, 0); }
                }

                @keyframes vk-admin-announcement-marquee-ltr {
                  from { transform: translate3d(-50%, 0, 0); }
                  to { transform: translate3d(0, 0, 0); }
                }
              `}
            </style>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `
                  radial-gradient(circle at 14% 50%, rgba(255,255,255,0.12) 0%, transparent 18%),
                  radial-gradient(circle at 82% 50%, rgba(255,255,255,0.08) 0%, transparent 20%),
                  linear-gradient(90deg, rgba(255,255,255,0.08) 0%, transparent 22%, transparent 78%, rgba(255,255,255,0.05) 100%)
                `,
              }}
            />
            <div className="absolute inset-y-0 left-0 z-20 flex items-center pl-2" aria-hidden>
              <div
                className="relative flex items-center gap-1.5 overflow-hidden rounded-xl border border-white/16 px-2 py-1 shadow-[0_12px_28px_rgba(15,23,42,0.18)]"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)',
                  backdropFilter: 'blur(14px)',
                }}
              >
                <span className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.22)_48%,transparent_100%)] opacity-60" />
                <span className="relative flex h-2 w-2 items-center justify-center">
                  <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-[#FACC15]/70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FACC15]" />
                </span>
                <span className="relative text-[8px] font-black uppercase tracking-[0.22em] text-white/72">News</span>
                <span className="relative rounded-full bg-white/14 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-white">
                  Live
                </span>
              </div>
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 left-[68px] z-20 w-8"
              style={{ background: `linear-gradient(to right, ${fallbackBarColor} 0%, transparent 100%)` }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-20 w-8"
              style={{ background: `linear-gradient(to left, ${fallbackBarColor} 0%, transparent 100%)` }}
              aria-hidden
            />
            <div
              className="relative z-10 flex h-full items-center overflow-hidden pl-[76px] pr-3"
              style={{
                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
                maskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
              }}
            >
              {canRotate ? (
                <div
                  className="flex w-max min-w-full shrink-0 items-center gap-8"
                  style={{
                    animationName: animationDirection === 'rtl'
                      ? 'vk-admin-announcement-marquee-rtl'
                      : 'vk-admin-announcement-marquee-ltr',
                    animationDuration: `${effectiveDurationMs / 1000}s`,
                    animationTimingFunction: 'linear',
                    animationIterationCount: loopInfinite ? 'infinite' : 1,
                    animationFillMode: 'forwards',
                    animationPlayState: isPaused ? 'paused' : 'running',
                    willChange: 'transform',
                  }}
                >
                  {[0, 1].map((copyIndex) => (
                    <div key={`copy-${copyIndex}`} className="flex shrink-0 items-center gap-8 pr-8">
                      {activeMessages.map((item, itemIndex) => renderPreviewTickerItem(item, `${copyIndex}-${item.id}-${itemIndex}`))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mx-auto flex h-full items-center justify-center">
                  {renderPreviewTickerItem(currentMessage, `static-${currentMessage.id}`)}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export function AdminContent() {
  const { token, admin } = useAuth();
  const { t, isDark } = useAdminUI();
  const [content, setContent] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<'about' | 'contact' | 'faq' | 'marketing'>('about');
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop');
  const [expandedAnnouncementId, setExpandedAnnouncementId] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<MarketingPreviewMeta>({
    activeMessage: null,
    effectiveDurationMs: DEFAULT_ANNOUNCEMENT_SPEED_SECONDS * 1000,
    nextInSeconds: PREVIEW_DEFAULT_COUNTDOWN_SECONDS,
    isPaused: false,
    hasRotation: false,
  });

  useEffect(() => {
    api.get('/content')
      .then((d) => {
        const loaded = d.content || {};
        setContent(normalizeContentPayload(loaded));
        setIsDirty(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const set = (key: string, val: any) => {
    setIsDirty(true);
    setContent((p: any) => ({ ...p, [key]: val }));
  };

  const handleSave = async () => {
    if (!token) return;

    const editorMessages = normalizeAnnouncementMessagesForEditor(content.announcement_messages);
    const errors = validateAnnouncementMessagesForSave(editorMessages);
    const globalBarColorInput = typeof content.announcement_bar_color === 'string'
      ? content.announcement_bar_color.trim()
      : '';
    const categoriesStripBgInput = typeof content.categories_strip_bg_color === 'string'
      ? content.categories_strip_bg_color.trim()
      : '';
    const categoriesStripTextInput = typeof content.categories_strip_text_color === 'string'
      ? content.categories_strip_text_color.trim()
      : '';
    const categoriesStripCtaLinkInput = typeof content.categories_strip_cta_link === 'string'
      ? content.categories_strip_cta_link.trim()
      : '';
    const categoriesMarqueeTextFrInput = normalizeText(content.categories_marquee_text_fr);
    const categoriesMarqueeTextArInput = normalizeText(content.categories_marquee_text_ar);

    if (globalBarColorInput && !isValidHexColor(globalBarColorInput)) {
      errors.push('Global announcement bar color must be HEX (#RGB or #RRGGBB).');
    }
    if (categoriesStripBgInput && !isValidHexColor(categoriesStripBgInput)) {
      errors.push('Categories strip background color must be HEX (#RGB or #RRGGBB).');
    }
    if (categoriesStripTextInput && !isValidHexColor(categoriesStripTextInput)) {
      errors.push('Categories strip text color must be HEX (#RGB or #RRGGBB).');
    }
    if (categoriesStripCtaLinkInput && !isValidCtaLink(categoriesStripCtaLinkInput)) {
      errors.push('Categories strip CTA link must start with / or http(s)://');
    }
    if (
      content.categories_marquee_enabled === true
      && !categoriesMarqueeTextFrInput
      && !categoriesMarqueeTextArInput
    ) {
      errors.push('Ticker PRO: ajoutez au moins un texte FR ou AR.');
    }

    const globalPriority = Number(content.announcement_global_priority);
    if (Number.isFinite(globalPriority) && globalPriority < 0) {
      errors.push('Global priority must be 0 or higher.');
    }

    const globalStart = content.announcement_global_start_at ? Date.parse(content.announcement_global_start_at) : Number.NaN;
    const globalEnd = content.announcement_global_end_at ? Date.parse(content.announcement_global_end_at) : Number.NaN;
    if (Number.isFinite(globalStart) && Number.isFinite(globalEnd) && globalStart > globalEnd) {
      errors.push('Global display rule: start date must be before end date.');
    }

    if (errors.length > 0) {
      toast.error(errors[0]);
      if (errors.length > 1) {
        toast.error(`${errors.length - 1} more validation error(s) detected.`);
      }
      return;
    }

    setSaving(true);
    try {
      const payload = normalizeContentPayload(content);
      await adminApi.put('/content', payload, token);
      setContent(payload);
      setIsDirty(false);
      try {
        localStorage.setItem(CONTENT_UPDATED_KEY, String(Date.now()));
      } catch {
        // Ignore cross-tab sync storage errors in restricted environments.
      }
      toast.success('Contenu mis a jour');
    } catch (e) {
      toast.error(`Erreur: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const addFaq = () => set('faq', [...(content.faq || []), { q_fr: '', q_ar: '', a_fr: '', a_ar: '' }]);
  const removeFaq = (i: number) => set('faq', (content.faq || []).filter((_: any, idx: number) => idx !== i));
  const updateFaq = (i: number, key: string, value: string) => set(
    'faq',
    (content.faq || []).map((f: any, idx: number) => (idx === i ? { ...f, [key]: value } : f)),
  );
  const moveFaq = (i: number, direction: 'up' | 'down') => {
    const arr = [...(content.faq || [])];
    const nextIndex = direction === 'up' ? i - 1 : i + 1;
    if (nextIndex < 0 || nextIndex >= arr.length) return;
    [arr[i], arr[nextIndex]] = [arr[nextIndex], arr[i]];
    set('faq', arr);
  };

  const updateSearchTrending = (updater: (items: SearchTrendItem[]) => SearchTrendItem[]) => {
    const current = normalizeSearchTrending(content.search_trending);
    const next = updater(current).map((item, index) => ({ ...item, sort_order: index }));
    set('search_trending', next);
  };

  const addSearchTrend = () => {
    updateSearchTrending((items) => [...items, { ...createSearchTrendItem(), sort_order: items.length }]);
  };

  const removeSearchTrend = (index: number) => {
    updateSearchTrending((items) => items.filter((_, idx) => idx !== index));
  };

  const moveSearchTrend = (index: number, direction: 'up' | 'down') => {
    updateSearchTrending((items) => {
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= items.length) return items;
      const copied = [...items];
      [copied[index], copied[nextIndex]] = [copied[nextIndex], copied[index]];
      return copied;
    });
  };

  const setSearchTrendField = (index: number, field: keyof SearchTrendItem, value: any) => {
    updateSearchTrending((items) => items.map((item, idx) => (
      idx === index ? { ...item, [field]: value } : item
    )));
  };

  const updateAnnouncements = (updater: (items: AnnouncementMessage[]) => AnnouncementMessage[]) => {
    const current = normalizeAnnouncementMessagesForEditor(content.announcement_messages);
    const next = updater(current).map((item, index) => ({ ...item, sort_order: index }));
    set('announcement_messages', next);
  };

  const addAnnouncement = () => {
    const durationMs = normalizeBoundedInteger(
      content.announcement_speed_seconds,
      DEFAULT_ANNOUNCEMENT_SPEED_SECONDS,
      MIN_ANNOUNCEMENT_SPEED_SECONDS,
      MAX_ANNOUNCEMENT_SPEED_SECONDS,
    ) * 1000;
    updateAnnouncements((items) => [
      ...items,
      {
        ...createAnnouncementMessage({
          icon: content.announcement_global_icon,
          priority: content.announcement_global_priority,
          start_at: content.announcement_global_start_at,
          end_at: content.announcement_global_end_at,
          duration_ms: durationMs,
        }),
        sort_order: items.length,
      },
    ]);
  };

  const removeAnnouncement = (index: number) => {
    updateAnnouncements((items) => items.filter((_, idx) => idx !== index));
  };

  const moveAnnouncement = (index: number, direction: 'up' | 'down') => {
    updateAnnouncements((items) => {
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= items.length) return items;
      const copied = [...items];
      [copied[index], copied[nextIndex]] = [copied[nextIndex], copied[index]];
      return copied;
    });
  };

  const setAnnouncementField = (index: number, field: keyof AnnouncementMessage, value: any) => {
    updateAnnouncements((items) => items.map((item, idx) => (
      idx === index ? { ...item, [field]: value } : item
    )));
  };

  const duplicateAnnouncement = (index: number) => {
    updateAnnouncements((items) => {
      const source = items[index];
      if (!source) return items;
      const duplicated: AnnouncementMessage = {
        ...source,
        id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sort_order: index + 1,
      };
      const copied = [...items];
      copied.splice(index + 1, 0, duplicated);
      return copied;
    });
  };

  const newsletterPopup = useMemo(
    () => ({
      ...DEFAULT_NEWSLETTER_POPUP,
      ...(content.newsletter_popup || {}),
      enabled: content.newsletter_popup?.enabled !== false,
    }),
    [content.newsletter_popup],
  );
  const categoriesStrip = useMemo(() => normalizeCategoriesStrip(content), [content]);
  const categoriesMarqueeEnabled = content.categories_marquee_enabled === true
    ? true
    : DEFAULT_CATEGORIES_MARQUEE_ENABLED;
  const categoriesMarqueeTextFr = normalizeText(
    content.categories_marquee_text_fr ?? DEFAULT_CATEGORIES_MARQUEE_TEXT_FR,
  );
  const categoriesMarqueeTextAr = normalizeText(
    content.categories_marquee_text_ar ?? DEFAULT_CATEGORIES_MARQUEE_TEXT_AR,
  );
  const categoriesMarqueeIcon = normalizeText(
    content.categories_marquee_icon ?? DEFAULT_CATEGORIES_MARQUEE_ICON,
  );

  const setNewsletterField = (field: string, value: any) => {
    set('newsletter_popup', { ...newsletterPopup, [field]: value });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-blue-100 border-t-[#1A3C6E] animate-spin" />
        <p className={`text-sm font-bold ${t.textMuted}`}>Chargement du contenu...</p>
      </div>
    );
  }

  const announcementMessages = normalizeAnnouncementMessagesForEditor(content.announcement_messages);
  const announcementBarColor = normalizeHexColor(content.announcement_bar_color, DEFAULT_ANNOUNCEMENT_BAR_COLOR);
  const announcementAnimationEnabled = content.animation_enabled !== false;
  const announcementAnimationDirection = normalizeAnimationDirection(
    content.animation_direction,
    DEFAULT_ANNOUNCEMENT_ANIMATION_DIRECTION,
  );
  const announcementAnimationMode = normalizeAnimationMode(
    content.animation_mode,
    DEFAULT_ANNOUNCEMENT_ANIMATION_MODE,
  );
  const announcementEngineEnabled = content.announcement_engine_enabled !== false;
  const announcementRadiusPx = normalizeBoundedInteger(
    content.announcement_radius_px,
    DEFAULT_ANNOUNCEMENT_RADIUS_PX,
    MIN_ANNOUNCEMENT_RADIUS_PX,
    MAX_ANNOUNCEMENT_RADIUS_PX,
  );
  const announcementSpeedSeconds = normalizeBoundedInteger(
    content.announcement_speed_seconds,
    DEFAULT_ANNOUNCEMENT_SPEED_SECONDS,
    MIN_ANNOUNCEMENT_SPEED_SECONDS,
    MAX_ANNOUNCEMENT_SPEED_SECONDS,
  );
  const announcementLoopInfinite = content.announcement_loop_infinite !== false;
  const announcementPauseOnHover = content.announcement_pause_on_hover !== false;
  const announcementResumeAuto = content.announcement_resume_auto !== false;
  const announcementMultiMessages = content.announcement_multi_messages !== false;
  const announcementGlobalIcon = normalizeText(content.announcement_global_icon);
  const announcementGlobalPriority = Number.isFinite(Number(content.announcement_global_priority))
    ? Math.trunc(Number(content.announcement_global_priority))
    : DEFAULT_ANNOUNCEMENT_GLOBAL_PRIORITY;
  const announcementGlobalStartAt = normalizeIsoDate(content.announcement_global_start_at);
  const announcementGlobalEndAt = normalizeIsoDate(content.announcement_global_end_at);
  const searchTrending = normalizeSearchTrending(content.search_trending);
  const adminInitials = (admin?.name || admin?.email || 'AD')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() || '')
    .join('') || 'AD';
  const previewActiveMessage = previewMeta.activeMessage;
  const previewPriority = previewActiveMessage?.priority ?? announcementGlobalPriority;
  const previewCountdown = Number.isFinite(previewMeta.nextInSeconds) ? previewMeta.nextInSeconds : PREVIEW_DEFAULT_COUNTDOWN_SECONDS;

  return (
    <div className="space-y-6 w-full max-w-[1360px]">
      <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-5 shadow-sm`}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className={`text-3xl font-black ${t.text} tracking-tight`}>Gestion du contenu</h1>
            <p className={`text-sm ${t.textMuted} mt-1`}>Contenu dynamique du storefront et marketing</p>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-semibold ${t.cardBorder} ${t.textMuted} ${t.rowHover} transition-all`}
            >
              <Eye size={14} /> Voir le site
            </a>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#1A3C6E] hover:bg-[#0d2447] text-white font-bold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-60"
            >
              <Save size={14} /> {saving ? 'Enregistrement...' : 'Enregistrer tout'}
            </button>
            <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${
              isDirty
                ? (isDark ? 'bg-amber-900/40 text-amber-200' : 'bg-amber-100 text-amber-700')
                : (isDark ? 'bg-emerald-900/40 text-emerald-200' : 'bg-emerald-100 text-emerald-700')
            }`}>
              <span className={`w-2 h-2 rounded-full ${isDirty ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              {isDirty ? 'Sync en attente' : 'Synchro OK'}
            </span>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1A3C6E] to-[#2563EB] text-white text-xs font-black flex items-center justify-center shadow-sm">
              {adminInitials || <UserCircle2 size={16} />}
            </div>
          </div>
        </div>

        <div className={`mt-4 flex gap-1 p-1 rounded-2xl border ${t.cardBorder} ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <Tooltip key={tab.key} label={tab.desc}>
                <button
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === tab.key
                      ? 'bg-[#1A3C6E] text-white shadow-md'
                      : `${t.textMuted} ${t.rowHover}`
                  }`}
                >
                  <Icon size={13} /> {tab.label}
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {activeTab === 'about' && (
        <div className="space-y-5">
          <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-6 shadow-sm space-y-4`}>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={16} className="text-[#1A3C6E]" />
              <h2 className={`font-bold ${t.text}`}>Page A propos</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextareaField
                label="Description (FR)"
                rows={6}
                value={content.about_fr || ''}
                onChange={(v) => set('about_fr', v)}
                lang="fr"
                maxLength={2000}
              />
              <TextareaField
                label="الوصف (AR)"
                rows={6}
                dir="rtl"
                lang="ar"
                value={content.about_ar || ''}
                onChange={(v) => set('about_ar', v)}
                maxLength={2000}
              />
            </div>
          </div>

          <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-6 shadow-sm space-y-4`}>
            <div className="flex items-center gap-2 mb-2">
              <Star size={16} className="text-orange-500" />
              <h2 className={`font-bold ${t.text}`}>Valeurs de la marque</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextareaField
                label="Slogan (FR)"
                rows={2}
                value={content.brand_tagline_fr || ''}
                onChange={(v) => set('brand_tagline_fr', v)}
                lang="fr"
                maxLength={160}
              />
              <TextareaField
                label="الشعار (AR)"
                rows={2}
                dir="rtl"
                lang="ar"
                value={content.brand_tagline_ar || ''}
                onChange={(v) => set('brand_tagline_ar', v)}
                maxLength={160}
              />
              <TextareaField
                label="Notre histoire (FR)"
                rows={4}
                value={content.brand_story_fr || ''}
                onChange={(v) => set('brand_story_fr', v)}
                lang="fr"
                maxLength={500}
              />
              <TextareaField
                label="قصتنا (AR)"
                rows={4}
                dir="rtl"
                lang="ar"
                value={content.brand_story_ar || ''}
                onChange={(v) => set('brand_story_ar', v)}
                maxLength={500}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'contact' && (
        <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-6 shadow-sm space-y-5`}>
          <div className="flex items-center gap-2 mb-2">
            <Phone size={16} className="text-green-600" />
            <h2 className={`font-bold ${t.text}`}>Informations de contact</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Adresse" value={content.address || ''} onChange={(v) => set('address', v)} icon={MapPin} />
            <InputField label="Telephone" value={content.phone || ''} onChange={(v) => set('phone', v)} icon={Phone} />
            <InputField label="Email" value={content.email || ''} onChange={(v) => set('email', v)} icon={Mail} />
            <InputField label="WhatsApp" value={content.whatsapp || ''} onChange={(v) => set('whatsapp', v)} icon={MessageSquare} />
            <InputField label="Horaires" value={content.working_hours || ''} onChange={(v) => set('working_hours', v)} icon={Clock} />
            <InputField label="Facebook URL" value={content.facebook || ''} onChange={(v) => set('facebook', v)} icon={Facebook} />
            <InputField label="Instagram URL" value={content.instagram || ''} onChange={(v) => set('instagram', v)} icon={Instagram} />
          </div>
        </div>
      )}

      {activeTab === 'faq' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`font-bold ${t.text}`}>FAQ</h2>
              <p className={`text-xs ${t.textMuted} mt-0.5`}>{(content.faq || []).length} question(s)</p>
            </div>
            <button
              onClick={addFaq}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1A3C6E] text-white font-bold rounded-xl text-sm hover:bg-[#0d2447] transition-colors"
            >
              <Plus size={14} /> Ajouter
            </button>
          </div>

          {(content.faq || []).length === 0 ? (
            <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-14 text-center`}>
              <HelpCircle size={48} className={`mx-auto mb-4 ${t.textMuted} opacity-20`} />
              <p className={`font-bold ${t.text}`}>Aucune FAQ configuree</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(content.faq || []).map((faq: any, i: number) => (
                <div key={i} className={`${t.card} border ${t.cardBorder} rounded-2xl overflow-hidden shadow-sm`}>
                  <div className={`flex items-center justify-between px-5 py-3 border-b ${t.divider} ${isDark ? 'bg-gray-800/50' : 'bg-gray-50/80'}`}>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-[#1A3C6E] text-white text-[10px] font-black flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className={`text-xs font-bold ${t.text} truncate max-w-[220px]`}>
                        {faq.q_fr || 'Nouvelle question...'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => moveFaq(i, 'up')} disabled={i === 0} className={`p-1.5 rounded-lg ${t.rowHover} ${t.textMuted} disabled:opacity-30`}>
                        <ArrowUp size={12} />
                      </button>
                      <button onClick={() => moveFaq(i, 'down')} disabled={i === (content.faq || []).length - 1} className={`p-1.5 rounded-lg ${t.rowHover} ${t.textMuted} disabled:opacity-30`}>
                        <ArrowDown size={12} />
                      </button>
                      <button onClick={() => removeFaq(i)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-bold uppercase tracking-wide ${t.textMuted} mb-1.5`}>Question (FR)</label>
                      <input
                        value={faq.q_fr}
                        onChange={(e) => updateFaq(i, 'q_fr', e.target.value)}
                        lang="fr"
                        style={{ unicodeBidi: 'plaintext' }}
                        className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 ${t.input}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-bold uppercase tracking-wide ${t.textMuted} mb-1.5`}>السؤال (AR)</label>
                      <input
                        value={faq.q_ar}
                        dir="rtl"
                        lang="ar"
                        onChange={(e) => updateFaq(i, 'q_ar', e.target.value)}
                        style={{ unicodeBidi: 'plaintext' }}
                        className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 ${t.input}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-bold uppercase tracking-wide ${t.textMuted} mb-1.5`}>Reponse (FR)</label>
                      <textarea
                        rows={3}
                        value={faq.a_fr}
                        onChange={(e) => updateFaq(i, 'a_fr', e.target.value)}
                        lang="fr"
                        style={{ unicodeBidi: 'plaintext' }}
                        className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 resize-none ${t.input}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-bold uppercase tracking-wide ${t.textMuted} mb-1.5`}>الإجابة (AR)</label>
                      <textarea
                        rows={3}
                        dir="rtl"
                        lang="ar"
                        value={faq.a_ar}
                        onChange={(e) => updateFaq(i, 'a_ar', e.target.value)}
                        style={{ unicodeBidi: 'plaintext' }}
                        className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 resize-none ${t.input}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'marketing' && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
          <div className="space-y-5">
            <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-6 shadow-sm space-y-5`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <h2 className={`text-lg font-black ${t.text}`}>Dynamic announcement engine</h2>
                  <span className={`px-2 py-1 rounded-full text-[11px] font-black ${
                    announcementEngineEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {announcementEngineEnabled ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => set('announcement_engine_enabled', !announcementEngineEnabled)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black ${
                    announcementEngineEnabled
                      ? 'bg-[#1A3C6E] text-white'
                      : (isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700')
                  }`}
                >
                  {announcementEngineEnabled ? <CheckCircle2 size={13} /> : <SlidersHorizontal size={13} />}
                  {announcementEngineEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className={`rounded-2xl border ${t.cardBorder} p-4 space-y-3`}>
                  <p className={`text-sm font-bold ${t.text}`}>Couleur de fond globale</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={announcementBarColor}
                      onChange={(e) => set('announcement_bar_color', e.target.value)}
                      className={`h-10 w-14 rounded-lg border ${t.cardBorder} ${isDark ? 'bg-gray-900' : 'bg-white'} p-1 cursor-pointer`}
                    />
                    <input
                      value={content.announcement_bar_color || ''}
                      onChange={(e) => set('announcement_bar_color', e.target.value)}
                      placeholder="#FF0F0F"
                      style={{ unicodeBidi: 'plaintext' }}
                      className={`flex-1 px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-colors ${t.input}`}
                    />
                  </div>
                </div>

                <div className={`rounded-2xl border ${t.cardBorder} p-4 space-y-3`}>
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-bold ${t.text}`}>Coins arrondis</p>
                    <span className={`text-xs font-black ${t.textMuted}`}>{announcementRadiusPx} px</span>
                  </div>
                  <input
                    type="range"
                    min={MIN_ANNOUNCEMENT_RADIUS_PX}
                    max={MAX_ANNOUNCEMENT_RADIUS_PX}
                    value={announcementRadiusPx}
                    onChange={(e) => set('announcement_radius_px', Number.parseInt(e.target.value, 10))}
                    className="w-full accent-[#1A3C6E]"
                  />
                </div>
              </div>

              <div className={`rounded-2xl border ${t.cardBorder} p-4 space-y-4`}>
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-bold ${t.text}`}>Animation & comportement</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  <div className={`rounded-xl border ${t.cardBorder} p-3 space-y-2`}>
                    <p className={`text-[11px] font-bold uppercase tracking-wide ${t.textMuted}`}>Lecture</p>
                    <div className="inline-flex w-full rounded-lg border border-gray-300 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => set('animation_enabled', true)}
                        className={`flex-1 px-3 py-2 text-xs font-bold inline-flex items-center justify-center gap-1 ${
                          announcementAnimationEnabled ? 'bg-[#1A3C6E] text-white' : `${isDark ? 'bg-gray-900 text-gray-300' : 'bg-white text-gray-700'}`
                        }`}
                      >
                        <Play size={12} /> Play
                      </button>
                      <button
                        type="button"
                        onClick={() => set('animation_enabled', false)}
                        className={`flex-1 px-3 py-2 text-xs font-bold inline-flex items-center justify-center gap-1 ${
                          !announcementAnimationEnabled ? 'bg-[#1A3C6E] text-white' : `${isDark ? 'bg-gray-900 text-gray-300' : 'bg-white text-gray-700'}`
                        }`}
                      >
                        <Pause size={12} /> Pause
                      </button>
                    </div>
                  </div>

                  <div className={`rounded-xl border ${t.cardBorder} p-3 space-y-2`}>
                    <p className={`text-[11px] font-bold uppercase tracking-wide ${t.textMuted}`}>Mode</p>
                    <div className="inline-flex w-full rounded-lg border border-gray-300 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => set('animation_mode', 'auto')}
                        className={`flex-1 px-3 py-2 text-xs font-bold ${
                          announcementAnimationMode === 'auto' ? 'bg-[#1A3C6E] text-white' : `${isDark ? 'bg-gray-900 text-gray-300' : 'bg-white text-gray-700'}`
                        }`}
                      >
                        Auto
                      </button>
                      <button
                        type="button"
                        onClick={() => set('animation_mode', 'manual')}
                        className={`flex-1 px-3 py-2 text-xs font-bold ${
                          announcementAnimationMode === 'manual' ? 'bg-[#1A3C6E] text-white' : `${isDark ? 'bg-gray-900 text-gray-300' : 'bg-white text-gray-700'}`
                        }`}
                      >
                        Manual
                      </button>
                    </div>
                  </div>

                  <div className={`rounded-xl border ${t.cardBorder} p-3 space-y-2`}>
                    <p className={`text-[11px] font-bold uppercase tracking-wide ${t.textMuted}`}>Direction</p>
                    <div className="inline-flex w-full rounded-lg border border-gray-300 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => set('animation_direction', 'ltr')}
                        className={`flex-1 px-3 py-2 text-xs font-bold ${
                          announcementAnimationDirection === 'ltr' ? 'bg-[#1A3C6E] text-white' : `${isDark ? 'bg-gray-900 text-gray-300' : 'bg-white text-gray-700'}`
                        }`}
                      >
                        Gauche → Droite
                      </button>
                      <button
                        type="button"
                        onClick={() => set('animation_direction', 'rtl')}
                        className={`flex-1 px-3 py-2 text-xs font-bold ${
                          announcementAnimationDirection === 'rtl' ? 'bg-[#1A3C6E] text-white' : `${isDark ? 'bg-gray-900 text-gray-300' : 'bg-white text-gray-700'}`
                        }`}
                      >
                        Droite → Gauche
                      </button>
                    </div>
                  </div>

                  <div className={`rounded-xl border ${t.cardBorder} p-3 space-y-2`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-[11px] font-bold uppercase tracking-wide ${t.textMuted}`}>Vitesse</p>
                      <span className={`text-[11px] font-black ${t.textMuted}`}>{announcementSpeedSeconds} s</span>
                    </div>
                    <input
                      type="range"
                      min={MIN_ANNOUNCEMENT_SPEED_SECONDS}
                      max={MAX_ANNOUNCEMENT_SPEED_SECONDS}
                      value={announcementSpeedSeconds}
                      onChange={(e) => set('announcement_speed_seconds', Number.parseInt(e.target.value, 10))}
                      className="w-full accent-[#1A3C6E]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => set('announcement_loop_infinite', !announcementLoopInfinite)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                      announcementLoopInfinite
                        ? 'bg-[#1A3C6E] text-white border-[#1A3C6E]'
                        : `${isDark ? 'bg-gray-900 text-gray-300 border-gray-700' : 'bg-white text-gray-600 border-gray-300'}`
                    }`}
                  >
                    Boucle infinie
                  </button>
                  <button
                    type="button"
                    onClick={() => set('announcement_pause_on_hover', !announcementPauseOnHover)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                      announcementPauseOnHover
                        ? 'bg-[#1A3C6E] text-white border-[#1A3C6E]'
                        : `${isDark ? 'bg-gray-900 text-gray-300 border-gray-700' : 'bg-white text-gray-600 border-gray-300'}`
                    }`}
                  >
                    Pause au survol
                  </button>
                  <button
                    type="button"
                    onClick={() => set('announcement_resume_auto', !announcementResumeAuto)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                      announcementResumeAuto
                        ? 'bg-[#1A3C6E] text-white border-[#1A3C6E]'
                        : `${isDark ? 'bg-gray-900 text-gray-300 border-gray-700' : 'bg-white text-gray-600 border-gray-300'}`
                    }`}
                  >
                    Reprise automatique
                  </button>
                  <button
                    type="button"
                    onClick={() => set('announcement_multi_messages', !announcementMultiMessages)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                      announcementMultiMessages
                        ? 'bg-[#1A3C6E] text-white border-[#1A3C6E]'
                        : `${isDark ? 'bg-gray-900 text-gray-300 border-gray-700' : 'bg-white text-gray-600 border-gray-300'}`
                    }`}
                  >
                    Multi-messages
                  </button>
                </div>
              </div>
            </div>

            <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-6 shadow-sm space-y-4`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className={`text-lg font-black ${t.text}`}>Messages</h3>
                  <p className={`text-xs ${t.textMuted}`}>
                    {listItemCountLabel(announcementMessages.length)} • sorted by priority
                  </p>
                </div>
                <button
                  onClick={addAnnouncement}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1A3C6E] text-white font-bold rounded-xl text-sm hover:bg-[#0d2447] transition-colors"
                >
                  <Plus size={14} /> Ajouter
                </button>
              </div>

              {announcementMessages.length === 0 ? (
                <p className={`text-sm ${t.textMuted}`}>Aucune annonce configuree.</p>
              ) : (
                <div className="space-y-3">
                  {announcementMessages.map((item, index) => {
                    const previewBg = normalizeHexColor(item.color, announcementBarColor);
                    const previewText = normalizeOptionalHexColor(item.text_color) || '';
                    const frLine = pickAnnouncementText(item, 'fr');
                    const arLine = pickAnnouncementText(item, 'ar');
                    const isExpanded = expandedAnnouncementId === item.id;

                    return (
                      <div key={item.id} className={`rounded-2xl border ${t.cardBorder} p-4 shadow-sm space-y-3`}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0 flex items-center gap-3">
                            <span className={`p-2 rounded-lg border ${t.cardBorder} ${t.textMuted}`}>
                              <GripVertical size={14} />
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-lg bg-[#1A3C6E] text-white text-[11px] font-black flex items-center justify-center">
                                {index + 1}
                              </span>
                              <div className="min-w-0">
                                <p className={`text-sm font-semibold ${t.text} truncate`}>
                                  {normalizeText(item.icon) || announcementGlobalIcon || '🛎️'} {frLine || 'Message FR'}
                                </p>
                                <p className={`text-xs ${t.textMuted} truncate`} dir="rtl" lang="ar" style={{ unicodeBidi: 'plaintext' }}>
                                  {arLine || 'رسالة AR'}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => moveAnnouncement(index, 'up')}
                              disabled={index === 0}
                              className={`p-2 rounded-lg ${t.rowHover} ${t.textMuted} disabled:opacity-30`}
                              title="Monter"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              onClick={() => moveAnnouncement(index, 'down')}
                              disabled={index === announcementMessages.length - 1}
                              className={`p-2 rounded-lg ${t.rowHover} ${t.textMuted} disabled:opacity-30`}
                              title="Descendre"
                            >
                              <ArrowDown size={12} />
                            </button>
                            <button
                              onClick={() => setAnnouncementField(index, 'is_active', !item.is_active)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-black ${
                                item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {item.is_active ? 'Actif' : 'Inactif'}
                            </button>
                            <button
                              onClick={() => setExpandedAnnouncementId(isExpanded ? null : item.id)}
                              className={`p-2 rounded-lg ${t.rowHover} ${t.textMuted}`}
                              title="Editer"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => duplicateAnnouncement(index)}
                              className={`p-2 rounded-lg ${t.rowHover} ${t.textMuted}`}
                              title="Dupliquer"
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              onClick={() => removeAnnouncement(index)}
                              className="p-2 rounded-lg text-red-500 hover:bg-red-50"
                              title="Supprimer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {isExpanded ? (
                          <div className={`rounded-xl border ${t.cardBorder} p-4 space-y-4 ${isDark ? 'bg-gray-900/50' : 'bg-gray-50/60'}`}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                              <InputField
                                label="Icon / Emoji"
                                value={item.icon}
                                onChange={(value) => setAnnouncementField(index, 'icon', value)}
                                placeholder="🔥"
                              />
                              <InputField
                                label="Priorite"
                                value={String(item.priority)}
                                onChange={(value) => {
                                  const parsed = Number.parseInt(value, 10);
                                  setAnnouncementField(index, 'priority', Number.isFinite(parsed) ? parsed : DEFAULT_ANNOUNCEMENT_PRIORITY);
                                }}
                                type="number"
                                step={1}
                              />
                              <InputField
                                label="Duree (ms)"
                                value={String(item.duration_ms)}
                                onChange={(value) => {
                                  const parsed = Number.parseInt(value, 10);
                                  setAnnouncementField(
                                    index,
                                    'duration_ms',
                                    Number.isFinite(parsed) && parsed > 0
                                      ? Math.max(MIN_ANNOUNCEMENT_DURATION_MS, parsed)
                                      : DEFAULT_ANNOUNCEMENT_DURATION_MS,
                                  );
                                }}
                                type="number"
                                min={MIN_ANNOUNCEMENT_DURATION_MS}
                                step={500}
                              />
                              <div className="flex items-end">
                                <button
                                  onClick={() => setAnnouncementField(index, 'is_active', !item.is_active)}
                                  className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                                    item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                  }`}
                                >
                                  {item.is_active ? 'Annonce active' : 'Annonce inactive'}
                                </button>
                              </div>
                              <InputField
                                label="Start_at"
                                value={toDateTimeLocalValue(item.start_at)}
                                onChange={(value) => setAnnouncementField(index, 'start_at', fromDateTimeLocalValue(value))}
                                type="datetime-local"
                              />
                              <InputField
                                label="End_at"
                                value={toDateTimeLocalValue(item.end_at)}
                                onChange={(value) => setAnnouncementField(index, 'end_at', fromDateTimeLocalValue(value))}
                                type="datetime-local"
                              />
                              <div className={`rounded-xl border ${t.cardBorder} p-3`}>
                                <label className={`text-xs font-bold uppercase tracking-wide ${t.textMuted}`}>Message color</label>
                                <div className="flex items-center gap-2 mt-2">
                                  <input
                                    type="color"
                                    value={previewBg}
                                    onChange={(e) => setAnnouncementField(index, 'color', e.target.value)}
                                    className={`h-10 w-12 rounded-lg border ${t.cardBorder} ${isDark ? 'bg-gray-950' : 'bg-white'} p-1 cursor-pointer`}
                                  />
                                  <input
                                    value={item.color}
                                    onChange={(e) => setAnnouncementField(index, 'color', e.target.value)}
                                    placeholder="#FF0F0F"
                                    style={{ unicodeBidi: 'plaintext' }}
                                    className={`flex-1 px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 ${t.input}`}
                                  />
                                </div>
                              </div>
                              <div className={`rounded-xl border ${t.cardBorder} p-3`}>
                                <label className={`text-xs font-bold uppercase tracking-wide ${t.textMuted}`}>Text color</label>
                                <div className="flex items-center gap-2 mt-2">
                                  <input
                                    type="color"
                                    value={normalizeHexColor(previewText || '#FFFFFF', '#FFFFFF')}
                                    onChange={(e) => setAnnouncementField(index, 'text_color', e.target.value)}
                                    className={`h-10 w-12 rounded-lg border ${t.cardBorder} ${isDark ? 'bg-gray-950' : 'bg-white'} p-1 cursor-pointer`}
                                  />
                                  <input
                                    value={item.text_color}
                                    onChange={(e) => setAnnouncementField(index, 'text_color', e.target.value)}
                                    placeholder="Auto contrast"
                                    style={{ unicodeBidi: 'plaintext' }}
                                    className={`flex-1 px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 ${t.input}`}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <TextareaField
                                label="text_fr"
                                value={item.text_fr}
                                onChange={(value) => setAnnouncementField(index, 'text_fr', value)}
                                rows={3}
                                lang="fr"
                                placeholder="Ex: 🔥 Livraison rapide partout en Algérie"
                              />
                              <TextareaField
                                label="text_ar"
                                value={item.text_ar}
                                onChange={(value) => setAnnouncementField(index, 'text_ar', value)}
                                rows={3}
                                dir="rtl"
                                lang="ar"
                                placeholder="مثال: 🔥 توصيل سريع في كامل الجزائر"
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-6 shadow-sm space-y-4`}>
              <div className="flex items-center gap-2">
                <h3 className={`text-base font-black ${t.text}`}>Règles d'affichage globales</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <InputField
                  label="Icon / Emoji global"
                  value={announcementGlobalIcon}
                  onChange={(value) => set('announcement_global_icon', value)}
                  placeholder="🛎️"
                />
                <InputField
                  label="Priorité"
                  value={String(announcementGlobalPriority)}
                  onChange={(value) => {
                    const parsed = Number.parseInt(value, 10);
                    set('announcement_global_priority', Number.isFinite(parsed) ? parsed : DEFAULT_ANNOUNCEMENT_GLOBAL_PRIORITY);
                  }}
                  type="number"
                  step={1}
                />
                <InputField
                  label="Début (optionnel)"
                  value={toDateTimeLocalValue(announcementGlobalStartAt)}
                  onChange={(value) => set('announcement_global_start_at', fromDateTimeLocalValue(value))}
                  type="datetime-local"
                />
                <InputField
                  label="Fin (optionnel)"
                  value={toDateTimeLocalValue(announcementGlobalEndAt)}
                  onChange={(value) => set('announcement_global_end_at', fromDateTimeLocalValue(value))}
                  type="datetime-local"
                />
              </div>
              <p className={`text-xs ${t.textMuted}`}>
                Ces règles sont utilisées comme valeurs par défaut lors de l'ajout d'un nouveau message.
              </p>
            </div>

            <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-6 shadow-sm space-y-5`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Layers size={16} className="text-[#1A3C6E]" />
                    <h2 className={`font-bold ${t.text}`}>Categories spotlight strip</h2>
                  </div>
                  <p className={`text-xs ${t.textMuted}`}>
                    Bandeau marketing independant affiche juste au-dessus de la section Nos categories.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => set('categories_strip_enabled', !categoriesStrip.enabled)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black ${
                    categoriesStrip.enabled
                      ? 'bg-[#1A3C6E] text-white'
                      : (isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700')
                  }`}
                >
                  {categoriesStrip.enabled ? <CheckCircle2 size={13} /> : <SlidersHorizontal size={13} />}
                  {categoriesStrip.enabled ? 'Active' : 'Desactive'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextareaField
                  label="Titre FR"
                  value={categoriesStrip.title_fr}
                  onChange={(value) => set('categories_strip_title_fr', value)}
                  rows={2}
                  lang="fr"
                  maxLength={160}
                />
                <TextareaField
                  label="العنوان AR"
                  value={categoriesStrip.title_ar}
                  onChange={(value) => set('categories_strip_title_ar', value)}
                  rows={2}
                  dir="rtl"
                  lang="ar"
                  maxLength={160}
                />
                <TextareaField
                  label="Subtitle FR"
                  value={categoriesStrip.subtitle_fr}
                  onChange={(value) => set('categories_strip_subtitle_fr', value)}
                  rows={3}
                  lang="fr"
                  maxLength={260}
                />
                <TextareaField
                  label="الوصف AR"
                  value={categoriesStrip.subtitle_ar}
                  onChange={(value) => set('categories_strip_subtitle_ar', value)}
                  rows={3}
                  dir="rtl"
                  lang="ar"
                  maxLength={260}
                />
                <InputField
                  label="Icon / Emoji"
                  value={categoriesStrip.icon}
                  onChange={(value) => set('categories_strip_icon', value)}
                  placeholder="✨"
                />
                <InputField
                  label="CTA FR"
                  value={categoriesStrip.cta_fr}
                  onChange={(value) => set('categories_strip_cta_fr', value)}
                  placeholder="Voir la boutique"
                  lang="fr"
                />
                <InputField
                  label="CTA AR"
                  value={categoriesStrip.cta_ar}
                  onChange={(value) => set('categories_strip_cta_ar', value)}
                  placeholder="اكتشف المتجر"
                  dir="rtl"
                  lang="ar"
                />
                <InputField
                  label="CTA Link (optionnel)"
                  value={categoriesStrip.cta_link}
                  onChange={(value) => set('categories_strip_cta_link', value)}
                  placeholder="/shop ou https://..."
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className={`rounded-2xl border ${t.cardBorder} p-4 space-y-3`}>
                  <p className={`text-sm font-bold ${t.text}`}>Couleur de fond</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={categoriesStrip.background_color}
                      onChange={(e) => set('categories_strip_bg_color', e.target.value)}
                      className={`h-10 w-14 rounded-lg border ${t.cardBorder} ${isDark ? 'bg-gray-900' : 'bg-white'} p-1 cursor-pointer`}
                    />
                    <input
                      value={content.categories_strip_bg_color || ''}
                      onChange={(e) => set('categories_strip_bg_color', e.target.value)}
                      placeholder="#1A3C6E"
                      style={{ unicodeBidi: 'plaintext' }}
                      className={`flex-1 px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 ${t.input}`}
                    />
                  </div>
                </div>

                <div className={`rounded-2xl border ${t.cardBorder} p-4 space-y-3`}>
                  <p className={`text-sm font-bold ${t.text}`}>Couleur du texte</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={categoriesStrip.text_color}
                      onChange={(e) => set('categories_strip_text_color', e.target.value)}
                      className={`h-10 w-14 rounded-lg border ${t.cardBorder} ${isDark ? 'bg-gray-900' : 'bg-white'} p-1 cursor-pointer`}
                    />
                    <input
                      value={content.categories_strip_text_color || ''}
                      onChange={(e) => set('categories_strip_text_color', e.target.value)}
                      placeholder="#F8FAFC"
                      style={{ unicodeBidi: 'plaintext' }}
                      className={`flex-1 px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 ${t.input}`}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className={`text-xs font-bold uppercase tracking-wide ${t.textMuted}`}>Preview FR</p>
                  <CategoriesMarketingStrip
                    config={categoriesStrip}
                    lang="fr"
                    dir="ltr"
                    chips={['Cartables', 'Trousses', 'Fournitures', 'Promotions']}
                    ctaHref={categoriesStrip.cta_link}
                    preview
                    className={!categoriesStrip.enabled ? 'opacity-60' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <p className={`text-xs font-bold uppercase tracking-wide ${t.textMuted}`}>Preview AR</p>
                  <CategoriesMarketingStrip
                    config={categoriesStrip}
                    lang="ar"
                    dir="rtl"
                    chips={['محافظ', 'مقالم', 'لوازم', 'عروض']}
                    ctaHref={categoriesStrip.cta_link}
                    preview
                    className={!categoriesStrip.enabled ? 'opacity-60' : ''}
                  />
                </div>
              </div>
            </div>

            <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-6 shadow-sm space-y-5`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Play size={16} className="text-[#1A3C6E]" />
                    <h2 className={`font-bold ${t.text}`}>Ticker pro au-dessus de Nos categories</h2>
                  </div>
                  <p className={`text-xs ${t.textMuted}`}>
                    Bandeau marquee anime place sous les icones de confiance, juste avant le titre NOS CATEGORIES.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => set('categories_marquee_enabled', !categoriesMarqueeEnabled)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black ${
                    categoriesMarqueeEnabled
                      ? 'bg-[#1A3C6E] text-white'
                      : (isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700')
                  }`}
                >
                  {categoriesMarqueeEnabled ? <CheckCircle2 size={13} /> : <SlidersHorizontal size={13} />}
                  {categoriesMarqueeEnabled ? 'PRO ON' : 'PRO OFF'}
                </button>
              </div>

              <div className={`rounded-2xl border ${t.cardBorder} p-4 ${isDark ? 'bg-gray-900/40' : 'bg-gray-50/70'}`}>
                <p className={`text-xs ${t.textMuted}`}>
                  Controlez ce ticker comme une section independante: texte FR/AR, icone et bouton PRO ON/OFF.
                  Si les champs restent vides, il reprend automatiquement les messages de l'engine d'annonces.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextareaField
                  label="Texte FR (ticker)"
                  value={categoriesMarqueeTextFr}
                  onChange={(value) => set('categories_marquee_text_fr', value)}
                  rows={2}
                  lang="fr"
                  maxLength={160}
                  placeholder="Livraison rapide • Paiement a la livraison • Qualite premium • Support client"
                />
                <TextareaField
                  label="النص AR (ticker)"
                  value={categoriesMarqueeTextAr}
                  onChange={(value) => set('categories_marquee_text_ar', value)}
                  rows={2}
                  dir="rtl"
                  lang="ar"
                  maxLength={160}
                  placeholder="توصيل سريع • الدفع عند الاستلام • جودة ممتازة • دعم العملاء"
                />
                <InputField
                  label="Icon / Emoji (optionnel)"
                  value={categoriesMarqueeIcon}
                  onChange={(value) => set('categories_marquee_icon', value)}
                  placeholder="✨"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className={`text-xs font-bold uppercase tracking-wide ${t.textMuted}`}>Preview FR</p>
                  <InlineAnnouncementStrip
                    content={{
                      ...content,
                      categories_marquee_enabled: true,
                      categories_marquee_text_fr: categoriesMarqueeTextFr,
                      categories_marquee_text_ar: categoriesMarqueeTextAr,
                      categories_marquee_icon: categoriesMarqueeIcon,
                    }}
                    lang="fr"
                    preview
                    className={!categoriesMarqueeEnabled ? 'opacity-60 rounded-2xl' : 'rounded-2xl'}
                  />
                </div>
                <div className="space-y-2">
                  <p className={`text-xs font-bold uppercase tracking-wide ${t.textMuted}`}>Preview AR</p>
                  <InlineAnnouncementStrip
                    content={{
                      ...content,
                      categories_marquee_enabled: true,
                      categories_marquee_text_fr: categoriesMarqueeTextFr,
                      categories_marquee_text_ar: categoriesMarqueeTextAr,
                      categories_marquee_icon: categoriesMarqueeIcon,
                    }}
                    lang="ar"
                    preview
                    className={!categoriesMarqueeEnabled ? 'opacity-60 rounded-2xl' : 'rounded-2xl'}
                  />
                </div>
              </div>
            </div>

            <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-6 shadow-sm space-y-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <SearchIcon size={16} className="text-[#1A3C6E]" />
                    <h2 className={`font-bold ${t.text}`}>Trending searches</h2>
                  </div>
                  <p className={`text-xs ${t.textMuted}`}>{listItemCountLabel(searchTrending.length)} - suggestions recherche</p>
                </div>
                <button
                  onClick={addSearchTrend}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1A3C6E] text-white font-bold rounded-xl text-sm hover:bg-[#0d2447] transition-colors"
                >
                  <Plus size={14} /> Ajouter
                </button>
              </div>

              {searchTrending.length === 0 ? (
                <p className={`text-sm ${t.textMuted}`}>Aucune recherche tendance configuree.</p>
              ) : (
                <div className="space-y-3">
                  {searchTrending.map((item, index) => (
                    <div key={item.id} className={`rounded-2xl border ${t.cardBorder} p-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-xs font-bold ${t.textMuted}`}>Terme #{index + 1}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSearchTrendField(index, 'is_active', !item.is_active)}
                            className={`p-2 rounded-lg ${item.is_active ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}
                          >
                            {item.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          <button onClick={() => moveSearchTrend(index, 'up')} disabled={index === 0} className={`p-2 rounded-lg ${t.rowHover} ${t.textMuted} disabled:opacity-30`}>
                            <ArrowUp size={12} />
                          </button>
                          <button onClick={() => moveSearchTrend(index, 'down')} disabled={index === searchTrending.length - 1} className={`p-2 rounded-lg ${t.rowHover} ${t.textMuted} disabled:opacity-30`}>
                            <ArrowDown size={12} />
                          </button>
                          <button onClick={() => removeSearchTrend(index)} className="p-2 rounded-lg text-red-500 hover:bg-red-50">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <InputField
                          label="Texte FR"
                          value={item.text_fr}
                          onChange={(value) => setSearchTrendField(index, 'text_fr', value)}
                          lang="fr"
                        />
                        <InputField
                          label="النص AR"
                          value={item.text_ar}
                          onChange={(value) => setSearchTrendField(index, 'text_ar', value)}
                          dir="rtl"
                          lang="ar"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-6 shadow-sm space-y-4`}>
              <div className="flex items-center gap-2 mb-1">
                <MailCheck size={16} className="text-[#1A3C6E]" />
                <h2 className={`font-bold ${t.text}`}>Newsletter popup</h2>
              </div>
              <p className={`text-xs ${t.textMuted}`}>Configuration complete du modal de bienvenue newsletter</p>

              <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
                <div>
                  <p className={`text-sm font-bold ${t.text}`}>Activer le popup newsletter</p>
                  <p className={`text-xs ${t.textMuted}`}>Affiche le modal sur la storefront</p>
                </div>
                <button
                  onClick={() => setNewsletterField('enabled', !newsletterPopup.enabled)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    newsletterPopup.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {newsletterPopup.enabled ? 'Active' : 'Desactive'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextareaField label="Titre FR" value={newsletterPopup.title_fr || ''} onChange={(v) => setNewsletterField('title_fr', v)} rows={2} lang="fr" maxLength={160} />
                <TextareaField label="العنوان AR" value={newsletterPopup.title_ar || ''} onChange={(v) => setNewsletterField('title_ar', v)} rows={2} dir="rtl" lang="ar" maxLength={160} />
                <TextareaField label="Description FR" value={newsletterPopup.description_fr || ''} onChange={(v) => setNewsletterField('description_fr', v)} rows={3} lang="fr" maxLength={300} />
                <TextareaField label="الوصف AR" value={newsletterPopup.description_ar || ''} onChange={(v) => setNewsletterField('description_ar', v)} rows={3} dir="rtl" lang="ar" maxLength={300} />
                <InputField label="Placeholder email FR" value={newsletterPopup.email_placeholder_fr || ''} onChange={(v) => setNewsletterField('email_placeholder_fr', v)} lang="fr" />
                <InputField label="Placeholder email AR" value={newsletterPopup.email_placeholder_ar || ''} onChange={(v) => setNewsletterField('email_placeholder_ar', v)} dir="rtl" lang="ar" />
                <InputField label="Texte bouton FR" value={newsletterPopup.button_text_fr || ''} onChange={(v) => setNewsletterField('button_text_fr', v)} lang="fr" />
                <InputField label="نص الزر AR" value={newsletterPopup.button_text_ar || ''} onChange={(v) => setNewsletterField('button_text_ar', v)} dir="rtl" lang="ar" />
                <TextareaField label="Message succes FR" value={newsletterPopup.success_message_fr || ''} onChange={(v) => setNewsletterField('success_message_fr', v)} rows={2} lang="fr" maxLength={220} />
                <TextareaField label="رسالة النجاح AR" value={newsletterPopup.success_message_ar || ''} onChange={(v) => setNewsletterField('success_message_ar', v)} rows={2} dir="rtl" lang="ar" maxLength={220} />
              </div>
            </div>
          </div>

          <div className="space-y-5 xl:sticky xl:top-4">
            <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-5 shadow-sm space-y-4`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className={`text-base font-black ${t.text}`}>Aperçu live (storefront)</h3>
                <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('desktop')}
                    className={`px-2.5 py-1.5 text-xs font-bold inline-flex items-center gap-1 ${
                      previewDevice === 'desktop' ? 'bg-[#1A3C6E] text-white' : 'bg-white text-gray-700'
                    }`}
                  >
                    <Monitor size={12} /> Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('mobile')}
                    className={`px-2.5 py-1.5 text-xs font-bold inline-flex items-center gap-1 ${
                      previewDevice === 'mobile' ? 'bg-[#1A3C6E] text-white' : 'bg-white text-gray-700'
                    }`}
                  >
                    <Smartphone size={12} /> Mobile
                  </button>
                </div>
              </div>

              <AnnouncementBarLivePreview
                messages={announcementMessages}
                fallbackBarColor={announcementBarColor}
                animationEnabled={announcementAnimationEnabled}
                animationDirection={announcementAnimationDirection}
                animationMode={announcementAnimationMode}
                isDark={isDark}
                engineEnabled={announcementEngineEnabled}
                radiusPx={announcementRadiusPx}
                speedSeconds={announcementSpeedSeconds}
                loopInfinite={announcementLoopInfinite}
                pauseOnHover={announcementPauseOnHover}
                resumeAuto={announcementResumeAuto}
                multiMessages={announcementMultiMessages}
                previewDevice={previewDevice}
                globalIcon={announcementGlobalIcon}
                onMetaChange={setPreviewMeta}
              />

              <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 text-emerald-700 px-3 py-1.5 text-xs font-black">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Aperçu synchronisé
              </div>
            </div>

            <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-5 shadow-sm space-y-3`}>
              <h3 className={`text-base font-black ${t.text}`}>Statut</h3>
              <div className={`rounded-xl border ${t.cardBorder} p-3 text-sm space-y-2 ${isDark ? 'bg-gray-900/50' : 'bg-gray-50/70'}`}>
                <div className="flex items-center justify-between">
                  <span className={t.textMuted}>Message actif</span>
                  <span className={`text-xs font-black px-2 py-1 rounded-full ${
                    previewActiveMessage && announcementEngineEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {previewActiveMessage && announcementEngineEnabled ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={t.textMuted}>Priorité</span>
                  <span className={`font-bold ${t.text}`}>{previewPriority}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={t.textMuted}>Durée</span>
                  <span className={`font-bold ${t.text}`}>{previewMeta.effectiveDurationMs} ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={t.textMuted}>Prochain défilement</span>
                  <span className={`font-bold ${t.text}`}>
                    {previewMeta.hasRotation && !previewMeta.isPaused ? `Dans ${previewCountdown.toFixed(1)}s` : '--'}
                  </span>
                </div>
              </div>
            </div>

            <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-5 shadow-sm space-y-3`}>
              <h3 className={`text-base font-black ${t.text}`}>Aide & Astuces</h3>
              <ul className={`space-y-2 text-sm ${t.textMuted}`}>
                <li className="flex items-start gap-2"><span>✔</span><span>couleur globale utilisée par défaut</span></li>
                <li className="flex items-start gap-2"><span>✔</span><span>messages défilent selon priorité</span></li>
                <li className="flex items-start gap-2"><span>✔</span><span>couleur texte auto contrast</span></li>
                <li className="flex items-start gap-2"><span>✔</span><span>compatible storefront, web & mobile</span></li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

