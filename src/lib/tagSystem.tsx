import React from 'react';
import {
  Utensils,
  Car,
  Home,
  HeartPulse,
  User,
  ShoppingBag,
  GraduationCap,
  Receipt,
  Landmark,
  Gift,
  Plane,
  Users,
  PawPrint,
  CircleDotDashed,
  Tags,
  Banknote,
  CreditCard,
  Smartphone,
  Building2,
  Globe,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Pizza,
  Apple,
  ShoppingCart,
  Fuel,
  Bus,
  Train,
  Bike,
  Wrench,
  Hammer,
  Scissors,
  Shirt,
  Watch,
  Gem,
  Camera,
  Music,
  Film,
  Gamepad2,
  Book,
  Briefcase,
  Laptop,
  Tv,
  Wifi,
  Zap,
  Flame,
  Droplets,
  Sun,
  Moon,
  Umbrella,
  Stethoscope,
  Pill,
  Dumbbell,
  Baby,
  Cake,
  Wine,
  Package,
  Truck,
  Store,
  Wallet,
  Coins,
  PiggyBank,
  Calculator,
  FileText,
  Folder,
  Key,
  Lock,
  Bell,
  Star,
  Heart,
  Award,
  LucideIcon
} from 'lucide-react';
import { Language } from './translations';
import { Transaction, CustomTagDefinition, UserTagConfig } from '../types';

export interface TagMeta {
  id: string;
  en: string;
  bn: string;
  shortDescEn: string;
  shortDescBn: string;
  icon: LucideIcon;
  color: string;
  isCustom?: boolean;
  logoDataUrl?: string | null;
  imageOnly?: boolean;
  enabled?: boolean;
  type?: 'due' | 'payment';
}

export const EXPENSE_TAGS: TagMeta[] = [
  { id: 'food', en: 'Food', bn: 'খাবার', shortDescEn: 'Food', shortDescBn: 'খাবার', icon: Utensils, color: '#F97316', type: 'due' },
  { id: 'transport', en: 'Transport', bn: 'যাতায়াত', shortDescEn: 'Transport', shortDescBn: 'যাতায়াত', icon: Car, color: '#3B82F6', type: 'due' },
  { id: 'housing', en: 'Housing', bn: 'বাসা-ভাড়া', shortDescEn: 'Housing', shortDescBn: 'বাসা-ভাড়া', icon: Home, color: '#8B5CF6', type: 'due' },
  { id: 'health', en: 'Health', bn: 'চিকিৎসা', shortDescEn: 'Health', shortDescBn: 'চিকিৎসা', icon: HeartPulse, color: '#EF4444', type: 'due' },
  { id: 'personal', en: 'Personal', bn: 'ব্যক্তিগত', shortDescEn: 'Personal', shortDescBn: 'ব্যক্তিগত', icon: User, color: '#EC4899', type: 'due' },
  { id: 'shopping', en: 'Shopping', bn: 'কেনাকাটা', shortDescEn: 'Shopping', shortDescBn: 'কেনাকাটা', icon: ShoppingBag, color: '#06B6D4', type: 'due' },
  { id: 'education', en: 'Education', bn: 'শিক্ষা', shortDescEn: 'Education', shortDescBn: 'শিক্ষা', icon: GraduationCap, color: '#10B981', type: 'due' },
  { id: 'bills', en: 'Bills', bn: 'বিল', shortDescEn: 'Bills', shortDescBn: 'বিল', icon: Receipt, color: '#F59E0B', type: 'due' },
  { id: 'finance', en: 'Finance', bn: 'ফাইন্যান্স', shortDescEn: 'Finance', shortDescBn: 'ফাইন্যান্স', icon: Landmark, color: '#6366F1', type: 'due' },
  { id: 'gifts', en: 'Gifts', bn: 'উপহার', shortDescEn: 'Gift', shortDescBn: 'উপহার', icon: Gift, color: '#F43F5E', type: 'due' },
  { id: 'travel', en: 'Travel', bn: 'ভ্রমণ', shortDescEn: 'Travel', shortDescBn: 'ভ্রমণ', icon: Plane, color: '#0EA5E9', type: 'due' },
  { id: 'family', en: 'Family', bn: 'পরিবার', shortDescEn: 'Family', shortDescBn: 'পরিবার', icon: Users, color: '#14B8A6', type: 'due' },
  { id: 'pets', en: 'Pets', bn: 'পোষা প্রাণী', shortDescEn: 'Pets', shortDescBn: 'পোষা প্রাণী', icon: PawPrint, color: '#D97706', type: 'due' },
  { id: 'other', en: 'Other', bn: 'অন্যান্য', shortDescEn: 'Other', shortDescBn: 'অন্যান্য', icon: Tags, color: '#64748B', type: 'due' },
];

export const PAYMENT_TAGS: TagMeta[] = [
  { id: 'cash', en: 'Cash', bn: 'নগদ', shortDescEn: 'Cash', shortDescBn: 'নগদ', icon: Banknote, color: '#10B981', type: 'payment' },
  { id: 'card', en: 'Card', bn: 'কার্ড', shortDescEn: 'Card', shortDescBn: 'কার্ড', icon: CreditCard, color: '#3B82F6', type: 'payment' },
  { id: 'mobile', en: 'Mobile', bn: 'মোবাইল', shortDescEn: 'Mobile', shortDescBn: 'মোবাইল', icon: Smartphone, color: '#EC4899', type: 'payment' },
  { id: 'bank', en: 'Bank', bn: 'ব্যাংক', shortDescEn: 'Bank', shortDescBn: 'ব্যাংক', icon: Building2, color: '#8B5CF6', type: 'payment' },
  { id: 'online', en: 'Online', bn: 'অনলাইন', shortDescEn: 'Online', shortDescBn: 'অনলাইন', icon: Globe, color: '#06B6D4', type: 'payment' },
  { id: 'other', en: 'Other', bn: 'অন্যান্য', shortDescEn: 'Other', shortDescBn: 'অন্যান্য', icon: Tags, color: '#64748B', type: 'payment' },
];

export const ALL_TAGS: TagMeta[] = [...EXPENSE_TAGS, ...PAYMENT_TAGS.filter(p => !EXPENSE_TAGS.some(e => e.id === p.id))];

export const TAG_LIMITS = {
  due: {
    maxEnabled: 25,
    maxTotal: 50,
    defaultCount: EXPENSE_TAGS.length,
  },
  payment: {
    maxEnabled: 25,
    maxTotal: 50,
    defaultCount: PAYMENT_TAGS.length,
  },
} as const;

// 50 native Lucide icons distinct from all default due & payment tag icons
export const CUSTOM_TAG_ICONS: ReadonlyArray<{ id: string; icon: LucideIcon; label: string }> = [
  { id: 'Coffee', icon: Coffee, label: 'Coffee' },
  { id: 'Pizza', icon: Pizza, label: 'Pizza' },
  { id: 'Apple', icon: Apple, label: 'Groceries' },
  { id: 'ShoppingCart', icon: ShoppingCart, label: 'Cart' },
  { id: 'Fuel', icon: Fuel, label: 'Fuel' },
  { id: 'Bus', icon: Bus, label: 'Bus' },
  { id: 'Train', icon: Train, label: 'Train' },
  { id: 'Bike', icon: Bike, label: 'Bike' },
  { id: 'Wrench', icon: Wrench, label: 'Repair' },
  { id: 'Hammer', icon: Hammer, label: 'Hardware' },
  { id: 'Scissors', icon: Scissors, label: 'Salon' },
  { id: 'Shirt', icon: Shirt, label: 'Apparel' },
  { id: 'Watch', icon: Watch, label: 'Watch' },
  { id: 'Gem', icon: Gem, label: 'Jewelry' },
  { id: 'Camera', icon: Camera, label: 'Photo' },
  { id: 'Music', icon: Music, label: 'Music' },
  { id: 'Film', icon: Film, label: 'Cinema' },
  { id: 'Gamepad2', icon: Gamepad2, label: 'Gaming' },
  { id: 'Book', icon: Book, label: 'Books' },
  { id: 'Briefcase', icon: Briefcase, label: 'Work' },
  { id: 'Laptop', icon: Laptop, label: 'Tech' },
  { id: 'Tv', icon: Tv, label: 'Media' },
  { id: 'Wifi', icon: Wifi, label: 'Internet' },
  { id: 'Zap', icon: Zap, label: 'Electric' },
  { id: 'Flame', icon: Flame, label: 'Gas' },
  { id: 'Droplets', icon: Droplets, label: 'Water' },
  { id: 'Sun', icon: Sun, label: 'Day' },
  { id: 'Moon', icon: Moon, label: 'Night' },
  { id: 'Umbrella', icon: Umbrella, label: 'Insurance' },
  { id: 'Stethoscope', icon: Stethoscope, label: 'Clinic' },
  { id: 'Pill', icon: Pill, label: 'Medicine' },
  { id: 'Dumbbell', icon: Dumbbell, label: 'Fitness' },
  { id: 'Baby', icon: Baby, label: 'Baby' },
  { id: 'Cake', icon: Cake, label: 'Bakery' },
  { id: 'Wine', icon: Wine, label: 'Drinks' },
  { id: 'Package', icon: Package, label: 'Parcel' },
  { id: 'Truck', icon: Truck, label: 'Delivery' },
  { id: 'Store', icon: Store, label: 'Shop' },
  { id: 'Wallet', icon: Wallet, label: 'Wallet' },
  { id: 'Coins', icon: Coins, label: 'Coins' },
  { id: 'PiggyBank', icon: PiggyBank, label: 'Savings' },
  { id: 'Calculator', icon: Calculator, label: 'Tax' },
  { id: 'FileText', icon: FileText, label: 'Invoice' },
  { id: 'Folder', icon: Folder, label: 'Files' },
  { id: 'Key', icon: Key, label: 'Rent/Key' },
  { id: 'Lock', icon: Lock, label: 'Security' },
  { id: 'Bell', icon: Bell, label: 'Alert' },
  { id: 'Star', icon: Star, label: 'VIP' },
  { id: 'Heart', icon: Heart, label: 'Care' },
  { id: 'Award', icon: Award, label: 'Bonus' },
];

const CUSTOM_TAG_ICON_MAP: Record<string, LucideIcon> = {};
CUSTOM_TAG_ICONS.forEach((entry) => {
  CUSTOM_TAG_ICON_MAP[entry.id] = entry.icon;
});

export function getCustomTagIconComponent(iconName?: string | null): LucideIcon {
  if (iconName && CUSTOM_TAG_ICON_MAP[iconName]) {
    return CUSTOM_TAG_ICON_MAP[iconName];
  }
  return CircleDotDashed;
}

export const CUSTOM_TAG_COLORS = [
  '#059669',
  '#3B82F6',
  '#F97316',
  '#EC4899',
  '#8B5CF6',
  '#EF4444',
  '#06B6D4',
  '#F59E0B',
  '#6366F1',
  '#14B8A6',
];

export const DEFAULT_TAG_CONFIG: UserTagConfig = {
  disabledDueTags: [],
  disabledPaymentTags: [],
  customTags: [],
};

const EXPENSE_DEFAULT_MAP: Record<string, TagMeta> = {};
EXPENSE_TAGS.forEach(t => { EXPENSE_DEFAULT_MAP[t.id] = t; });

const PAYMENT_DEFAULT_MAP: Record<string, TagMeta> = {};
PAYMENT_TAGS.forEach(t => { PAYMENT_DEFAULT_MAP[t.id] = t; });

const COMBINED_DEFAULT_MAP: Record<string, TagMeta> = {
  ...EXPENSE_DEFAULT_MAP,
  ...PAYMENT_DEFAULT_MAP,
};

let currentTagConfig: UserTagConfig = DEFAULT_TAG_CONFIG;
let customDueMap: Record<string, TagMeta> = {};
let customPaymentMap: Record<string, TagMeta> = {};

function customDefToMeta(def: CustomTagDefinition): TagMeta {
  return {
    id: def.id,
    en: def.name,
    bn: def.name,
    shortDescEn: def.name,
    shortDescBn: def.name,
    icon: getCustomTagIconComponent(def.iconName),
    color: def.color || '#059669',
    isCustom: true,
    logoDataUrl: def.logoDataUrl || null,
    imageOnly: Boolean(def.imageOnly && def.logoDataUrl),
    enabled: Boolean(def.enabled),
    type: def.type,
  };
}

function isSafeLogoDataUrl(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  if (val.length === 0 || val.length > 52000) return false;
  return /^data:image\/(webp|png|jpeg|jpg);base64,[A-Za-z0-9+/=]+$/i.test(val);
}

export function sanitizeTagConfig(raw?: Partial<UserTagConfig> | null): UserTagConfig {
  const rawDisabledDue = Array.isArray(raw?.disabledDueTags) ? raw!.disabledDueTags : [];
  const rawDisabledPayment = Array.isArray(raw?.disabledPaymentTags) ? raw!.disabledPaymentTags : [];
  const rawCustom = Array.isArray(raw?.customTags) ? raw!.customTags : [];

  const disabledDueTags = Array.from(
    new Set(
      rawDisabledDue
        .map((id) => String(id || '').toLowerCase().trim())
        .filter((id) => Boolean(EXPENSE_DEFAULT_MAP[id]))
    )
  );

  const disabledPaymentTags = Array.from(
    new Set(
      rawDisabledPayment
        .map((id) => String(id || '').toLowerCase().trim())
        .filter((id) => Boolean(PAYMENT_DEFAULT_MAP[id]))
    )
  );

  const maxCustomDue = Math.max(0, TAG_LIMITS.due.maxTotal - TAG_LIMITS.due.defaultCount);
  const maxCustomPayment = Math.max(0, TAG_LIMITS.payment.maxTotal - TAG_LIMITS.payment.defaultCount);

  const seenIds = new Set<string>();
  const dueCustoms: CustomTagDefinition[] = [];
  const paymentCustoms: CustomTagDefinition[] = [];

  for (const item of rawCustom) {
    if (!item || typeof item !== 'object') continue;
    const type: 'due' | 'payment' = item.type === 'payment' ? 'payment' : 'due';
    const id = String(item.id || '').trim();
    const name = String(item.name || '').trim().slice(0, 32);
    if (!id || !name || seenIds.has(id.toLowerCase())) continue;
    seenIds.add(id.toLowerCase());

    const safeLogo = isSafeLogoDataUrl(item.logoDataUrl) ? item.logoDataUrl : null;
    const safeIconName =
      typeof item.iconName === 'string' && CUSTOM_TAG_ICON_MAP[item.iconName]
        ? item.iconName
        : null;
    const color =
      typeof item.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(item.color.trim())
        ? item.color.trim()
        : '#059669';

    const cleaned: CustomTagDefinition = {
      id,
      type,
      name,
      color,
      iconName: safeIconName,
      logoDataUrl: safeLogo,
      imageOnly: Boolean(item.imageOnly && safeLogo),
      enabled: item.enabled !== false,
      createdAt: item.createdAt || undefined,
      updatedAt: item.updatedAt || undefined,
    };

    if (type === 'due' && dueCustoms.length < maxCustomDue) {
      dueCustoms.push(cleaned);
    } else if (type === 'payment' && paymentCustoms.length < maxCustomPayment) {
      paymentCustoms.push(cleaned);
    }
  }

  // Enforce enabled cap per category cleanly (disable overflow if corrupted/legacy payload exceeds cap)
  const enforceEnabledCap = (
    defaults: TagMeta[],
    disabledIds: string[],
    customs: CustomTagDefinition[],
    maxEnabled: number
  ) => {
    const disabledSet = new Set(disabledIds);
    const enabledDefaultCount = defaults.filter((d) => !disabledSet.has(d.id)).length;
    let remainingSlots = Math.max(0, maxEnabled - enabledDefaultCount);
    return customs.map((c) => {
      if (!c.enabled) return c;
      if (remainingSlots > 0) {
        remainingSlots -= 1;
        return c;
      }
      return { ...c, enabled: false };
    });
  };

  const finalDueCustoms = enforceEnabledCap(
    EXPENSE_TAGS,
    disabledDueTags,
    dueCustoms,
    TAG_LIMITS.due.maxEnabled
  );
  const finalPaymentCustoms = enforceEnabledCap(
    PAYMENT_TAGS,
    disabledPaymentTags,
    paymentCustoms,
    TAG_LIMITS.payment.maxEnabled
  );

  return {
    disabledDueTags,
    disabledPaymentTags,
    customTags: [...finalDueCustoms, ...finalPaymentCustoms],
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : undefined,
  };
}

function rebuildCustomMaps(config: UserTagConfig) {
  const nextDue: Record<string, TagMeta> = {};
  const nextPay: Record<string, TagMeta> = {};
  config.customTags.forEach((def) => {
    const meta = customDefToMeta(def);
    if (def.type === 'due') {
      nextDue[def.id.toLowerCase()] = meta;
    } else {
      nextPay[def.id.toLowerCase()] = meta;
    }
  });
  customDueMap = nextDue;
  customPaymentMap = nextPay;
}

export function getUserTagConfig(): UserTagConfig {
  return currentTagConfig;
}

export function setUserTagConfigState(nextConfig?: Partial<UserTagConfig> | null): UserTagConfig {
  const sanitized = sanitizeTagConfig(nextConfig);
  currentTagConfig = sanitized;
  rebuildCustomMaps(sanitized);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tag-config-changed', { detail: sanitized }));
  }
  return sanitized;
}

export function resetUserTagConfigState(): void {
  currentTagConfig = DEFAULT_TAG_CONFIG;
  customDueMap = {};
  customPaymentMap = {};
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tag-config-changed', { detail: DEFAULT_TAG_CONFIG }));
  }
}

export function useTagConfig(): UserTagConfig {
  const [config, setConfig] = React.useState<UserTagConfig>(() => getUserTagConfig());
  React.useEffect(() => {
    const sync = () => setConfig(getUserTagConfig());
    sync();
    window.addEventListener('tag-config-changed', sync);
    return () => window.removeEventListener('tag-config-changed', sync);
  }, []);
  return config;
}

export function getTagCounts(config: UserTagConfig, type: 'due' | 'payment') {
  const defaults = type === 'due' ? EXPENSE_TAGS : PAYMENT_TAGS;
  const limits = TAG_LIMITS[type];
  const disabledSet = new Set(
    (type === 'due' ? config.disabledDueTags : config.disabledPaymentTags).map((id) => id.toLowerCase())
  );
  const customList = config.customTags.filter((c) => c.type === type);
  const enabledDefaultCount = defaults.filter((d) => !disabledSet.has(d.id)).length;
  const enabledCustomCount = customList.filter((c) => c.enabled).length;
  return {
    enabledDefaultCount,
    enabledCustomCount,
    enabledCount: enabledDefaultCount + enabledCustomCount,
    totalCount: defaults.length + customList.length,
    customCount: customList.length,
    maxEnabled: limits.maxEnabled,
    maxTotal: limits.maxTotal,
  };
}

export function isTagDisabled(tagId?: string | null, type?: 'due' | 'payment'): boolean {
  if (!tagId) return false;
  const normalized = tagId.toLowerCase().trim();
  if (!normalized) return false;

  const isDueDefaultDisabled = currentTagConfig.disabledDueTags.some(
    (id) => id.toLowerCase() === normalized
  );
  const isPaymentDefaultDisabled = currentTagConfig.disabledPaymentTags.some(
    (id) => id.toLowerCase() === normalized
  );

  const customDue = customDueMap[normalized];
  const customPayment = customPaymentMap[normalized];

  if (type === 'due') {
    if (customDue) return !customDue.enabled;
    if (EXPENSE_DEFAULT_MAP[normalized]) return isDueDefaultDisabled;
    if (customPayment) return !customPayment.enabled;
    if (PAYMENT_DEFAULT_MAP[normalized]) return isPaymentDefaultDisabled;
    return false;
  }
  if (type === 'payment') {
    if (customPayment) return !customPayment.enabled;
    if (PAYMENT_DEFAULT_MAP[normalized]) return isPaymentDefaultDisabled;
    if (customDue) return !customDue.enabled;
    if (EXPENSE_DEFAULT_MAP[normalized]) return isDueDefaultDisabled;
    return false;
  }
  if (customDue) return !customDue.enabled;
  if (customPayment) return !customPayment.enabled;
  if (EXPENSE_DEFAULT_MAP[normalized]) return isDueDefaultDisabled;
  if (PAYMENT_DEFAULT_MAP[normalized]) return isPaymentDefaultDisabled;
  return false;
}

export function getTagMeta(tagId?: string | null, type?: 'due' | 'payment'): TagMeta | null {
  if (!tagId) return null;
  const normalized = tagId.toLowerCase().trim();
  if (!normalized) return null;

  if (type === 'due') {
    return customDueMap[normalized] || EXPENSE_DEFAULT_MAP[normalized] || customPaymentMap[normalized] || PAYMENT_DEFAULT_MAP[normalized] || null;
  }
  if (type === 'payment') {
    return customPaymentMap[normalized] || PAYMENT_DEFAULT_MAP[normalized] || customDueMap[normalized] || EXPENSE_DEFAULT_MAP[normalized] || null;
  }
  return (
    customDueMap[normalized] ||
    customPaymentMap[normalized] ||
    COMBINED_DEFAULT_MAP[normalized] ||
    null
  );
}

export function getTagDefaultDescription(tagId: string, lang: Language, type?: 'due' | 'payment'): string {
  const meta = getTagMeta(tagId, type);
  if (!meta) return '';
  return lang === 'bn' ? meta.shortDescBn : meta.shortDescEn;
}

export function recordTagUsage(tagId: string): void {
  if (typeof window === 'undefined' || !tagId) return;
  try {
    const raw = localStorage.getItem('easy_due_tag_usage_counts');
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    const norm = tagId.toLowerCase().trim();
    map[norm] = (map[norm] || 0) + 1;
    localStorage.setItem('easy_due_tag_usage_counts', JSON.stringify(map));
  } catch {}
}

export function getTagUsageCounts(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('easy_due_tag_usage_counts');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getSortedTags(
  type: 'due' | 'payment',
  transactions: Transaction[] = [],
  config: UserTagConfig = currentTagConfig
): TagMeta[] {
  const defaults = type === 'due' ? EXPENSE_TAGS : PAYMENT_TAGS;
  const disabledSet = new Set(
    (type === 'due' ? config.disabledDueTags : config.disabledPaymentTags).map((id) => id.toLowerCase())
  );
  const enabledDefaults = defaults.filter((d) => !disabledSet.has(d.id));
  const enabledCustoms = config.customTags
    .filter((c) => c.type === type && c.enabled)
    .map(customDefToMeta);

  const activeList = [...enabledDefaults, ...enabledCustoms].slice(0, TAG_LIMITS[type].maxEnabled);
  const countMap: Record<string, number> = { ...getTagUsageCounts() };

  transactions.forEach((tx) => {
    if (tx.type === type && tx.tag) {
      const normalized = tx.tag.toLowerCase().trim();
      countMap[normalized] = (countMap[normalized] || 0) + 1;
    }
  });

  return activeList.sort((a, b) => {
    const countA = countMap[a.id.toLowerCase()] || 0;
    const countB = countMap[b.id.toLowerCase()] || 0;
    if (countB !== countA) return countB - countA;
    return 0;
  });
}

export interface OptimizedTagLogoResult {
  dataUrl: string;
  width: number;
  height: number;
  byteSize: number;
  dominantColor: string | null;
}

const MAX_RAW_TAG_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_TAG_DATAURL_CHARS = 38000; // ~28 KB base64 image payload per logo

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((n) => n.toString(16).padStart(2, '0').toUpperCase())
      .join('')
  );
}

function extractDominantAccentColor(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): string | null {
  try {
    const data = ctx.getImageData(0, 0, width, height).data;
    const vibrantBuckets = new Map<number, { rSum: number; gSum: number; bSum: number; weight: number }>();
    const fallbackBuckets = new Map<number, { rSum: number; gSum: number; bSum: number; weight: number }>();

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      const lum = (max + min) / 510; // 0..1
      const sat = delta === 0 ? 0 : delta / (255 - Math.abs(max + min - 255) || 1);

      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const alphaWeight = a / 255;

      // Prefer vivid brand accents (avoid near-white backgrounds & near-black outlines)
      if (sat >= 0.22 && lum >= 0.14 && lum <= 0.86) {
        const w = alphaWeight * (0.4 + sat * 1.8);
        const existing = vibrantBuckets.get(key);
        if (existing) {
          existing.rSum += r * w;
          existing.gSum += g * w;
          existing.bSum += b * w;
          existing.weight += w;
        } else {
          vibrantBuckets.set(key, { rSum: r * w, gSum: g * w, bSum: b * w, weight: w });
        }
      } else if (!(r > 240 && g > 240 && b > 240)) {
        const w = alphaWeight;
        const existing = fallbackBuckets.get(key);
        if (existing) {
          existing.rSum += r * w;
          existing.gSum += g * w;
          existing.bSum += b * w;
          existing.weight += w;
        } else {
          fallbackBuckets.set(key, { rSum: r * w, gSum: g * w, bSum: b * w, weight: w });
        }
      }
    }

    const pickTop = (buckets: Map<number, { rSum: number; gSum: number; bSum: number; weight: number }>) => {
      let best: { rSum: number; gSum: number; bSum: number; weight: number } | null = null;
      for (const bkt of buckets.values()) {
        if (!best || bkt.weight > best.weight) best = bkt;
      }
      if (!best || best.weight <= 0) return null;
      return rgbToHex(best.rSum / best.weight, best.gSum / best.weight, best.bSum / best.weight);
    };

    return pickTop(vibrantBuckets) || pickTop(fallbackBuckets);
  } catch {
    return null;
  }
}

async function loadImageSourceFromFile(file: File): Promise<{
  source: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => {
          try { bitmap.close(); } catch {}
        },
      };
    } catch {
      // Fallback to HTMLImageElement below
    }
  }

  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(url),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('INVALID_IMAGE'));
    };
    img.src = url;
  });
}

export async function optimizeTagLogoImage(file: File): Promise<OptimizedTagLogoResult> {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('UNSUPPORTED_TYPE');
  }
  if (file.size <= 0) {
    throw new Error('INVALID_IMAGE');
  }
  if (file.size > MAX_RAW_TAG_IMAGE_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }

  const loaded = await loadImageSourceFromFile(file);
  const canvas = document.createElement('canvas');
  try {
    const srcW = Math.max(1, loaded.width);
    const srcH = Math.max(1, loaded.height);
    const colorState: { current: string | null; extracted: boolean } = {
      current: null,
      extracted: false,
    };

    const renderAtMaxEdge = (maxEdge: number, mime: string, quality?: number): { dataUrl: string; w: number; h: number } | null => {
      const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
      const targetW = Math.max(16, Math.round(srcW * scale));
      const targetH = Math.max(16, Math.round(srcH * scale));
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return null;
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(loaded.source, 0, 0, targetW, targetH);
      if (!colorState.extracted) {
        colorState.extracted = true;
        colorState.current = extractDominantAccentColor(ctx, targetW, targetH);
      }
      const dataUrl = quality !== undefined ? canvas.toDataURL(mime, quality) : canvas.toDataURL(mime);
      if (!dataUrl || !dataUrl.startsWith(`data:${mime}`)) return null;
      return { dataUrl, w: targetW, h: targetH };
    };

    const attempts: Array<{ maxEdge: number; mime: string; quality?: number }> = [
      { maxEdge: 96, mime: 'image/webp', quality: 0.86 },
      { maxEdge: 96, mime: 'image/webp', quality: 0.72 },
      { maxEdge: 96, mime: 'image/webp', quality: 0.56 },
      { maxEdge: 72, mime: 'image/webp', quality: 0.68 },
      { maxEdge: 56, mime: 'image/webp', quality: 0.6 },
      { maxEdge: 72, mime: 'image/png' },
      { maxEdge: 48, mime: 'image/png' },
    ];

    let best: { dataUrl: string; w: number; h: number } | null = null;
    for (const attempt of attempts) {
      const res = renderAtMaxEdge(attempt.maxEdge, attempt.mime, attempt.quality);
      if (!res) continue;
      if (!best || res.dataUrl.length < best.dataUrl.length) {
        best = res;
      }
      if (res.dataUrl.length <= MAX_TAG_DATAURL_CHARS) {
        const base64Part = res.dataUrl.split(',')[1] || '';
        const byteSize = Math.round((base64Part.length * 3) / 4);
        return {
          dataUrl: res.dataUrl,
          width: res.w,
          height: res.h,
          byteSize,
          dominantColor: colorState.current,
        };
      }
    }

    if (best && best.dataUrl.length <= 48000) {
      const base64Part = best.dataUrl.split(',')[1] || '';
      return {
        dataUrl: best.dataUrl,
        width: best.w,
        height: best.h,
        byteSize: Math.round((base64Part.length * 3) / 4),
        dominantColor: colorState.current,
      };
    }

    throw new Error('OUTPUT_TOO_LARGE');
  } finally {
    loaded.cleanup();
    canvas.width = 0;
    canvas.height = 0;
  }
}

export interface TagIconProps {
  tag?: string | null;
  type?: 'due' | 'payment';
  className?: string;
  style?: React.CSSProperties;
}

export const TagIcon: React.FC<TagIconProps> = ({
  tag,
  type = 'due',
  className = 'w-4 h-4 stroke-[1.5]',
  style,
}) => {
  useTagConfig();
  const meta = getTagMeta(tag, type);
  const disabled = isTagDisabled(tag, type);
  if (meta && meta.enabled !== false && !disabled) {
    if (meta.logoDataUrl) {
      return (
        <img
          src={meta.logoDataUrl}
          alt={meta.en}
          className={`${className} object-contain rounded-sm`}
          style={style}
          draggable={false}
        />
      );
    }
    const IconComponent = meta.icon;
    return <IconComponent className={className} style={style} />;
  }
  if (type === 'due') {
    return <ArrowUpRight className={className} style={style} />;
  }
  return <ArrowDownLeft className={className} style={style} />;
};

export function useHorizontalDragWheelScroll(
  containerRef: React.RefObject<HTMLDivElement | null>,
  depKey?: unknown
) {
  const [scrollEdges, setScrollEdges] = React.useState<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  });
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStateRef = React.useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startScrollLeft: number;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startScrollLeft: 0,
  });
  const suppressClickRef = React.useRef(false);

  const updateEdges = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const left = el.scrollLeft > 4;
    const right = maxScroll > 4 && el.scrollLeft < maxScroll - 4;
    setScrollEdges((prev) =>
      prev.left === left && prev.right === right ? prev : { left, right }
    );
  }, [containerRef]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    updateEdges();

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth + 1) return;
      const absY = Math.abs(e.deltaY);
      const absX = Math.abs(e.deltaX);
      if (absY === 0 && absX === 0) return;
      const lineStep = e.deltaMode === 1 ? 28 : e.deltaMode === 2 ? el.clientWidth * 0.85 : 1;
      const delta = absY > absX ? e.deltaY * lineStep : e.deltaX * lineStep;
      if (delta !== 0) {
        e.preventDefault();
        e.stopPropagation();
        el.scrollLeft += delta;
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('scroll', updateEdges, { passive: true });
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateEdges);
      ro.observe(el);
    }

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', updateEdges);
      ro?.disconnect();
    };
  }, [containerRef, updateEdges, depKey]);

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      const el = containerRef.current;
      if (!el || el.scrollWidth <= el.clientWidth + 1) return;
      dragStateRef.current = {
        active: true,
        moved: false,
        startX: e.clientX,
        startScrollLeft: el.scrollLeft,
      };
      suppressClickRef.current = false;
    },
    [containerRef]
  );

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = dragStateRef.current;
      if (!state.active) return;
      const el = containerRef.current;
      if (!el) return;
      const dx = e.clientX - state.startX;
      if (!state.moved && Math.abs(dx) > 5) {
        state.moved = true;
        suppressClickRef.current = true;
        setIsDragging(true);
        try {
          el.setPointerCapture(e.pointerId);
        } catch {}
      }
      if (state.moved) {
        el.scrollLeft = state.startScrollLeft - dx;
      }
    },
    [containerRef]
  );

  const finishDrag = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = dragStateRef.current;
      if (!state.active) return;
      const wasMoved = state.moved;
      state.active = false;
      state.moved = false;
      setIsDragging(false);
      const el = containerRef.current;
      if (el) {
        try {
          if (el.hasPointerCapture(e.pointerId)) {
            el.releasePointerCapture(e.pointerId);
          }
        } catch {}
      }
      if (wasMoved) {
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
    },
    [containerRef]
  );

  const onClickCapture = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
    }
  }, []);

  const scrollByStep = React.useCallback(
    (dir: -1 | 1) => {
      const el = containerRef.current;
      if (!el) return;
      const step = Math.max(140, Math.round(el.clientWidth * 0.65));
      el.scrollBy({ left: dir * step, behavior: 'smooth' });
    },
    [containerRef]
  );

  return {
    scrollEdges,
    isDragging,
    scrollByStep,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
      onClickCapture,
    },
  };
}

interface TagPickerBarProps {
  type: 'due' | 'payment';
  selectedTag: string | null;
  onSelectTag: (tagId: string | null) => void;
  transactions?: Transaction[];
  lang: Language;
  className?: string;
}

export const TagPickerBar: React.FC<TagPickerBarProps> = ({
  type,
  selectedTag,
  onSelectTag,
  transactions = [],
  lang,
  className = ''
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const tagConfig = useTagConfig();

  // Strictly sort by most-used counts; never jump selected tag to front or shuffle mid-interaction
  const sortedTags = React.useMemo(
    () => getSortedTags(type, transactions, tagConfig),
    [type, transactions, tagConfig]
  );

  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = 0;
    }
  }, [type]);

  const { scrollEdges, isDragging, scrollByStep, handlers } = useHorizontalDragWheelScroll(
    containerRef,
    sortedTags.length
  );

  const activeMeta = selectedTag ? getTagMeta(selectedTag, type) : null;
  const ActiveIcon = activeMeta?.icon;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between px-0.5">
        <span className={lang === 'bn' ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400' : 'micro-mono-label font-semibold'}>
          {lang === 'bn' ? 'ট্যাগ নির্বাচন করুন' : 'Assign Tag'}
        </span>
        {activeMeta && (
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
            {activeMeta.logoDataUrl ? (
              <img
                src={activeMeta.logoDataUrl}
                alt={lang === 'bn' ? activeMeta.bn : activeMeta.en}
                className={activeMeta.imageOnly ? 'h-4 w-auto max-w-[44px] object-contain rounded-xs' : 'w-3.5 h-3.5 object-contain rounded-xs'}
                draggable={false}
              />
            ) : ActiveIcon ? (
              <ActiveIcon className="w-3 h-3 stroke-[1.75]" style={{ color: activeMeta.color }} />
            ) : null}
            {!(activeMeta.imageOnly && activeMeta.logoDataUrl) && (
              <span>{lang === 'bn' ? activeMeta.bn : activeMeta.en}</span>
            )}
          </span>
        )}
      </div>

      {/* Horizontally scrollable tag strip with PC wheel, mouse-drag & desktop scroll nudges */}
      <div className="relative group/tagstrip">
        {scrollEdges.left && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Scroll tags left"
            onClick={() => scrollByStep(-1)}
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full surface-glass-interactive border items-center justify-center text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer transition-opacity"
          >
            <ChevronLeft className="w-3.5 h-3.5 stroke-[1.75]" />
          </button>
        )}

        <div
          ref={containerRef}
          {...handlers}
          className={`flex items-center gap-2 overflow-x-auto hide-scrollbar py-1.5 px-1 select-none whitespace-nowrap ${
            isDragging ? 'cursor-grabbing' : 'sm:cursor-grab'
          }`}
        >
          {sortedTags.map((tagItem) => {
            const isSelected = selectedTag === tagItem.id;
            const IconComp = tagItem.icon;
            const tagName = lang === 'bn' ? tagItem.bn : tagItem.en;
            const isImageOnly = Boolean(tagItem.imageOnly && tagItem.logoDataUrl);

            return (
              <button
                key={tagItem.id}
                type="button"
                title={tagName}
                aria-label={tagName}
                onClick={() => {
                  if (!isSelected) recordTagUsage(tagItem.id);
                  onSelectTag(isSelected ? null : tagItem.id);
                }}
                className={`touch-press shrink-0 ${isImageOnly ? 'px-3 py-1.5' : 'px-3.5 py-1.5'} rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-xs ring-1 ring-slate-950 dark:ring-white font-bold'
                    : 'surface-subcard border text-slate-700 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06]'
                }`}
              >
                {tagItem.logoDataUrl ? (
                  <img
                    src={tagItem.logoDataUrl}
                    alt={tagName}
                    className={
                      isImageOnly
                        ? 'h-4 w-auto max-w-[52px] object-contain rounded-xs shrink-0'
                        : 'w-4 h-4 object-contain rounded-xs shrink-0'
                    }
                    draggable={false}
                  />
                ) : (
                  <IconComp
                    className="w-3.5 h-3.5 stroke-[1.5] shrink-0"
                    style={{ color: isSelected ? undefined : tagItem.color }}
                  />
                )}
                {!isImageOnly && (
                  <span className="whitespace-nowrap">{tagName}</span>
                )}
              </button>
            );
          })}
        </div>

        {scrollEdges.right && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Scroll tags right"
            onClick={() => scrollByStep(1)}
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full surface-glass-interactive border items-center justify-center text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer transition-opacity"
          >
            <ChevronRight className="w-3.5 h-3.5 stroke-[1.75]" />
          </button>
        )}
      </div>
    </div>
  );
};

