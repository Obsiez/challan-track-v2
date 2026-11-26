import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  GraphStar,
  Plus,
  X,
  Check,
  ImagePlus,
  Trash2,
  Pencil,
  EyeOff,
  RotateCcw,
  AlertTriangle,
  Pipette,
  ArrowLeft,
  Search,
  Link,
} from 'lucide-react';
import { toast } from 'sonner';
import ModalPortal from './ModalPortal';
import { triggerHaptic } from '../lib/haptics';
import { Language, formatNumber } from '../lib/translations';
import { CustomTagDefinition, UserTagConfig } from '../types';
import {
  EXPENSE_TAGS,
  PAYMENT_TAGS,
  CUSTOM_TAG_COLORS,
  CUSTOM_TAG_ICONS,
  TAG_LIMITS,
  getCustomTagIconComponent,
  getTagCounts,
  optimizeTagLogoImage,
  sanitizeTagConfig,
} from '../lib/tagSystem';

interface ManageTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  tagConfig: UserTagConfig;
  onSaveTagConfig: (nextConfig: UserTagConfig) => Promise<void>;
}

interface CustomTagDraft {
  id: string | null;
  type: 'due' | 'payment';
  name: string;
  color: string;
  iconName: string | null;
  logoDataUrl: string | null;
  imageOnly: boolean;
  shared: boolean;
  enabled: boolean;
}

export const ManageTagsModal: React.FC<ManageTagsModalProps> = ({
  isOpen,
  onClose,
  lang,
  tagConfig,
  onSaveTagConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'due' | 'payment'>('due');
  const [searchQuery, setSearchQuery] = useState('');
  const [draft, setDraft] = useState<CustomTagDraft | null>(null);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [autoPickedHex, setAutoPickedHex] = useState<string | null>(null);
  const [deleteConfirmTag, setDeleteConfirmTag] = useState<CustomTagDefinition | null>(null);
  const [optimizingImg, setOptimizingImg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoInfo, setLogoInfo] = useState<{
    byteSize: number;
    width: number;
    height: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingHistoryPopsRef = useRef(0);
  const hasListHistoryRef = useRef(false);
  const hasDraftHistoryRef = useRef(false);
  const hasIconsHistoryRef = useRef(false);
  const hasDeleteHistoryRef = useRef(false);

  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const iconPickerOpenRef = useRef(isIconPickerOpen);
  iconPickerOpenRef.current = isIconPickerOpen;
  const deleteConfirmRef = useRef(deleteConfirmTag);
  deleteConfirmRef.current = deleteConfirmTag;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const pushTagsHistory = (stage: 'list' | 'draft' | 'delete' | 'icons') => {
    try {
      window.history.pushState({ ...window.history.state, manageTagsModal: stage }, '');
      if (stage === 'list') hasListHistoryRef.current = true;
      if (stage === 'draft') hasDraftHistoryRef.current = true;
      if (stage === 'delete') hasDeleteHistoryRef.current = true;
      if (stage === 'icons') hasIconsHistoryRef.current = true;
    } catch {}
  };

  const openIconPicker = () => {
    triggerHaptic('single');
    pushTagsHistory('icons');
    setIsIconPickerOpen(true);
  };

  const closeIconPicker = () => {
    setIsIconPickerOpen(false);
    if (hasIconsHistoryRef.current && window.history.state?.manageTagsModal === 'icons') {
      hasIconsHistoryRef.current = false;
      pendingHistoryPopsRef.current += 1;
      window.history.back();
      setTimeout(() => {
        if (pendingHistoryPopsRef.current > 0) pendingHistoryPopsRef.current -= 1;
      }, 450);
    } else {
      hasIconsHistoryRef.current = false;
    }
  };

  const closeDraftToManageList = () => {
    setIsIconPickerOpen(false);
    setDraft(null);
    setLogoInfo(null);
    setAutoPickedHex(null);
    let steps = 0;
    if (hasIconsHistoryRef.current) {
      hasIconsHistoryRef.current = false;
      steps += 1;
    }
    if (hasDraftHistoryRef.current) {
      hasDraftHistoryRef.current = false;
      steps += 1;
    }
    if (steps > 0 && (window.history.state?.manageTagsModal === 'draft' || window.history.state?.manageTagsModal === 'icons')) {
      pendingHistoryPopsRef.current += 1;
      window.history.go(-steps);
      setTimeout(() => {
        if (pendingHistoryPopsRef.current > 0) pendingHistoryPopsRef.current -= 1;
      }, 450);
    }
  };

  const closeModalCleanly = () => {
    let steps = 0;
    if (hasIconsHistoryRef.current) steps += 1;
    if (hasDeleteHistoryRef.current) steps += 1;
    if (hasDraftHistoryRef.current) steps += 1;
    if (hasListHistoryRef.current) steps += 1;
    hasIconsHistoryRef.current = false;
    hasDeleteHistoryRef.current = false;
    hasDraftHistoryRef.current = false;
    hasListHistoryRef.current = false;
    setIsIconPickerOpen(false);
    if (steps > 0) {
      pendingHistoryPopsRef.current += 1;
      window.history.go(-steps);
      setTimeout(() => {
        if (pendingHistoryPopsRef.current > 0) pendingHistoryPopsRef.current -= 1;
      }, 450);
    }
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      if (!hasListHistoryRef.current) {
        pushTagsHistory('list');
      }
    } else {
      hasListHistoryRef.current = false;
      hasDraftHistoryRef.current = false;
      hasIconsHistoryRef.current = false;
      hasDeleteHistoryRef.current = false;
      setIsIconPickerOpen(false);
      setDraft(null);
      setSearchQuery('');
      setLogoInfo(null);
      setAutoPickedHex(null);
      setDeleteConfirmTag(null);
      setOptimizingImg(false);
    }
  }, [isOpen]);

  // Android / browser Back gesture support: Native Icons -> New/Edit Tag -> Manage Tags -> Close popup
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (pendingHistoryPopsRef.current > 0) {
        pendingHistoryPopsRef.current -= 1;
        return;
      }
      if (!isOpenRef.current) return;
      const stage = e.state?.manageTagsModal;

      if (iconPickerOpenRef.current && stage !== 'icons') {
        hasIconsHistoryRef.current = false;
        setIsIconPickerOpen(false);
        return;
      }
      if (deleteConfirmRef.current && stage !== 'delete') {
        hasDeleteHistoryRef.current = false;
        setDeleteConfirmTag(null);
        return;
      }
      if (draftRef.current && stage !== 'draft' && stage !== 'icons') {
        hasDraftHistoryRef.current = false;
        hasIconsHistoryRef.current = false;
        setIsIconPickerOpen(false);
        setDraft(null);
        setLogoInfo(null);
        setAutoPickedHex(null);
        return;
      }
      if (stage !== 'list' && stage !== 'draft' && stage !== 'delete' && stage !== 'icons') {
        hasListHistoryRef.current = false;
        hasDraftHistoryRef.current = false;
        hasIconsHistoryRef.current = false;
        hasDeleteHistoryRef.current = false;
        setIsIconPickerOpen(false);
        onCloseRef.current();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Close with Escape cleanly
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || saving || optimizingImg) return;
      if (isIconPickerOpen) {
        closeIconPicker();
      } else if (deleteConfirmTag) {
        setDeleteConfirmTag(null);
        if (hasDeleteHistoryRef.current && window.history.state?.manageTagsModal === 'delete') {
          hasDeleteHistoryRef.current = false;
          pendingHistoryPopsRef.current += 1;
          window.history.back();
        }
      } else if (draft) {
        closeDraftToManageList();
      } else {
        closeModalCleanly();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, saving, optimizingImg, isIconPickerOpen, deleteConfirmTag, draft]);

  const defaultTags = activeTab === 'due' ? EXPENSE_TAGS : PAYMENT_TAGS;
  const customTagsForTab = useMemo(
    () => tagConfig.customTags.filter((c) => c.type === activeTab),
    [tagConfig.customTags, activeTab]
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredCustomTags = useMemo(() => {
    if (!normalizedQuery) return customTagsForTab;
    return customTagsForTab.filter((t) => t.name.toLowerCase().includes(normalizedQuery));
  }, [customTagsForTab, normalizedQuery]);

  const filteredDefaultTags = useMemo(() => {
    if (!normalizedQuery) return defaultTags;
    return defaultTags.filter(
      (t) =>
        t.en.toLowerCase().includes(normalizedQuery) ||
        t.bn.toLowerCase().includes(normalizedQuery) ||
        t.id.toLowerCase().includes(normalizedQuery)
    );
  }, [defaultTags, normalizedQuery]);

  if (!isOpen) return null;

  const isBn = lang === 'bn';
  const disabledIds = new Set(
    (activeTab === 'due' ? tagConfig.disabledDueTags : tagConfig.disabledPaymentTags).map((id) =>
      id.toLowerCase()
    )
  );
  const counts = getTagCounts(tagConfig, activeTab);
  const sharedDefaultSet = new Set(
    (tagConfig.sharedDefaultTags || []).map((id) => id.toLowerCase())
  );
  const limits = TAG_LIMITS[activeTab];
  const slotFillPercent = Math.min(100, Math.round((counts.enabledCount / limits.maxEnabled) * 100));

  const persistConfig = async (next: UserTagConfig) => {
    setSaving(true);
    try {
      await onSaveTagConfig(sanitizeTagConfig(next));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDefaultTagShared = async (tagId: string) => {
    const normalized = tagId.toLowerCase();
    if (normalized === 'other') return;
    triggerHaptic('single');
    const nextShared = new Set((tagConfig.sharedDefaultTags || []).map((id) => id.toLowerCase()));
    const willShare = !nextShared.has(normalized);
    if (willShare) {
      nextShared.add(normalized);
    } else {
      nextShared.delete(normalized);
    }
    await persistConfig({
      ...tagConfig,
      sharedDefaultTags: Array.from(nextShared),
    });
  };

  const handleToggleCustomTagShared = async (tag: CustomTagDefinition) => {
    triggerHaptic('single');
    const nextCustomTags = tagConfig.customTags.map((c) =>
      c.id === tag.id ? { ...c, shared: !c.shared, updatedAt: new Date().toISOString() } : c
    );
    await persistConfig({
      ...tagConfig,
      customTags: nextCustomTags,
    });
  };

  const handleToggleDefaultTag = async (tagId: string) => {
    const key = activeTab === 'due' ? 'disabledDueTags' : 'disabledPaymentTags';
    const currentDisabled = new Set(
      (activeTab === 'due' ? tagConfig.disabledDueTags : tagConfig.disabledPaymentTags).map((id) =>
        id.toLowerCase()
      )
    );
    const currentlyEnabled = !currentDisabled.has(tagId.toLowerCase());

    if (!currentlyEnabled && counts.enabledCount >= counts.maxEnabled) {
      triggerHaptic('double');
      toast.error(
        isBn
          ? `সর্বোচ্চ ${formatNumber(limits.maxEnabled, 'bn')}টি ট্যাগ একসাথে চালু রাখা যাবে`
          : `Maximum ${limits.maxEnabled} tags can be enabled at a time`
      );
      return;
    }

    triggerHaptic('single');
    if (currentlyEnabled) {
      currentDisabled.add(tagId.toLowerCase());
    } else {
      currentDisabled.delete(tagId.toLowerCase());
    }

    await persistConfig({
      ...tagConfig,
      [key]: Array.from(currentDisabled),
    });
  };

  const handleToggleCustomTag = async (tag: CustomTagDefinition) => {
    if (!tag.enabled && counts.enabledCount >= counts.maxEnabled) {
      triggerHaptic('double');
      toast.error(
        isBn
          ? `সর্বোচ্চ ${formatNumber(limits.maxEnabled, 'bn')}টি ট্যাগ একসাথে চালু রাখা যাবে`
          : `Maximum ${limits.maxEnabled} tags can be enabled at a time`
      );
      return;
    }

    triggerHaptic('single');
    const nextCustomTags = tagConfig.customTags.map((c) =>
      c.id === tag.id ? { ...c, enabled: !c.enabled, updatedAt: new Date().toISOString() } : c
    );
    await persistConfig({
      ...tagConfig,
      customTags: nextCustomTags,
    });
  };

  const handleConfirmDeleteCustomTag = async () => {
    if (!deleteConfirmTag) return;
    const targetId = deleteConfirmTag.id;
    triggerHaptic('double');
    setDeleteConfirmTag(null);
    if (hasDeleteHistoryRef.current && window.history.state?.manageTagsModal === 'delete') {
      hasDeleteHistoryRef.current = false;
      pendingHistoryPopsRef.current += 1;
      window.history.back();
    }
    await persistConfig({
      ...tagConfig,
      customTags: tagConfig.customTags.filter((c) => c.id !== targetId),
    });
    toast.success(isBn ? 'কাস্টম ট্যাগ মুছে ফেলা হয়েছে' : 'Custom tag deleted');
  };

  const openCreateForm = () => {
    if (counts.totalCount >= limits.maxTotal) {
      triggerHaptic('double');
      toast.error(
        isBn
          ? `${activeTab === 'due' ? 'বাকি' : 'আদায়'} ট্যাগে সর্বোচ্চ ${formatNumber(limits.maxTotal, 'bn')}টি ট্যাগ তৈরি করা যাবে`
          : `Maximum ${limits.maxTotal} total ${activeTab} tags allowed`
      );
      return;
    }
    triggerHaptic('single');
    setLogoInfo(null);
    setAutoPickedHex(null);
    pushTagsHistory('draft');
    setDraft({
      id: null,
      type: activeTab,
      name: '',
      color: CUSTOM_TAG_COLORS[customTagsForTab.length % CUSTOM_TAG_COLORS.length],
      iconName: CUSTOM_TAG_ICONS[customTagsForTab.length % CUSTOM_TAG_ICONS.length].id,
      logoDataUrl: null,
      imageOnly: false,
      shared: false,
      enabled: counts.enabledCount < limits.maxEnabled,
    });
  };

  const openEditForm = (tag: CustomTagDefinition) => {
    triggerHaptic('single');
    setLogoInfo(null);
    setAutoPickedHex(null);
    pushTagsHistory('draft');
    setDraft({
      id: tag.id,
      type: tag.type,
      name: tag.name,
      color: tag.color || '#059669',
      iconName: tag.iconName || null,
      logoDataUrl: tag.logoDataUrl || null,
      imageOnly: Boolean(tag.imageOnly && tag.logoDataUrl),
      shared: Boolean(tag.shared),
      enabled: tag.enabled,
    });
  };

  const handleSelectLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !draft) return;

    setOptimizingImg(true);
    try {
      const optimized = await optimizeTagLogoImage(file);
      triggerHaptic('single');
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              logoDataUrl: optimized.dataUrl,
              color: optimized.dominantColor || prev.color,
            }
          : prev
      );
      setAutoPickedHex(optimized.dominantColor || null);
      setLogoInfo({
        byteSize: optimized.byteSize,
        width: optimized.width,
        height: optimized.height,
      });
    } catch (err: any) {
      triggerHaptic('double');
      const code = err?.message || '';
      if (code === 'FILE_TOO_LARGE') {
        toast.error(
          isBn
            ? 'ছবির সাইজ ৫ এমবি-র বেশি হতে পারবে না'
            : 'Image file size must be 5 MB or less'
        );
      } else if (code === 'OUTPUT_TOO_LARGE') {
        toast.error(
          isBn
            ? 'ছবিটি অপ্টিমাইজ করার পরেও বেশি বড়, অনুগ্রহ করে অন্য একটি লোগো দিন'
            : 'Image is still too large after optimization. Please choose a simpler logo.'
        );
      } else {
        toast.error(
          isBn
            ? 'দয়া করে একটি বৈধ ইমেজ ফাইল (PNG, JPG, WebP) নির্বাচন করুন'
            : 'Please select a valid image file (PNG, JPG, WebP)'
        );
      }
    } finally {
      setOptimizingImg(false);
    }
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const trimmedName = draft.name.trim();
    if (!trimmedName) {
      toast.error(isBn ? 'ট্যাগের নাম লিখুন' : 'Please enter a tag name');
      return;
    }

    const nowIso = new Date().toISOString();
    let nextCustomTags: CustomTagDefinition[];

    if (draft.id) {
      nextCustomTags = tagConfig.customTags.map((c) =>
        c.id === draft.id
          ? {
              ...c,
              name: trimmedName,
              color: draft.color,
              iconName: draft.iconName,
              logoDataUrl: draft.logoDataUrl,
              imageOnly: Boolean(draft.imageOnly && draft.logoDataUrl),
              shared: Boolean(draft.shared),
              enabled: draft.enabled,
              updatedAt: nowIso,
            }
          : c
      );
    } else {
      if (counts.totalCount >= limits.maxTotal) {
        toast.error(
          isBn
            ? `সর্বোচ্চ ${formatNumber(limits.maxTotal, 'bn')}টি ট্যাগের সীমা পূর্ণ হয়েছে`
            : `Total limit of ${limits.maxTotal} tags reached`
        );
        return;
      }

      const canEnable = counts.enabledCount < limits.maxEnabled;
      const shouldEnable = draft.enabled && canEnable;
      const uniqueId = `custom_${draft.type}_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 6)}`;

      nextCustomTags = [
        ...tagConfig.customTags,
        {
          id: uniqueId,
          type: draft.type,
          name: trimmedName,
          color: draft.color,
          iconName: draft.iconName,
          logoDataUrl: draft.logoDataUrl,
          imageOnly: Boolean(draft.imageOnly && draft.logoDataUrl),
          shared: Boolean(draft.shared),
          enabled: shouldEnable,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ];

      if (draft.enabled && !canEnable) {
        toast.info(
          isBn
            ? 'সক্রিয় সীমা পূর্ণ থাকায় ট্যাগটি নিষ্ক্রিয় অবস্থায় সংরক্ষণ করা হয়েছে'
            : `Saved as disabled because max ${limits.maxEnabled} enabled tags are active`
        );
      }
    }

    triggerHaptic('double');
    await persistConfig({
      ...tagConfig,
      customTags: nextCustomTags,
    });
    closeDraftToManageList();
    toast.success(
      draft.id
        ? isBn
          ? 'ট্যাগ আপডেট হয়েছে'
          : 'Tag updated'
        : isBn
        ? 'নতুন কাস্টম ট্যাগ সংরক্ষিত হয়েছে'
        : 'Custom tag created'
    );
  };

  const handleResetDefaults = async () => {
    triggerHaptic('single');
    if (activeTab === 'due') {
      await persistConfig({ ...tagConfig, disabledDueTags: [] });
    } else {
      await persistConfig({ ...tagConfig, disabledPaymentTags: [] });
    }
    toast.success(isBn ? 'ডিফল্ট ট্যাগগুলো চালু করা হয়েছে' : 'Default tags re-enabled');
  };

  const isPresetMatched = draft
    ? CUSTOM_TAG_COLORS.some((hex) => hex.toLowerCase() === draft.color.toLowerCase())
    : true;

  return (
    <ModalPortal lockScroll={true}>
      <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden overscroll-none">
        <div
          onClick={() => {
            if (saving || optimizingImg) return;
            if (deleteConfirmTag) {
              setDeleteConfirmTag(null);
              if (hasDeleteHistoryRef.current && window.history.state?.manageTagsModal === 'delete') {
                hasDeleteHistoryRef.current = false;
                pendingHistoryPopsRef.current += 1;
                window.history.back();
              }
              return;
            }
            closeModalCleanly();
          }}
          className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
        />

        <div
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={isBn ? 'ট্যাগ পরিচালনা' : 'Manage Tags'}
          className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-xl rounded-t-[2rem] sm:rounded-3xl border shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden"
        >
          {/* Mobile Handle */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
            <div className="w-10 h-1 bg-slate-400/40 dark:bg-white/20 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-5 py-3.5 sm:py-4 border-b border-slate-900/[0.06] dark:border-white/[0.06] flex items-center justify-between shrink-0 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {draft ? (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('tick');
                    closeDraftToManageList();
                  }}
                  aria-label={isBn ? 'ফিরে যান' : 'Back to tags'}
                  className="w-9 h-9 rounded-full surface-subcard border flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.1] transition-colors cursor-pointer shrink-0 touch-press"
                >
                  <ArrowLeft className="w-4 h-4 stroke-[1.75]" />
                </button>
              ) : (
                <div
                  className="w-9 h-9 rounded-2xl surface-subcard border flex items-center justify-center shrink-0"
                  aria-hidden="true"
                >
                  <GraphStar className="w-4.5 h-4.5 stroke-[1.6] text-slate-950 dark:text-white" />
                </div>
              )}

              <div className="min-w-0">
                <h3 className="font-display text-base sm:text-lg font-bold text-slate-950 dark:text-white tracking-tight truncate">
                  {draft
                    ? draft.id
                      ? isBn
                        ? 'কাস্টম ট্যাগ সম্পাদনা'
                        : 'Edit Custom Tag'
                      : isBn
                      ? `নতুন ${draft.type === 'due' ? 'বাকি' : 'আদায়'} ট্যাগ`
                      : `New ${draft.type === 'due' ? 'Due' : 'Payment'} Tag`
                    : isBn
                    ? 'ট্যাগ পরিচালনা'
                    : 'Manage Tags'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {draft
                    ? isBn
                      ? 'নাম, ব্র্যান্ড লোগো ও রঙ নির্ধারণ করুন'
                      : 'Set label, brand logo & chart accent color'
                    : isBn
                    ? 'ডিফল্ট ট্যাগ চালু/বন্ধ করুন ও কাস্টম লোগো সাজান'
                    : 'Toggle defaults, create custom tags & upload logos'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                closeModalCleanly();
              }}
              className="w-9 h-9 rounded-full bg-slate-900/[0.05] hover:bg-slate-900/[0.1] dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer shrink-0 touch-press"
              aria-label="Close"
            >
              <X className="w-4 h-4 stroke-[1.5]" />
            </button>
          </div>

          {/* Segmented Switcher, Capacity Meter & Search Bar */}
          {!draft && (
            <div className="px-5 pt-3.5 pb-3 border-b border-slate-900/[0.06] dark:border-white/[0.06] space-y-3 shrink-0">
              <div className="relative grid grid-cols-2 p-1 rounded-full bg-slate-900/[0.05] dark:bg-white/[0.05] border border-slate-900/[0.08] dark:border-white/[0.09]">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-slate-950 dark:bg-white shadow-sm will-change-transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{
                    transform: `translate3d(${activeTab === 'payment' ? '100%' : '0%'}, 0, 0)`,
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('tick');
                    setActiveTab('due');
                  }}
                  className={`relative z-10 py-2 px-3 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                    activeTab === 'due'
                      ? 'text-white dark:text-slate-950'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {isBn ? 'বাকি ট্যাগ (Due)' : 'Due Tags'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('tick');
                    setActiveTab('payment');
                  }}
                  className={`relative z-10 py-2 px-3 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                    activeTab === 'payment'
                      ? 'text-white dark:text-slate-950'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {isBn ? 'আদায় ট্যাগ (Payment)' : 'Payment Tags'}
                </button>
              </div>

              {/* Tabular-nums Capacity Readout + Hairline Bar */}
              <div className="space-y-1.5 px-0.5">
                <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  <span>
                    {isBn ? 'সক্রিয়' : 'Enabled'}:{' '}
                    <strong
                      className={
                        counts.enabledCount >= limits.maxEnabled
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-950 dark:text-white'
                      }
                    >
                      {formatNumber(counts.enabledCount, lang)} / {formatNumber(limits.maxEnabled, lang)}
                    </strong>
                  </span>
                  <span>
                    {isBn ? 'মোট স্লট' : 'Total Slots'}:{' '}
                    <strong
                      className={
                        counts.totalCount >= limits.maxTotal
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-950 dark:text-white'
                      }
                    >
                      {formatNumber(counts.totalCount, lang)} / {formatNumber(limits.maxTotal, lang)}
                    </strong>
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-900/[0.06] dark:bg-white/[0.07] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: `${slotFillPercent}%`,
                      backgroundColor:
                        counts.enabledCount >= limits.maxEnabled ? '#F59E0B' : 'var(--accent-color)',
                    }}
                  />
                </div>
              </div>

              {/* Quick Filter Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 stroke-[1.75] text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isBn ? 'ট্যাগের নাম দিয়ে খুঁজুন...' : 'Filter tags by name...'}
                  className="w-full pl-9 pr-9 py-2 rounded-2xl border border-slate-900/[0.08] dark:border-white/[0.09] bg-slate-900/[0.03] dark:bg-white/[0.04] text-xs font-medium text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/35 transition-shadow"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label={isBn ? 'খোঁজা মুছুন' : 'Clear search'}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5 stroke-[1.75]" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Scrollable Body */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain hide-scrollbar p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-5">
            {draft ? (
              <form onSubmit={handleSaveDraft} className="space-y-4">
                {/* Live Preview */}
                <div className="surface-subcard border rounded-2xl p-3.5 flex items-center justify-between gap-3">
                  <span className={isBn ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400' : 'micro-mono-label font-semibold'}>
                    {isBn ? 'ট্যাগ প্রিভিউ' : 'Tag Preview'}
                  </span>
                  <div className="px-3.5 py-1.5 rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-xs max-w-[65%]">
                    {draft.logoDataUrl ? (
                      <img
                        src={draft.logoDataUrl}
                        alt={draft.name || 'Tag'}
                        className={
                          draft.imageOnly
                            ? 'h-4 w-auto max-w-[52px] object-contain rounded-xs shrink-0'
                            : 'w-4 h-4 object-contain rounded-xs shrink-0'
                        }
                        draggable={false}
                      />
                    ) : (
                      (() => {
                        const PreviewIcon = getCustomTagIconComponent(draft.iconName);
                        return <PreviewIcon className="w-3.5 h-3.5 shrink-0" style={{ color: draft.color }} />;
                      })()
                    )}
                    {!(draft.imageOnly && draft.logoDataUrl) && (
                      <span className="truncate">{draft.name.trim() || (isBn ? 'ট্যাগের নাম' : 'Tag Name')}</span>
                    )}
                  </div>
                </div>

                {/* Tag Name Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-0.5">
                    <label
                      htmlFor="custom_tag_name_input"
                      className={isBn ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400' : 'micro-mono-label font-semibold'}
                    >
                      {isBn ? 'ট্যাগের নাম *' : 'Tag Name *'}
                    </label>
                    <span className="text-[10px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                      {formatNumber(draft.name.length, lang)}/{formatNumber(32, lang)}
                    </span>
                  </div>
                  <input
                    id="custom_tag_name_input"
                    type="text"
                    required
                    maxLength={32}
                    placeholder={isBn ? 'যেমন: বিকাশ, পাঠাও, কফি' : 'e.g. bKash, Pathao, Coffee'}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-900/[0.09] dark:border-white/[0.1] bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-950 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/40 transition-shadow"
                  />
                </div>

                {/* Logo or Icon Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-0.5">
                    <span className={isBn ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400' : 'micro-mono-label font-semibold'}>
                      {isBn ? 'আইকন বা লোগো' : 'Icon or Logo'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                      {draft.logoDataUrl
                        ? (isBn ? 'সর্বোচ্চ ৫ এমবি' : 'Max 5MB')
                        : draft.iconName || ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-3.5 p-3.5 rounded-2xl surface-subcard border">
                    {/* Colored Icon / Logo Preview Tile with Edit Trigger */}
                    <button
                      type="button"
                      onClick={openIconPicker}
                      title={isBn ? 'আইকন পরিবর্তন করুন' : 'Change icon'}
                      aria-label={isBn ? 'আইকন পরিবর্তন করুন' : 'Change icon'}
                      className="relative w-14 h-14 rounded-2xl border border-slate-900/[0.08] dark:border-white/[0.09] bg-white/70 dark:bg-white/[0.04] flex items-center justify-center shrink-0 cursor-pointer touch-press group"
                    >
                      {draft.logoDataUrl ? (
                        <img
                          src={draft.logoDataUrl}
                          alt="Logo preview"
                          className="w-9 h-9 object-contain"
                          draggable={false}
                        />
                      ) : (
                        (() => {
                          const DraftIcon = getCustomTagIconComponent(draft.iconName);
                          return <DraftIcon className="w-5 h-5 stroke-[1.5]" style={{ color: draft.color }} />;
                        })()
                      )}
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 border border-white/80 dark:border-zinc-900 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform"
                      >
                        <Pencil className="w-2.5 h-2.5 stroke-[2]" />
                      </span>
                    </button>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={optimizingImg}
                          onClick={() => fileInputRef.current?.click()}
                          className="h-9 px-3.5 rounded-full bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 touch-press"
                        >
                          <ImagePlus className="w-3.5 h-3.5 stroke-[1.6]" />
                          <span>
                            {optimizingImg
                              ? isBn
                                ? 'প্রসেস হচ্ছে...'
                                : 'Optimizing...'
                              : draft.logoDataUrl
                              ? isBn
                                ? 'লোগো পরিবর্তন'
                                : 'Change Image'
                              : isBn
                              ? 'ছবি আপলোড'
                              : 'Upload Image'}
                          </span>
                        </button>

                        {draft.logoDataUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setDraft({ ...draft, logoDataUrl: null, imageOnly: false });
                              setLogoInfo(null);
                              setAutoPickedHex(null);
                            }}
                            className="h-9 px-3 rounded-full bg-rose-500/10 hover:bg-rose-500/18 text-rose-600 dark:text-rose-400 text-xs font-semibold cursor-pointer transition-colors"
                          >
                            {isBn ? 'মুছুন' : 'Remove'}
                          </button>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {logoInfo
                          ? `${logoInfo.width}×${logoInfo.height}px · ${(logoInfo.byteSize / 1024).toFixed(1)} KB`
                          : draft.logoDataUrl
                          ? isBn
                            ? 'কাস্টম লোগো যুক্ত আছে'
                            : 'Custom logo attached'
                          : isBn
                          ? 'আইকন বদলাতে বামে ট্যাপ করুন, বা ছবি আপলোড করুন'
                          : 'Tap the icon to change, or upload a custom logo'}
                      </p>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                      onChange={handleSelectLogoFile}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Show Image Only Toggle */}
                {draft.logoDataUrl && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draft.imageOnly}
                    onClick={() => {
                      triggerHaptic('single');
                      setDraft({ ...draft, imageOnly: !draft.imageOnly });
                    }}
                    className={`w-full p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                      draft.imageOnly
                        ? 'bg-emerald-500/10 border-emerald-500/40'
                        : 'surface-subcard hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                        <EyeOff className="w-3.5 h-3.5 stroke-[1.5]" />
                        <span>
                          {isBn ? 'ট্যাগ বাটনে শুধু ছবি দেখান' : 'Show Image Only in Tag Section'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {isBn
                          ? 'নাম সংরক্ষিত থাকবে, কিন্তু ট্যাগ বাছাই করার তালিকায় লেখা দেখাবে না'
                          : 'Name stays saved while hiding text beside logos with built-in wordmarks'}
                      </p>
                    </div>
                    <div
                      className={`w-11 h-6 shrink-0 flex items-center rounded-full p-0.5 transition-colors ${
                        draft.imageOnly ? 'bg-emerald-600' : 'bg-slate-900/15 dark:bg-white/15'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                          draft.imageOnly ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </button>
                )}

                {/* Shared Tag Toggle (Available in Both Due & Payment) */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.shared}
                  onClick={() => {
                    triggerHaptic('single');
                    setDraft({ ...draft, shared: !draft.shared });
                  }}
                  className={`w-full p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                    draft.shared
                      ? 'bg-emerald-500/10 border-emerald-500/40'
                      : 'surface-subcard hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                      <Link className="w-3.5 h-3.5 stroke-[1.5]" />
                      <span>
                        {isBn ? 'বাকি ও আদায় উভয় ক্ষেত্রে শেয়ার করুন' : 'Share in Both Due & Payment'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      {isBn
                        ? 'একবার তৈরি করেই বাকি এবং আদায় দুই তালিকায় ব্যবহার করুন'
                        : 'Use this same tag in both Due and Payment pickers without creating it twice'}
                    </p>
                  </div>
                  <div
                    className={`w-11 h-6 shrink-0 flex items-center rounded-full p-0.5 transition-colors ${
                      draft.shared ? 'bg-emerald-600' : 'bg-slate-900/15 dark:bg-white/15'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                        draft.shared ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </button>

                {/* Accent Color Picker (Auto-picked from image, adjustable manually) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 px-0.5">
                    <span className={isBn ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400' : 'micro-mono-label font-semibold'}>
                      {isBn ? 'ট্যাগের অ্যাকসেন্ট রঙ' : 'Accent Color'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                      {autoPickedHex && autoPickedHex.toLowerCase() === draft.color.toLowerCase()
                        ? `${isBn ? 'ছবি থেকে স্বয়ংক্রিয়' : 'Auto-picked'} · ${draft.color}`
                        : draft.color}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-2xl surface-subcard border">
                    {!isPresetMatched && (
                      <button
                        type="button"
                        onClick={() => triggerHaptic('tick')}
                        className="w-8 h-8 rounded-full flex items-center justify-center border border-white scale-110 ring-2 ring-slate-950 dark:ring-white cursor-pointer"
                        style={{ backgroundColor: draft.color }}
                        aria-label={`Selected color ${draft.color}`}
                        title={draft.color}
                      >
                        <Check className="w-3.5 h-3.5 text-white stroke-[2.5] drop-shadow-xs" />
                      </button>
                    )}

                    {CUSTOM_TAG_COLORS.map((hex) => {
                      const active = draft.color.toLowerCase() === hex.toLowerCase();
                      return (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => {
                            triggerHaptic('tick');
                            setDraft({ ...draft, color: hex });
                          }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center border transition-transform cursor-pointer ${
                            active
                              ? 'scale-110 ring-2 ring-slate-950 dark:ring-white border-white'
                              : 'border-black/15 dark:border-white/20 hover:scale-105'
                          }`}
                          style={{ backgroundColor: hex }}
                          aria-label={`Color ${hex}`}
                        >
                          {active && <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />}
                        </button>
                      );
                    })}
                    <label
                      className="relative w-8 h-8 rounded-full border border-slate-900/15 dark:border-white/25 bg-white/80 dark:bg-white/10 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
                      title={isBn ? 'কাস্টম রঙ' : 'Custom color'}
                    >
                      <input
                        type="color"
                        value={draft.color}
                        onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                      <Pipette className="w-3.5 h-3.5 text-slate-700 dark:text-slate-200" />
                    </label>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('tick');
                      closeDraftToManageList();
                    }}
                    className="flex-1 h-11 rounded-full surface-subcard border text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.08] transition-colors"
                  >
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={saving || optimizingImg || !draft.name.trim()}
                    className="flex-1 h-11 rounded-full bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 text-xs font-bold cursor-pointer disabled:opacity-45 touch-press transition-colors"
                  >
                    {saving
                      ? isBn
                        ? 'সংরক্ষণ হচ্ছে...'
                        : 'Saving...'
                      : draft.id
                      ? isBn
                        ? 'পরিবর্তন সংরক্ষণ'
                        : 'Save Changes'
                      : isBn
                      ? 'ট্যাগ তৈরি করুন'
                      : 'Create Tag'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* Custom Tags Section */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 px-0.5">
                    <span className={isBn ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400' : 'micro-mono-label font-semibold'}>
                      {isBn ? 'কাস্টম ট্যাগ' : 'Custom Tags'} ({formatNumber(customTagsForTab.length, lang)})
                    </span>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={openCreateForm}
                      className="h-9 px-3.5 rounded-full bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors touch-press disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2]" />
                      <span>{isBn ? 'নতুন ট্যাগ' : 'Create Tag'}</span>
                    </button>
                  </div>

                  {counts.totalCount >= limits.maxTotal && (
                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-800 dark:text-amber-200 flex items-center gap-2 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {isBn
                          ? `মোট ${formatNumber(limits.maxTotal, 'bn')}টি ট্যাগের সর্বোচ্চ সীমা পূর্ণ হয়েছে। নতুন যোগ করতে একটি কাস্টম ট্যাগ মুছুন।`
                          : `Maximum ${limits.maxTotal} total tags reached for this type. Delete a custom tag to add another.`}
                      </span>
                    </div>
                  )}

                  {customTagsForTab.length === 0 ? (
                    <div className="p-5 rounded-2xl surface-subcard border flex flex-col items-center text-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-slate-900/[0.04] dark:bg-white/[0.06] border border-slate-900/[0.06] dark:border-white/[0.08] flex items-center justify-center text-slate-950 dark:text-white">
                        <GraphStar className="w-4.5 h-4.5 stroke-[1.5]" />
                      </div>
                      <div className="space-y-0.5 max-w-xs">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {isBn ? 'কোনো কাস্টম ট্যাগ নেই' : 'No custom tags yet'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isBn
                            ? 'ব্র্যান্ড লোগো ও আলাদা রঙ দিয়ে আপনার নিজস্ব ট্যাগ তৈরি করুন।'
                            : 'Create custom tags with brand logos and auto-matched accent colors.'}
                        </p>
                      </div>
                      {counts.totalCount < limits.maxTotal && (
                        <button
                          type="button"
                          onClick={openCreateForm}
                          className="h-9 px-4 rounded-full surface-glass-interactive border text-xs font-bold text-slate-900 dark:text-white inline-flex items-center gap-1.5 cursor-pointer touch-press"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2]" />
                          <span>{isBn ? 'প্রথম ট্যাগ তৈরি করুন' : 'Create First Tag'}</span>
                        </button>
                      )}
                    </div>
                  ) : filteredCustomTags.length === 0 ? (
                    <div className="p-4 rounded-2xl surface-subcard border text-center text-xs text-slate-500 dark:text-slate-400">
                      {isBn ? 'খোঁজা অনুযায়ী কোনো কাস্টম ট্যাগ মেলেনি' : 'No matching custom tags'}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-900/[0.06] dark:divide-white/[0.06] surface-subcard border rounded-2xl overflow-hidden">
                      {filteredCustomTags.map((tag) => {
                        const modeLabel =
                          tag.imageOnly && tag.logoDataUrl
                            ? isBn
                              ? 'শুধু লোগো'
                              : 'Image-only chip'
                            : tag.logoDataUrl
                            ? isBn
                              ? 'লোগো + নাম'
                              : 'Logo + Name'
                            : isBn
                            ? 'কাস্টম'
                            : 'Custom';
                        return (
                          <div
                            key={tag.id}
                            className={`px-3.5 py-3 flex items-center justify-between gap-3 transition-opacity ${
                              tag.enabled ? 'opacity-100' : 'opacity-65'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl border border-slate-900/[0.08] dark:border-white/[0.1] bg-white/75 dark:bg-white/[0.05] flex items-center justify-center shrink-0 overflow-hidden p-0.5">
                                {tag.logoDataUrl ? (
                                  <img
                                    src={tag.logoDataUrl}
                                    alt={tag.name}
                                    className="w-6 h-6 object-contain"
                                    draggable={false}
                                  />
                                ) : (
                                  (() => {
                                    const TagCustomIcon = getCustomTagIconComponent(tag.iconName);
                                    return <TagCustomIcon className="w-4 h-4 stroke-[1.6]" style={{ color: tag.color }} />;
                                  })()
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-950 dark:text-white truncate">
                                  {tag.name}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  <span>{modeLabel}</span>
                                  {tag.shared && (
                                    <>
                                      {' · '}
                                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                        {isBn ? 'শেয়ার্ড' : 'Shared'}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => handleToggleCustomTagShared(tag)}
                                className={`w-7 h-7 flex items-center justify-center cursor-pointer transition-colors bg-transparent ${
                                  tag.shared
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                                }`}
                                title={isBn ? 'বাকি ও আদায় উভয়ে শেয়ার করুন' : 'Share in both Due & Payment'}
                                aria-label={`Share ${tag.name} in both Due and Payment`}
                                aria-pressed={Boolean(tag.shared)}
                              >
                                <Link className="w-3.5 h-3.5 stroke-[1.75]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditForm(tag)}
                                className="w-9 h-9 rounded-full hover:bg-slate-900/[0.07] dark:hover:bg-white/[0.1] flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
                                title={isBn ? 'সম্পাদনা' : 'Edit'}
                                aria-label={`Edit ${tag.name}`}
                              >
                                <Pencil className="w-3.5 h-3.5 stroke-[1.6]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic('single');
                                  pushTagsHistory('delete');
                                  setDeleteConfirmTag(tag);
                                }}
                                className="w-9 h-9 rounded-full hover:bg-rose-500/12 flex items-center justify-center text-rose-600 dark:text-rose-400 cursor-pointer transition-colors"
                                title={isBn ? 'মুছুন' : 'Delete'}
                                aria-label={`Delete ${tag.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5 stroke-[1.6]" />
                              </button>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={tag.enabled}
                                aria-label={tag.name}
                                disabled={saving}
                                onClick={() => handleToggleCustomTag(tag)}
                                className={`w-10 h-6 shrink-0 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ml-1 ${
                                  tag.enabled
                                    ? 'bg-slate-950 dark:bg-white'
                                    : 'bg-slate-900/15 dark:bg-white/15'
                                }`}
                              >
                                <div
                                  className={`w-5 h-5 rounded-full shadow-xs transition-transform ${
                                    tag.enabled
                                      ? 'translate-x-4 bg-white dark:bg-slate-950'
                                      : 'translate-x-0 bg-white dark:bg-slate-200'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Default Tags Section */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 px-0.5">
                    <span className={isBn ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400' : 'micro-mono-label font-semibold'}>
                      {isBn ? 'ডিফল্ট ট্যাগসমূহ' : 'Default Tags'} ({formatNumber(defaultTags.length, lang)})
                    </span>
                    {disabledIds.size > 0 && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleResetDefaults}
                        className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <RotateCcw className="w-3 h-3 stroke-[1.6]" />
                        <span>{isBn ? 'সব চালু করুন' : 'Enable All'}</span>
                      </button>
                    )}
                  </div>

                  {filteredDefaultTags.length === 0 ? (
                    <div className="p-4 rounded-2xl surface-subcard border text-center text-xs text-slate-500 dark:text-slate-400">
                      {isBn ? 'খোঁজা অনুযায়ী কোনো ডিফল্ট ট্যাগ মেলেনি' : 'No matching default tags'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredDefaultTags.map((item) => {
                        const isEnabled = !disabledIds.has(item.id.toLowerCase());
                        const isShared = sharedDefaultSet.has(item.id.toLowerCase());
                        const canShare = item.id !== 'other';
                        const IconComp = item.icon;
                        return (
                          <div
                            key={item.id}
                            onClick={() => !saving && handleToggleDefaultTag(item.id)}
                            role="switch"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if ((e.key === 'Enter' || e.key === ' ') && !saving) {
                                e.preventDefault();
                                handleToggleDefaultTag(item.id);
                              }
                            }}
                            aria-checked={isEnabled}
                            aria-disabled={saving}
                            className={`p-3 rounded-2xl border flex items-center justify-between gap-2 text-left transition-colors cursor-pointer touch-press ${
                              isEnabled
                                ? 'surface-subcard hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06]'
                                : 'bg-slate-900/[0.015] dark:bg-white/[0.015] border-slate-900/[0.05] dark:border-white/[0.05] opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-white/75 dark:bg-white/[0.06] border border-slate-900/[0.07] dark:border-white/[0.08] flex items-center justify-center shrink-0">
                                <IconComp className="w-4 h-4 stroke-[1.6]" style={{ color: item.color }} />
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-slate-950 dark:text-white truncate block">
                                  {isBn ? item.bn : item.en}
                                </span>
                                {canShare && isShared && (
                                  <span className="text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 block leading-tight">
                                    {isBn ? 'শেয়ার্ড' : 'Shared'}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {canShare && (
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleDefaultTagShared(item.id);
                                  }}
                                  title={isBn ? 'বাকি ও আদায় উভয়ে শেয়ার করুন' : 'Share in both Due & Payment'}
                                  aria-label={`Share ${item.en} in both Due and Payment`}
                                  aria-pressed={isShared}
                                  className={`w-7 h-7 flex items-center justify-center cursor-pointer transition-colors bg-transparent ${
                                    isShared
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                                  }`}
                                >
                                  <Link className="w-3.5 h-3.5 stroke-[1.75]" />
                                </button>
                              )}

                              <div
                                className={`w-10 h-6 shrink-0 flex items-center rounded-full p-0.5 transition-colors ${
                                  isEnabled
                                    ? 'bg-slate-950 dark:bg-white'
                                    : 'bg-slate-900/15 dark:bg-white/15'
                                }`}
                              >
                                <div
                                  className={`w-5 h-5 rounded-full shadow-xs transition-transform ${
                                    isEnabled
                                      ? 'translate-x-4 bg-white dark:bg-slate-950'
                                      : 'translate-x-0 bg-white dark:bg-slate-200'
                                  }`}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Delete Confirmation Overlay */}
          {deleteConfirmTag && (
            <div
              onClick={() => {
                setDeleteConfirmTag(null);
                if (hasDeleteHistoryRef.current && window.history.state?.manageTagsModal === 'delete') {
                  hasDeleteHistoryRef.current = false;
                  pendingHistoryPopsRef.current += 1;
                  window.history.back();
                }
              }}
              className="absolute inset-0 z-20 bg-slate-950/50 dark:bg-black/65 backdrop-blur-xs flex items-center justify-center p-5 animate-backdrop-blur"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                role="alertdialog"
                aria-modal="true"
                className="w-full max-w-sm rounded-3xl glass-modal border shadow-2xl p-5 space-y-4 text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-rose-500/12 border border-rose-500/25 mx-auto flex items-center justify-center text-rose-600 dark:text-rose-400">
                  {deleteConfirmTag.logoDataUrl ? (
                    <img
                      src={deleteConfirmTag.logoDataUrl}
                      alt={deleteConfirmTag.name}
                      className="w-7 h-7 object-contain"
                      draggable={false}
                    />
                  ) : (
                    <Trash2 className="w-5 h-5 stroke-[1.75]" />
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="font-display text-base font-bold text-slate-950 dark:text-white">
                    {isBn ? 'কাস্টম ট্যাগ মুছে ফেলবেন?' : 'Delete custom tag?'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {isBn
                      ? `আপনি কি নিশ্চিত "${deleteConfirmTag.name}" ট্যাগটি মুছতে চান? নতুন লেনদেনের তালিকায় এটি আর দেখা যাবে না।`
                      : `Are you sure you want to delete "${deleteConfirmTag.name}"? This removes it from your tag picker and cannot be undone.`}
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setDeleteConfirmTag(null);
                      if (hasDeleteHistoryRef.current && window.history.state?.manageTagsModal === 'delete') {
                        hasDeleteHistoryRef.current = false;
                        pendingHistoryPopsRef.current += 1;
                        window.history.back();
                      }
                    }}
                    className="flex-1 h-10 rounded-full surface-subcard border text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.08] transition-colors"
                  >
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleConfirmDeleteCustomTag}
                    className="flex-1 h-10 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-sm touch-press"
                  >
                    {isBn ? 'হ্যাঁ, মুছুন' : 'Delete Tag'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Native Icon Library Modal (monochrome icons; colored preview appears only in the tag editor) */}
      {isIconPickerOpen && draft && (
        <ModalPortal lockScroll={true}>
          <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden overscroll-none">
            <div
              onClick={closeIconPicker}
              className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-sm animate-backdrop-blur"
            />

            <div
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={isBn ? 'আইকন বাছাই করুন' : 'Choose Tag Icon'}
              className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl border shadow-2xl max-h-[80dvh] flex flex-col overflow-hidden"
            >
              <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
                <div className="w-10 h-1 bg-slate-400/40 dark:bg-white/20 rounded-full" />
              </div>

              <div className="px-5 py-3.5 border-b border-slate-900/[0.07] dark:border-white/[0.08] flex items-center justify-between gap-3 shrink-0">
                <div className="min-w-0">
                  <span className={isBn ? 'text-[10px] font-bold text-slate-500 dark:text-slate-400 block' : 'micro-mono-label font-semibold block'}>
                    {isBn ? 'নেটিভ আইকন লাইব্রেরি' : 'Native Icon Library'}
                  </span>
                  <h3 className="font-display text-base sm:text-lg font-bold text-slate-950 dark:text-white tracking-tight truncate">
                    {isBn ? 'একটি আইকন নির্বাচন করুন (৫০টি)' : 'Choose an Icon (50)'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeIconPicker}
                  aria-label="Close icon library"
                  className="w-8 h-8 rounded-full surface-subcard border flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white cursor-pointer transition-colors shrink-0"
                >
                  <X className="w-4 h-4 stroke-[1.75]" />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain hide-scrollbar p-4 sm:p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                  {CUSTOM_TAG_ICONS.map(({ id: iconId, icon: IconItem, label }) => {
                    const isSelected = !draft.logoDataUrl && draft.iconName === iconId;
                    return (
                      <button
                        key={iconId}
                        type="button"
                        onClick={() => {
                          triggerHaptic('tick');
                          setDraft({
                            ...draft,
                            iconName: iconId,
                            logoDataUrl: null,
                            imageOnly: false,
                          });
                          setLogoInfo(null);
                          setAutoPickedHex(null);
                          closeIconPicker();
                        }}
                        title={label}
                        aria-label={`Select ${label} icon`}
                        className={`h-12 rounded-2xl flex items-center justify-center border transition-all cursor-pointer touch-press ${
                          isSelected
                            ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 border-slate-950 dark:border-white shadow-sm'
                            : 'surface-subcard hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.08] text-slate-950 dark:text-white'
                        }`}
                      >
                        <IconItem className="w-5 h-5 stroke-[1.6]" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </ModalPortal>
  );
};

export default ManageTagsModal;
