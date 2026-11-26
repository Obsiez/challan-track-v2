import React, { useState, useMemo } from 'react';
import { Customer, Transaction } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Search, UserPlus, Check, ArrowDownLeft, ArrowUpRight, ChevronLeft, AlertTriangle, Delete, BookUser, CreditCard, Users, Calendar
} from 'lucide-react';
import { translations, formatNumber, formatIndianNumberString, Language } from '../lib/translations';
import { triggerHaptic } from '../lib/haptics';
import { toast } from 'sonner';
import { getPhoneticKey, matchesPhonetic, isPhoneticSearchEnabled } from '../lib/phonetics';
import ContactNumberPickerModal from './ContactNumberPickerModal';
import { cleanBangladeshiPhone } from '../lib/phoneUtils';
import ModalPortal, { useModalScrollLock } from './ModalPortal';
import LoadingSpinner from './LoadingSpinner';
import { TagPickerBar, getTagDefaultDescription } from '../lib/tagSystem';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

interface QuickEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  transactions: Transaction[];
  createCustomer: (
    name: string,
    phone: string,
    options?: { accountType?: 'standard' | 'credit_card'; billingDay?: number; photoUrl?: string | null }
  ) => Promise<string | null | undefined>;
  addTransaction: (
    customerId: string, 
    type: 'due' | 'payment', 
    amount: number, 
    description: string,
    date?: Date,
    fallbackCustomerInfo?: { name: string; phone: string; accountType?: 'standard' | 'credit_card'; billingDay?: number },
    tag?: string
  ) => Promise<void>;
  preselectedCustomerId?: string;
  onViewCustomer?: (id: string, replace?: boolean) => void;
  lang: Language;
  highlightedTxId?: string | null;
  setHighlightedTxId?: (id: string | null) => void;
}

export default function QuickEntryModal(props: QuickEntryModalProps) {
  if (!props.isOpen) return null;
  return <QuickEntryModalInner {...props} />;
}

function QuickEntryModalInner({
  onClose,
  customers,
  transactions,
  createCustomer,
  addTransaction,
  preselectedCustomerId,
  onViewCustomer,
  lang,
  setHighlightedTxId = () => {}
}: QuickEntryModalProps) {
 const t = translations[lang];

  const submitBtnRef = React.useRef<HTMLButtonElement>(null);
  const formScrollRef = React.useRef<HTMLDivElement>(null);
  const [type, setType] = useState<'due' | 'payment'>('due');
  const [duplicateTxWarning, setDuplicateTxWarning] = useState<Transaction | null>(null);
  const [hasShownDuplicateWarning, setHasShownDuplicateWarning] = useState(false);

 const [searchQuery, setSearchQuery] = useState('');
 const [searchBanglaInEnglish, setSearchBanglaInEnglish] = useState(() => isPhoneticSearchEnabled());

 React.useEffect(() => {
   const handleToggle = (e: any) => {
     if (e.detail?.enabled !== undefined) {
       setSearchBanglaInEnglish(e.detail.enabled);
     }
   };
   const handleStorage = (e: StorageEvent) => {
     if (e.key === 'search_bangla_in_english' || !e.key) {
       setSearchBanglaInEnglish(isPhoneticSearchEnabled());
     }
   };
   window.addEventListener('phonetic-search-toggle', handleToggle);
   window.addEventListener('storage', handleStorage);
   return () => {
     window.removeEventListener('phonetic-search-toggle', handleToggle);
     window.removeEventListener('storage', handleStorage);
   };
 }, []);
 const [selectedCustomerId, setSelectedCustomerId] = useState(preselectedCustomerId || '');
 const [customerNameInput, setCustomerNameInput] = useState('');
 const [customerPhoneInput, setCustomerPhoneInput] = useState('');
 const [newAccountType, setNewAccountType] = useState<'standard' | 'credit_card'>('standard');
 const [newBillingDay, setNewBillingDay] = useState<string>('');
 const [pendingContactChoice, setPendingContactChoice] = useState<{
   contactName: string;
   numbers: string[];
   onSelect: (number: string) => void;
 } | null>(null);
 const [showAddNewCustomer, setShowAddNewCustomer] = useState(false);
 const [showAllCustomers, setShowAllCustomers] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [paymentQuickFillIntent, setPaymentQuickFillIntent] = useState<'billed' | 'total' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isCreditCardContext = useMemo(() => {
    if (showAddNewCustomer) return newAccountType === 'credit_card';
    if (!selectedCustomerId) return false;
    const found = customers.find(c => c.id === selectedCustomerId);
    return found?.accountType === 'credit_card';
  }, [showAddNewCustomer, newAccountType, selectedCustomerId, customers]);

 // Frozen snapshot of customer ID -> rank captured once at modal mount (O(N log N) precomputed timestamps)
 const [frozenCustomerRankMap] = useState<Map<string, number>>(() => {
   const entries = customers.map((c) => {
     const d = c.updatedAt ?? c.createdAt;
     const ts = d instanceof Date ? d.getTime() : d ? new Date(d as any).getTime() : 0;
     return { id: c.id, ts: Number.isNaN(ts) ? 0 : ts };
   });
   entries.sort((a, b) => b.ts - a.ts);
   const rankMap = new Map<string, number>();
   entries.forEach((entry, idx) => rankMap.set(entry.id, idx));
   return rankMap;
 });

 useModalScrollLock(true);

 React.useEffect(() => {
   const handleEsc = (e: KeyboardEvent) => {
     if (e.key === 'Escape') {
       if (pendingContactChoice) {
         setPendingContactChoice(null);
       } else if (duplicateTxWarning) {
         setDuplicateTxWarning(null);
       } else {
         triggerHaptic('tick');
         onClose();
       }
     }
   };
   window.addEventListener('keydown', handleEsc);
   return () => window.removeEventListener('keydown', handleEsc);
 }, [pendingContactChoice, duplicateTxWarning, onClose]);

  const centerNativeInput = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const input = e.currentTarget;
    const container = formScrollRef.current;
    if (!container || !input) return;

    const scrollIntoCenter = () => {
      if (!document.body.contains(input)) return;
      const containerRect = container.getBoundingClientRect();
      const inputRect = input.getBoundingClientRect();
      const vvHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const visibleBottom = Math.min(containerRect.bottom, vvHeight);
      const visibleHeight = Math.max(120, visibleBottom - containerRect.top);
      const visibleCenter = containerRect.top + visibleHeight / 2;
      const inputCenter = inputRect.top + inputRect.height / 2;
      const deltaY = inputCenter - visibleCenter;
      if (Math.abs(deltaY) > 6) {
        container.scrollBy({ top: deltaY, behavior: 'smooth' });
      }
    };

    requestAnimationFrame(scrollIntoCenter);
    setTimeout(scrollIntoCenter, 280);
  };

 const handlePickContact = async () => {
   triggerHaptic('soft');
   if (typeof navigator !== 'undefined' && 'contacts' in navigator && (navigator as any).contacts?.select) {
     try {
       const props = ['name', 'tel'];
       const options = { multiple: false };
       const contacts = await (navigator as any).contacts.select(props, options);
       if (contacts && contacts.length > 0) {
         const contact = contacts[0];
         const rawName = (contact.name && contact.name[0]) ? contact.name[0] : '';
         const rawTels: string[] = contact.tel || [];

         // Clean all numbers (stripping +88 / +880) and deduplicate
         const cleanedNumbers = Array.from(new Set(
           rawTels
             .map(t => cleanBangladeshiPhone(t))
             .filter(t => t.length > 0)
         ));

         if (cleanedNumbers.length === 0) {
           toast.error(lang === 'bn' ? 'কোনো ফোন নম্বর পাওয়া যায়নি।' : 'No phone number found in this contact.');
           return;
         }

         // If contact has multiple numbers, open modern choice modal!
         if (cleanedNumbers.length > 1) {
           triggerHaptic('single');
           setPendingContactChoice({
             contactName: rawName,
             numbers: cleanedNumbers,
             onSelect: (chosen: string) => {
               setCustomerPhoneInput(chosen);
               if (rawName && !customerNameInput.trim()) setCustomerNameInput(rawName);
               toast.success(lang === 'bn' ? 'নম্বর সফলভাবে নেওয়া হয়েছে' : 'Contact number selected');
             }
           });
           return;
         }

         // Exactly one number: set directly
         const singleNumber = cleanedNumbers[0];
         setCustomerPhoneInput(singleNumber);
         if (rawName && !customerNameInput.trim()) {
           setCustomerNameInput(rawName);
         }
         triggerHaptic('single');
         toast.success(lang === 'bn' ? 'নম্বর সফলভাবে নেওয়া হয়েছে' : 'Contact number selected');
       }
     } catch (err: any) {
       if (err?.name !== 'AbortError') {
         console.warn("Contact picker failed or was cancelled:", err);
       }
     }
   } else {
     triggerHaptic('double');
     toast.info(lang === 'bn' 
       ? 'কন্টাক্ট পিকারটি শুধুমাত্র সমর্থিত মোবাইল ব্রাউজারে উপলব্ধ।' 
       : 'Contact picker is only supported on mobile browsers (like Chrome on Android).');
   }
 };

 // Handle customer selection list — order is frozen to the snapshot taken at modal open.
 // This prevents a just-confirmed customer from visibly jumping to the top mid-session.
 const filteredCustomers = useMemo(() => {
    const trimmed = searchQuery.trim();
    const lower = trimmed.toLowerCase();
    const list = trimmed === ''
      ? customers
      : customers.filter(c => {
          return c.name.toLowerCase().includes(lower) ||
                 (c.phone && c.phone.includes(trimmed)) ||
                 (searchBanglaInEnglish && matchesPhonetic(c.name, trimmed));
        });
   return [...list].sort((a, b) => {
     const posA = frozenCustomerRankMap.get(a.id) ?? Infinity;
     const posB = frozenCustomerRankMap.get(b.id) ?? Infinity;
     return posA - posB;
   });
 }, [customers, searchQuery, frozenCustomerRankMap, searchBanglaInEnglish]);

 const currentCustomer = useMemo(
   () => customers.find(c => c.id === selectedCustomerId),
   [customers, selectedCustomerId]
 );

 const [fetchedCardTxsMap, setFetchedCardTxsMap] = useState<Record<string, Transaction[]>>({});

 React.useEffect(() => {
   if (!selectedCustomerId || !currentCustomer || currentCustomer.accountType !== 'credit_card') return;
   if (fetchedCardTxsMap[selectedCustomerId]) return;
   const userId = currentCustomer.userId;
   if (!userId || userId === 'local-guest-session') return;
   if (typeof navigator !== 'undefined' && !navigator.onLine) return;

   let cancelled = false;
   const txRef = collection(db, 'users', userId, 'transactions');
   const q = query(txRef, where('customerId', '==', selectedCustomerId));
   getDocs(q)
     .then((snap) => {
       if (cancelled) return;
       const list: Transaction[] = [];
       snap.forEach((docSnap) => {
         const data = docSnap.data();
         if ((data as any).isArchived) return;
         list.push({
           ...data,
           id: docSnap.id,
           date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
           createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || data.date),
         } as Transaction);
       });
       setFetchedCardTxsMap((prev) => ({ ...prev, [selectedCustomerId]: list }));
       try {
         localStorage.setItem(`easy_due_txs_${userId}_${selectedCustomerId}`, JSON.stringify(list));
       } catch {}
     })
     .catch(() => {});

   return () => {
     cancelled = true;
   };
 }, [selectedCustomerId, currentCustomer, fetchedCardTxsMap]);

 const selectedCustomerTxs = useMemo(() => {
   if (!selectedCustomerId) return [];
   const merged = new Map<string, Transaction>();
   try {
     const userId = currentCustomer?.userId;
     if (userId && typeof localStorage !== 'undefined') {
       const cached = localStorage.getItem(`easy_due_txs_${userId}_${selectedCustomerId}`);
       if (cached) {
         (JSON.parse(cached) as Transaction[]).forEach((t) => {
           if (t?.id) merged.set(t.id, t);
         });
       } else {
         const allStored = localStorage.getItem(`easy_due_transactions_${userId}`);
         if (allStored) {
           (JSON.parse(allStored) as Transaction[]).forEach((t) => {
             if (t?.id && t.customerId === selectedCustomerId) merged.set(t.id, t);
           });
         }
       }
     }
   } catch {}

   const fetched = fetchedCardTxsMap[selectedCustomerId];
   if (fetched) {
     fetched.forEach((t) => {
       if (t?.id) merged.set(t.id, t);
     });
   }

   transactions.forEach((t) => {
     if (t?.id && t.customerId === selectedCustomerId) merged.set(t.id, t);
   });

   return Array.from(merged.values());
 }, [selectedCustomerId, transactions, currentCustomer, fetchedCardTxsMap]);

 const creditCardBilledDue = useMemo(() => {
   if (!currentCustomer || currentCustomer.accountType !== 'credit_card') return 0;
   const billingDay = Math.min(31, Math.max(1, currentCustomer.billingDay || 15));
   const getCycleBoundary = (year: number, monthIndex: number, day: number) => {
     const firstOfTarget = new Date(year, monthIndex, 1, 0, 0, 0, 0);
     const maxDays = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0).getDate();
     return new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), Math.min(day, maxDays), 0, 0, 0, 0);
   };
   const now = new Date();
   const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
   const thisMonthCutoff = getCycleBoundary(now.getFullYear(), now.getMonth(), billingDay);
   const lastStatementDate =
     todayMidnight.getTime() >= thisMonthCutoff.getTime()
       ? thisMonthCutoff
       : getCycleBoundary(now.getFullYear(), now.getMonth() - 1, billingDay);
   const lastCutoffMs = lastStatementDate.getTime();
   const parseDateMs = (d: any) => {
     if (!d) return 0;
     if (d instanceof Date) return d.getTime();
     if (typeof d.toDate === 'function') return d.toDate().getTime();
     if (typeof d.seconds === 'number') return d.seconds * 1000;
     const parsed = new Date(d).getTime();
     return isNaN(parsed) ? 0 : parsed;
   };
   let thisMonthSpend = 0;
   let paymentsSinceCutoff = 0;
   for (const tx of selectedCustomerTxs) {
     if (parseDateMs(tx.date) >= lastCutoffMs) {
       if (tx.type === 'due') thisMonthSpend += tx.amount;
       else paymentsSinceCutoff += tx.amount;
     }
   }
   const rawStatementAtCutoff = (currentCustomer.outstandingDue || 0) - thisMonthSpend + paymentsSinceCutoff;
   const billedStatementAmount = Math.max(0, rawStatementAtCutoff);
   return Math.max(0, billedStatementAmount - paymentsSinceCutoff);
 }, [currentCustomer, selectedCustomerTxs]);

 const handleQuickAddAmount = (add: number) => {
 setPaymentQuickFillIntent(null);
 const cleaned = amountInput.replace(/,/g, '');
 const current = parseFloat(cleaned) || 0;
 const newVal = (current + add).toString();
 setAmountInput(formatIndianNumberString(newVal));
 };

  const creditCardCutoffMs = useMemo(() => {
    if (!currentCustomer || currentCustomer.accountType !== 'credit_card') return null;
    const billingDay = Math.min(31, Math.max(1, currentCustomer.billingDay || 15));
    const getCycleBoundary = (year: number, monthIndex: number, day: number) => {
      const firstOfTarget = new Date(year, monthIndex, 1, 0, 0, 0, 0);
      const maxDays = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0).getDate();
      return new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), Math.min(day, maxDays), 0, 0, 0, 0);
    };
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const thisMonthCutoff = getCycleBoundary(now.getFullYear(), now.getMonth(), billingDay);
    const lastStatementDate =
      todayMidnight.getTime() >= thisMonthCutoff.getTime()
        ? thisMonthCutoff
        : getCycleBoundary(now.getFullYear(), now.getMonth() - 1, billingDay);
    return lastStatementDate.getTime();
  }, [currentCustomer]);

  const getDuplicate = React.useCallback(() => {
    if (!selectedCustomerId || !amountInput || selectedCustomerTxs.length === 0) return null;
    const cleaned = amountInput.replace(/,/g, '');
    const amountVal = parseFloat(cleaned);
    if (isNaN(amountVal) || amountVal <= 0) return null;

    const parseDate = (d: any): Date => {
      if (!d) return new Date();
      if (d instanceof Date) return d;
      if (typeof d.toDate === 'function') return d.toDate();
      if (d.seconds !== undefined) return new Date(d.seconds * 1000);
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    };

    const now = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    return selectedCustomerTxs.find(t => {
      if (t.type !== type || Math.abs(t.amount - amountVal) >= 0.01) return false;
      // Quick Entry records into the active unbilled section; ignore entries residing in closed billed cycles
      if (creditCardCutoffMs !== null && parseDate(t.date).getTime() < creditCardCutoffMs) {
        return false;
      }
      const tDate = parseDate(t.createdAt || t.date);
      return (now - tDate.getTime()) < twentyFourHoursMs;
    }) || null;
  }, [selectedCustomerId, amountInput, selectedCustomerTxs, type, creditCardCutoffMs]);

  const activeRealtimeDuplicate = useMemo(() => {
    if (isSubmitting) return null;
    return getDuplicate();
  }, [isSubmitting, getDuplicate]);

  const executeSave = async (bypassDuplicateCheck = false) => {
    setErrorMsg('');

    let custId = selectedCustomerId;
    const cleanedAmount = amountInput.replace(/,/g, '');
    const amountVal = parseFloat(cleanedAmount);

    if (!amountVal || amountVal <= 0) {
      setErrorMsg(lang === 'bn' ? 'অনুগ্রহ করে সঠিক পরিমাণ দিন (০ টাকার বেশি)' : 'Please enter a valid amount (greater than 0)');
      return;
    }

    if (!bypassDuplicateCheck && !hasShownDuplicateWarning) {
      const duplicate = getDuplicate();
      if (duplicate) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setDuplicateTxWarning(duplicate);
        return;
      }
    }

    setIsSubmitting(true);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    try {
      if (showAddNewCustomer) {
        if (!customerNameInput.trim()) {
          setErrorMsg(lang === 'bn' ? 'গ্রাহকের নাম খালি থাকতে পারবে না' : 'Customer name cannot be empty');
          setIsSubmitting(false);
          return;
        }
        
        if (newAccountType === 'credit_card') {
          const rawDay = parseInt(newBillingDay, 10);
          if (!rawDay || rawDay < 1 || rawDay > 31) {
            setErrorMsg(lang === 'bn' ? 'অনুগ্রহ করে ১ থেকে ৩১ এর মধ্যে বিলিং তারিখ দিন' : 'Please enter a billing day between 1 and 31');
            setIsSubmitting(false);
            return;
          }
        }
        
        try {
          const parsedBillingDay = newAccountType === 'credit_card'
            ? Math.min(31, Math.max(1, parseInt(newBillingDay, 10) || 1))
            : undefined;
          // Create customer first
          const newId = await createCustomer(customerNameInput, customerPhoneInput, {
            accountType: newAccountType,
            billingDay: parsedBillingDay
          });
          if (newId) {
            custId = newId;
          } else {
            throw new Error('Failed to create customer');
          }
        } catch (err: any) {
          if (err.message === 'DUPLICATE_NAME') {
            setErrorMsg(lang === 'bn' ? 'এই নামের গ্রাহক ইতিমধ্যে খতিয়ানে সংরক্ষিত আছে।' : 'A customer with this name already exists.');
          } else {
            setErrorMsg(lang === 'bn' ? 'গ্রাহক তৈরি করতে সমস্যা হয়েছে।' : 'Failed to create customer.');
          }
          setIsSubmitting(false);
          return;
        }
      }

      if (!custId) {
        setErrorMsg(lang === 'bn' ? 'অনুগ্রহ করে একজন গ্রাহক নির্বাচন করুন বা নতুনভাবে যুক্ত করুন' : 'Please select or add a customer first');
        setIsSubmitting(false);
        return;
      }

      // Pass fallbackCustomerInfo to bypass React state re-render delay
      const parsedBillingDay = Math.min(31, Math.max(1, parseInt(newBillingDay, 10) || 1));
      const fallbackCustomer = showAddNewCustomer 
        ? {
            name: customerNameInput,
            phone: customerPhoneInput,
            accountType: newAccountType,
            billingDay: newAccountType === 'credit_card' ? parsedBillingDay : undefined
          } 
        : undefined;

      const finalDescription = description.trim() || (selectedTag ? getTagDefaultDescription(selectedTag, lang) : '');

      await addTransaction(
        custId,
        type,
        amountVal,
        finalDescription,
        new Date(),
        fallbackCustomer,
        selectedTag || undefined
      );
      
      onClose();
      toast.success(lang === 'bn' ? 'হিসাব সফলভাবে যোগ হয়েছে' : 'Transaction saved successfully');
    } catch (err) {
      console.error(err);
      setErrorMsg(lang === 'bn' ? 'হিসাব সংরক্ষণে ত্রুটি ঘটেছে। পুনরায় চেষ্টা করুন।' : 'Error saving. Please check connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeSave(false);
  };

  return (
    <ModalPortal lockScroll={false}>
      <div
        className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden"
      >
        <div
          onClick={() => {
            triggerHaptic('tick');
            onClose();
          }}
          className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
        />
        <div
          onClick={(e) => e.stopPropagation()}
          className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-xl rounded-t-[2rem] sm:rounded-3xl border overflow-hidden max-h-[90dvh] flex flex-col shadow-2xl"
        >
          {/* Mobile Top Drag Handle */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-900/15 dark:bg-white/20 mx-auto" />
          </div>

          {/* Header */}
          <div className="px-5 py-3.5 sm:py-4 border-b border-slate-900/[0.06] dark:border-white/[0.06] flex items-center justify-between shrink-0">
            <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white tracking-tight">
              {t.quickEntryTitle}
            </h3>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-slate-900/[0.05] hover:bg-slate-900/[0.1] dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close"
              id="close_modal_btn"
            >
              <X className="w-4 h-4 stroke-[1.25]" />
            </button>
          </div>

          <form onSubmit={handleSave} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Scrollable Form Fields */}
            <div ref={formScrollRef} className="flex-1 min-h-0 overflow-y-auto hide-scrollbar p-5 space-y-5">
            {/* 1. Entry Type Selection */}
            <div className="space-y-2">
              <span className={lang === 'bn' ? 'text-[11px] font-bold tracking-normal text-slate-500 dark:text-slate-400 block' : 'micro-mono-label font-semibold block'}>
                {t.chooseType}
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('single');
                    setType('due');
                    setSelectedTag(null);
                    setPaymentQuickFillIntent(null);
                  }}
                  className={`py-3.5 px-3.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer touch-press ${
                    type === 'due'
                      ? 'bg-rose-600 border-2 border-rose-400 text-white shadow-lg shadow-rose-600/20'
                      : 'bg-slate-900/[0.03] hover:bg-slate-900/[0.06] border border-slate-900/[0.08] text-slate-700 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:border-white/[0.08] dark:text-slate-200'
                  }`}
                  id="tab_give_due"
                >
                  {isCreditCardContext ? (
                    <CreditCard className="w-4 h-4 stroke-[1.25]" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 stroke-[1.25]" />
                  )}
                  <span className="text-sm font-bold">
                    {isCreditCardContext
                      ? (lang === 'bn' ? 'কার্ড বিল যোগ' : 'Add Card Bill')
                      : t.giveDue}
                  </span>
                  <span className={`text-[11px] text-center leading-tight ${
                    type === 'due' ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {isCreditCardContext
                      ? (lang === 'bn' ? 'কার্ড দিয়ে কেনাকাটা বা বিল খরচ' : 'Spent on credit card')
                      : (lang === 'bn' ? 'গ্রাহক পরে পেমেন্ট দেবে' : 'Customer owes you')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('single');
                    setType('payment');
                    setSelectedTag(null);
                    setPaymentQuickFillIntent(null);
                  }}
                  className={`py-3.5 px-3.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer touch-press ${
                    type === 'payment'
                      ? 'bg-emerald-600 border-2 border-emerald-400 text-white shadow-lg shadow-emerald-600/20'
                      : 'bg-slate-900/[0.03] hover:bg-slate-900/[0.06] border border-slate-900/[0.08] text-slate-700 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:border-white/[0.08] dark:text-slate-200'
                  }`}
                  id="tab_get_payment"
                >
                  <ArrowDownLeft className="w-4 h-4 stroke-[1.25]" />
                  <span className="text-sm font-bold">
                    {isCreditCardContext
                      ? (lang === 'bn' ? 'কার্ড বিল পরিশোধ' : 'Pay Card Bill')
                      : t.getPayment}
                  </span>
                  <span className={`text-[11px] text-center leading-tight ${
                    type === 'payment' ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {isCreditCardContext
                      ? (lang === 'bn' ? 'কার্ডের বিল পরিশোধ করা হলো' : 'Paid toward card balance')
                      : (lang === 'bn' ? 'গ্রাহক নগদ পরিশোধ করল' : 'Customer paid you')}
                  </span>
                </button>
              </div>
            </div>

            {/* 2. Customer Selection or Inline Add */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className={lang === 'bn' ? 'text-[11px] font-bold tracking-normal text-slate-500 dark:text-slate-400 block' : 'micro-mono-label font-semibold block'}>
                  {lang === 'bn' ? 'গ্রাহক নির্বাচন' : 'Customer Account'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddNewCustomer(!showAddNewCustomer)}
                  className="text-slate-950 dark:text-white font-bold text-xs flex items-center gap-1.5 bg-slate-900/[0.04] hover:bg-slate-900/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] px-3 py-1.5 rounded-full cursor-pointer transition-colors"
                  id="toggle_new_cust_btn"
                >
                  {showAddNewCustomer ? (
                    <span className="flex items-center gap-1">
                      <ChevronLeft className="w-3.5 h-3.5 stroke-[1.25]" />
                      <span>{lang === 'bn' ? 'তালিকায় ফিরুন' : 'Back to List'}</span>
                    </span>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5 stroke-[1.25]" />
                      <span>{lang === 'bn' ? 'নতুন গ্রাহক যোগ' : 'Add New Customer'}</span>
                    </>
                  )}
                </button>
              </div>

              {!showAddNewCustomer ? (
                <div className="space-y-2.5">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 stroke-[1.25]" />
                    <input
                      type="text"
                      placeholder={lang === 'bn' ? 'গ্রাহক পছন্দ করতে খুঁজুন...' : 'Search customer...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-11 py-2.5 rounded-full border border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-950 dark:text-white font-semibold text-sm focus:border-slate-900/30 dark:focus:border-white/30 focus:outline-none transition-colors"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('level3');
                          setSearchQuery('');
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-950 dark:hover:text-white transition-colors cursor-pointer"
                        title={lang === 'bn' ? 'খালি করুন' : 'Clear search'}
                        aria-label={lang === 'bn' ? 'খালি করুন' : 'Clear search'}
                      >
                        <Delete className="w-4 h-4 stroke-[1.25]" />
                      </button>
                    )}
                  </div>

                  <div className="relative pt-0.5">
                    <div className="grid grid-cols-2 gap-2">
                      {(showAllCustomers ? filteredCustomers : filteredCustomers.slice(0, 6)).map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setPaymentQuickFillIntent(null);
                            setSelectedCustomerId(selectedCustomerId === c.id ? '' : c.id);
                          }}
                          className={`p-3 text-left rounded-2xl transition-all text-xs truncate flex items-center justify-between cursor-pointer touch-press ${
                            selectedCustomerId === c.id
                              ? 'bg-slate-950 text-white border-2 border-slate-950 font-bold dark:bg-white dark:text-slate-950 dark:border-white shadow-sm'
                              : 'bg-slate-900/[0.03] dark:bg-white/[0.04] hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08] border border-slate-900/[0.07] dark:border-white/[0.07] text-slate-900 dark:text-white font-medium'
                          }`}
                        >
                          <span className="truncate flex items-center gap-1.5 min-w-0">
                            {c.photoUrl ? (
                              <span className="p-[1px] rounded-full contact-avatar-ring shrink-0">
                                <img
                                  src={c.photoUrl}
                                  alt={c.name}
                                  className="w-5 h-5 rounded-full object-cover block"
                                  draggable={false}
                                />
                              </span>
                            ) : c.accountType === 'credit_card' ? (
                              <CreditCard className="w-3.5 h-3.5 shrink-0 opacity-75 stroke-[1.25]" />
                            ) : null}
                            <span className="truncate">{c.name}</span>
                          </span>
                          {selectedCustomerId === c.id && <Check className="w-3.5 h-3.5 shrink-0 ml-1 stroke-[1.5]" />}
                        </button>
                      ))}

                      {filteredCustomers.length === 0 && (
                        <div className="col-span-2 w-full text-center py-4 bg-slate-900/[0.02] dark:bg-white/[0.02] rounded-2xl border border-dashed border-slate-900/[0.12] dark:border-white/[0.12] text-slate-500 text-xs">
                          {lang === 'bn' ? 'কোনো গ্রাহক মেলেনি। উপরে "+ নতুন গ্রাহক যোগ" চাপুন।' : 'No customer matches. Click "+ Add New Customer" above.'}
                        </div>
                      )}
                    </div>

                    {filteredCustomers.length > 6 && (
                      <div className="flex justify-end mt-2 pr-1">
                        <button
                          type="button"
                          onClick={() => setShowAllCustomers(!showAllCustomers)}
                          className="text-xs font-bold text-slate-950 dark:text-white hover:underline transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {showAllCustomers
                            ? (lang === 'bn' ? 'কম দেখুন' : 'Show less')
                            : (lang === 'bn' ? 'আরও দেখুন' : 'Show more')}
                          <svg className={`w-3.5 h-3.5 transition-transform ${showAllCustomers ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-900/[0.03] dark:bg-white/[0.04] rounded-2xl border border-slate-900/[0.07] dark:border-white/[0.08] space-y-3.5">
                  <div className="relative grid grid-cols-2 p-1 rounded-full bg-slate-900/[0.05] dark:bg-white/[0.05] border border-slate-900/[0.08] dark:border-white/[0.09]">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-slate-950 dark:bg-white shadow-sm will-change-transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{
                        transform: `translate3d(${newAccountType === 'credit_card' ? '100%' : '0%'}, 0, 0)`
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('tick');
                        setNewAccountType('standard');
                      }}
                      className={`relative z-10 py-2 px-3 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors duration-200 ${
                        newAccountType === 'standard'
                          ? 'text-white dark:text-slate-950'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5 stroke-[1.25]" />
                      <span className="truncate">{lang === 'bn' ? 'গ্রাহক খতিয়ান' : 'Customer Ledger'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('tick');
                        setNewAccountType('credit_card');
                      }}
                      className={`relative z-10 py-2 px-3 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors duration-200 ${
                        newAccountType === 'credit_card'
                          ? 'text-white dark:text-slate-950'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5 stroke-[1.25]" />
                      <span className="truncate">{lang === 'bn' ? 'ক্রেডিট কার্ড' : 'Credit Card'}</span>
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className={lang === 'bn' ? 'text-[11px] font-bold tracking-normal text-slate-500 dark:text-slate-400 block overflow-hidden' : 'micro-mono-label font-semibold block overflow-hidden'}>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={newAccountType}
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -3 }}
                          transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                          className="inline-block"
                        >
                          {newAccountType === 'credit_card'
                            ? (lang === 'bn' ? 'কার্ড / হিসাবের নাম' : 'Card / Account Name')
                            : t.customerName}
                        </motion.span>
                      </AnimatePresence>
                    </label>
                    <input
                      type="text"
                      placeholder={newAccountType === 'credit_card' ? 'e.g. City Bank Amex' : 'e.g. Wahid Zaman'}
                      value={customerNameInput}
                      onChange={(e) => setCustomerNameInput(e.target.value)}
                      onFocus={centerNativeInput}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const phoneInput = e.currentTarget.form?.querySelector('input[type="tel"]') as HTMLInputElement | null;
                          if (phoneInput) phoneInput.focus();
                        }
                      }}
                      className="w-full px-3.5 py-2.5 border border-slate-900/[0.08] dark:border-white/[0.08] rounded-2xl bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-950 dark:text-white text-sm outline-none font-semibold transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={lang === 'bn' ? 'text-[11px] font-bold tracking-normal text-slate-500 dark:text-slate-400 block' : 'micro-mono-label font-semibold block'}>{t.phoneNumber}</label>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        placeholder="e.g. 01712345678"
                        value={customerPhoneInput}
                        onChange={(e) => setCustomerPhoneInput(cleanBangladeshiPhone(e.target.value))}
                        onFocus={centerNativeInput}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const amountInputEl = e.currentTarget.form?.querySelector('input[data-numpad="true"]') as HTMLInputElement | null;
                            if (amountInputEl) amountInputEl.focus();
                          }
                        }}
                        className="flex-1 px-3.5 py-2.5 border border-slate-900/[0.08] dark:border-white/[0.08] rounded-2xl bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-950 dark:text-white text-sm outline-none font-mono font-semibold"
                      />
                      <button
                        type="button"
                        onClick={handlePickContact}
                        className="px-3.5 bg-slate-900/[0.05] hover:bg-slate-900/[0.09] dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-slate-900 dark:text-white rounded-2xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0 font-bold text-xs"
                        title={lang === 'bn' ? 'কন্টাক্ট নির্বাচন করুন' : 'Pick Contact'}
                      >
                        <BookUser className="w-4 h-4 stroke-[1.25]" />
                        <span className="hidden sm:inline">{lang === 'bn' ? 'কন্টাক্ট' : 'Contacts'}</span>
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {newAccountType === 'credit_card' && (
                      <motion.div
                        key="quick-entry-billing-day"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="flex items-center justify-between gap-2 pt-1"
                      >
                        <label className={`${lang === 'bn' ? 'text-[11px] font-bold tracking-normal text-slate-600 dark:text-slate-300' : 'micro-mono-label font-semibold'} flex items-center gap-1.5`}>
                          <Calendar className="w-3.5 h-3.5 stroke-[1.25]" />
                          <span>{lang === 'bn' ? 'বিলিং তারিখ (১-৩১)' : 'Statement Billing Day (1–31)'}</span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-numpad="true"
                          placeholder={lang === 'bn' ? '১-৩১' : '1–31'}
                          value={newBillingDay}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/[^0-9]/g, '');
                            if (!clean) {
                              setNewBillingDay('');
                              return;
                            }
                            setNewBillingDay(String(Math.min(31, Math.max(1, parseInt(clean, 10)))));
                          }}
                          className="w-20 px-2.5 py-1.5 text-center border border-slate-900/[0.08] dark:border-white/[0.08] rounded-xl bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-950 dark:text-white font-mono font-bold text-xs focus:outline-none"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* 3. Monumental Amount Stage */}
            <div className="space-y-2">
              <span className={lang === 'bn' ? 'text-[11px] font-bold tracking-normal text-slate-500 dark:text-slate-400 block' : 'micro-mono-label font-semibold block'}>
                {t.amountLabel}
              </span>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] sm:text-[22px] font-display font-medium text-slate-400 dark:text-slate-500 select-none pointer-events-none">
                  ৳
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  data-numpad="true"
                  placeholder="0"
                  value={amountInput}
                  onChange={(e) => {
                    setPaymentQuickFillIntent(null);
                    const val = e.target.value;
                    const clean = val.replace(/[^0-9.]/g, '');
                    const dots = clean.split('.');
                    let sanitized = clean;
                    if (dots.length > 2) {
                      sanitized = dots[0] + '.' + dots.slice(1).join('');
                    }
                    setAmountInput(formatIndianNumberString(sanitized));
                  }}
                  className="w-full pl-9 pr-4 py-2.5 sm:py-3 rounded-2xl border border-slate-900/[0.09] dark:border-white/[0.1] bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-950 dark:text-white font-display font-bold text-[22px] sm:text-[26px] tracking-tight tabular-nums focus:outline-none transition-colors"
                  required
                />
              </div>

              {activeRealtimeDuplicate && (
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 stroke-[1.25]" />
                  {t.duplicateRealtimeWarning}
                </p>
              )}

              {type === 'payment' && currentCustomer && currentCustomer.accountType === 'credit_card' && creditCardBilledDue > 0 && (() => {
                const cleanedAmt = amountInput.replace(/,/g, '');
                const billedStr = creditCardBilledDue.toString();
                const totalStr = (currentCustomer.outstandingDue || 0).toString();
                const isChecked =
                  cleanedAmt === billedStr &&
                  (billedStr !== totalStr || paymentQuickFillIntent === 'billed');
                return (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('single');
                      if (!isChecked) {
                        setPaymentQuickFillIntent('billed');
                        setAmountInput(formatIndianNumberString(billedStr));
                        if (!description.trim()) {
                          setDescription(lang === 'bn' ? 'পূর্ববর্তী মাসের বিল পরিশোধ' : 'Billed Statement Payment');
                        }
                      } else {
                        setPaymentQuickFillIntent(null);
                        setAmountInput('');
                      }
                    }}
                    className="w-full flex items-center text-left gap-2.5 mt-2 p-3 rounded-2xl surface-subcard hover:bg-slate-200/50 dark:hover:bg-white/[0.06] border-[1.5px] border-slate-300/85 dark:border-white/[0.16] cursor-pointer transition-colors select-none"
                  >
                    <span
                      aria-hidden="true"
                      className={`w-4 h-4 rounded-md border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
                        isChecked
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'border-amber-500/70 bg-white/70 dark:bg-white/[0.05]'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[2.5]" />}
                    </span>
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-200 select-none">
                      {lang === 'bn' ? 'পূর্ববর্তী মাসের বিল্ড বকেয়া পরিশোধ করুন' : "Pay billed (previous month's)"} (৳{formatNumber(creditCardBilledDue, lang)})
                    </span>
                  </button>
                );
              })()}

              {type === 'payment' && currentCustomer && (currentCustomer as any).outstandingDue > 0 && (() => {
                const cleanedAmt = amountInput.replace(/,/g, '');
                const targetDue = (currentCustomer as any).outstandingDue;
                const totalStr = targetDue.toString();
                const billedStr = creditCardBilledDue.toString();
                const isChecked =
                  cleanedAmt === totalStr &&
                  (currentCustomer.accountType !== 'credit_card' ||
                    billedStr !== totalStr ||
                    paymentQuickFillIntent !== 'billed');
                return (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('single');
                      if (!isChecked) {
                        setPaymentQuickFillIntent('total');
                        setAmountInput(formatIndianNumberString(totalStr));
                      } else {
                        setPaymentQuickFillIntent(null);
                        setAmountInput('');
                      }
                    }}
                    className="w-full flex items-center text-left gap-2.5 mt-2 p-3 rounded-2xl surface-subcard hover:bg-slate-200/50 dark:hover:bg-white/[0.06] border-[1.5px] border-slate-300/85 dark:border-white/[0.16] cursor-pointer transition-colors select-none"
                  >
                    <span
                      aria-hidden="true"
                      className={`w-4 h-4 rounded-md border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
                        isChecked
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-emerald-600/65 dark:border-emerald-400/65 bg-white/70 dark:bg-white/[0.05]'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[2.5]" />}
                    </span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white select-none">
                      {(currentCustomer as any).accountType === 'credit_card'
                        ? (lang === 'bn' ? 'সম্পূর্ণ কার্ড বিল পরিশোধ করুন' : 'Pay total card balance')
                        : (lang === 'bn' ? 'সম্পূর্ণ বকেয়া পরিশোধ করুন' : 'Settle complete due')} (৳{formatNumber(targetDue, lang)})
                    </span>
                  </button>
                );
              })()}

              {/* Speedy Pill helpers */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[50, 100, 500, 1000, 5000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleQuickAddAmount(val)}
                    className="px-3 py-1.5 bg-slate-900/[0.04] hover:bg-slate-900/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.11] text-slate-900 dark:text-white font-semibold rounded-full transition-colors text-xs cursor-pointer tabular-nums font-mono touch-press"
                  >
                    +{formatNumber(val, lang)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setPaymentQuickFillIntent(null);
                    setAmountInput('');
                  }}
                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold rounded-full transition-colors text-xs cursor-pointer touch-press"
                >
                  {lang === 'bn' ? 'মুছুন' : 'Clear'}
                </button>
              </div>
            </div>

            {/* Tag Selection Bar */}
            <TagPickerBar
              type={type}
              selectedTag={selectedTag}
              onSelectTag={(tag) => setSelectedTag(tag)}
              transactions={transactions}
              lang={lang}
            />

            {/* 4. Optional Description */}
            <div className="space-y-1.5">
              <span className={lang === 'bn' ? 'text-[11px] font-bold tracking-normal text-slate-500 dark:text-slate-400 block' : 'micro-mono-label font-semibold block'}>
                {t.notes}
              </span>
              <input
                type="text"
                placeholder={selectedTag ? getTagDefaultDescription(selectedTag, lang, type) : t.notesPlaceholder}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onFocus={centerNativeInput}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-950 dark:text-white font-medium text-sm focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Sticky Bottom Confirm */}
          <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5 border-t border-slate-900/[0.06] dark:border-white/[0.06] bg-white/50 dark:bg-black/25 shrink-0">
            {errorMsg && (
              <div className="p-3 mb-3 bg-rose-500/10 rounded-2xl text-rose-600 dark:text-rose-400 font-semibold text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 stroke-[1.25]" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              ref={submitBtnRef}
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 rounded-full font-bold text-sm flex items-center justify-center transition-all cursor-pointer select-none touch-press shadow-lg ${
                type === 'due'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
              } ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
              id="save_transaction_btn"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  {typeof navigator !== 'undefined' && navigator.onLine ? t.saving : t.speedyNotice}
                </span>
              ) : (
                type === 'due' ? t.confirmGive : t.confirmReceive
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Duplicate Entry Warning Modal */}
      {duplicateTxWarning && (
        <ModalPortal lockScroll={false}>
          <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
            <div
              onClick={() => setDuplicateTxWarning(null)}
              className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
            />
            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-3xl border p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 max-h-[90dvh] overflow-y-auto hide-scrollbar shadow-2xl"
            >
              <div className="flex justify-center pb-3 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-slate-900/15 dark:bg-white/20 mx-auto" />
              </div>
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 stroke-[1.25]" />
              </div>
              <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white mb-1.5">
                {t.duplicateWarningTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t.duplicateWarningDesc}
              </p>

              <div className="bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.07] dark:border-white/[0.08] rounded-2xl p-3.5 text-left space-y-2 mt-4">
                <div className="flex justify-between items-baseline">
                  <span className={lang === 'bn' ? 'text-[11px] font-bold tracking-normal text-slate-500 dark:text-slate-400' : 'micro-mono-label font-semibold'}>{t.type}</span>
                  <span className={`text-[11px] font-bold ${
                    duplicateTxWarning.type === 'due'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {duplicateTxWarning.type === 'due' ? t.duePlus : t.paymentMinus}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className={lang === 'bn' ? 'text-[11px] font-bold tracking-normal text-slate-500 dark:text-slate-400' : 'micro-mono-label font-semibold'}>{t.amount}</span>
                  <span className={`text-sm font-bold tabular-nums font-mono ${
                    duplicateTxWarning.type === 'due' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    ৳ {formatNumber(duplicateTxWarning.amount, lang)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  if (setHighlightedTxId) {
                    setHighlightedTxId(duplicateTxWarning.id);
                  }
                  setDuplicateTxWarning(null);
                  if (onViewCustomer) {
                    onViewCustomer(selectedCustomerId, true);
                  } else {
                    onClose();
                  }
                }}
                className="w-full py-3 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold rounded-full cursor-pointer text-xs transition-colors touch-press"
              >
                {t.viewExistingEntry}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setHasShownDuplicateWarning(true);
                  setDuplicateTxWarning(null);
                  await executeSave(true);
                }}
                className="w-full py-3 bg-slate-900/[0.05] hover:bg-slate-900/[0.09] dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-slate-900 dark:text-white font-bold rounded-full cursor-pointer text-xs transition-colors"
              >
                {t.addAnyway}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDuplicateTxWarning(null);
                }}
                className="w-full py-2.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white font-bold cursor-pointer transition-colors"
              >
                {t.cancel}
              </button>
            </div>
          </div>
          </div>
        </ModalPortal>
      )}

      {/* Modern Contact Phone Selector Modal */}
      {pendingContactChoice && (
        <ContactNumberPickerModal
          isOpen={true}
          contactName={pendingContactChoice.contactName}
          numbers={pendingContactChoice.numbers}
          onSelectNumber={(chosen) => {
            pendingContactChoice.onSelect(chosen);
            setPendingContactChoice(null);
          }}
          onClose={() => setPendingContactChoice(null)}
          lang={lang}
        />
      )}
      </div>
    </ModalPortal>
  );
}
