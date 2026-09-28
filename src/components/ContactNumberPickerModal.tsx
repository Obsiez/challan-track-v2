import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, Check, X, User, UserPlus, Smartphone, Sparkles } from 'lucide-react';
import { triggerHaptic } from '../lib/haptics';
import { Language, formatNumber } from '../lib/translations';
import { cleanBangladeshiPhone, formatPhoneDisplay, getBdOperator } from '../lib/phoneUtils';

interface ContactNumberPickerModalProps {
  isOpen: boolean;
  contactName: string;
  numbers: string[];
  onSelectNumber: (number: string, finalName?: string) => void;
  onClose: () => void;
  lang: Language;
  isNewAccount?: boolean;
}

export default function ContactNumberPickerModal({
  isOpen,
  contactName,
  numbers,
  onSelectNumber,
  onClose,
  lang,
  isNewAccount = false
}: ContactNumberPickerModalProps) {
  // Deduplicate and clean all numbers (stripping +88/+880)
  const cleanedNumbers = Array.from(new Set(
    numbers.map(num => cleanBangladeshiPhone(num)).filter(num => num.length > 0)
  ));

  const [selectedNumber, setSelectedNumber] = useState<string>(cleanedNumbers[0] || '');
  const [editableName, setEditableName] = useState<string>(contactName || '');

  // Keep selected number and name updated when props change
  useEffect(() => {
    if (cleanedNumbers.length > 0) {
      setSelectedNumber(cleanedNumbers[0]);
    }
    setEditableName(contactName || '');
  }, [numbers, contactName]);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!selectedNumber) return;
    triggerHaptic('single');
    const finalName = editableName.trim() || contactName.trim() || selectedNumber;
    onSelectNumber(selectedNumber, finalName);
    onClose();
  };

  const handleSelectCard = (num: string) => {
    triggerHaptic('single');
    setSelectedNumber(num);
  };

  const firstLetter = (editableName || contactName || '?').trim().charAt(0).toUpperCase();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-white dark:bg-zinc-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col relative z-10"
        >
          {/* Mobile Top Indicator Bar */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
          </div>

          {/* Modal Header */}
          <div className="p-5 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/90 dark:bg-zinc-900/80">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                {firstLetter}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-zinc-900 dark:text-white truncate">
                    {editableName || contactName || (lang === 'bn' ? 'নির্বাচিত কন্টাক্ট' : 'Selected Contact')}
                  </h3>
                  {isNewAccount && (
                    <span className="px-2 py-0.5 rounded-full text-2xs font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 shrink-0">
                      {lang === 'bn' ? 'নতুন হিসাব' : 'New Account'}
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  {cleanedNumbers.length > 1
                    ? (lang === 'bn'
                        ? `${formatNumber(cleanedNumbers.length, 'bn')}টি নম্বর পাওয়া গেছে • ১টি নির্বাচন করুন`
                        : `${cleanedNumbers.length} numbers found • Select one`)
                    : (lang === 'bn' ? '১টি নম্বর পাওয়া গেছে' : '1 phone number found')}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-full transition-colors cursor-pointer shrink-0"
              title={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 space-y-4 overflow-y-auto hide-scrollbar">
            {/* Optional Customer Name Edit Field when creating new account */}
            {isNewAccount && (
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-1.5">
                <label className="text-2xs font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                  {lang === 'bn' ? 'গ্রাহকের নাম (প্রয়োজনে পরিবর্তন করতে পারেন)' : 'Customer Name (Edit if needed)'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={editableName}
                    onChange={(e) => setEditableName(e.target.value)}
                    placeholder="e.g. Kashem Ali"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-750 rounded-xl text-zinc-900 dark:text-white font-bold text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  <User className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Instruction description */}
            <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {cleanedNumbers.length > 1
                ? (lang === 'bn'
                    ? 'এই কন্টাক্টটিতে একাধিক নম্বর রয়েছে। আপনি যে নম্বরটি ব্যবহার করতে চান সেটি বেছে নিন (একবারে শুধুমাত্র ১টি নম্বর নির্বাচন করা যাবে):'
                    : 'This contact has multiple phone numbers. Choose the exact number to link (single selection only):')
                : (lang === 'bn'
                    ? 'নিচের নম্বরটি যাচাই করে নিশ্চিত করুন:'
                    : 'Verify the phone number below and confirm:')}
            </div>

            {/* Phone Number Cards */}
            <div className="space-y-2.5">
              {cleanedNumbers.map((num) => {
                const isSelected = selectedNumber === num;
                const operator = getBdOperator(num);
                const displayFormatted = formatPhoneDisplay(num);

                return (
                  <div
                    key={num}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectCard(num)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectCard(num);
                      }
                    }}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 touch-manipulation select-none active:scale-[0.99] ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-500 dark:bg-emerald-950/25 dark:border-emerald-500 shadow-md shadow-emerald-500/10'
                        : 'bg-zinc-50/80 border-zinc-200 dark:bg-zinc-950/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    {/* Left: Radio Indicator & Formatted Number */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Radio Circle */}
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        isSelected 
                          ? 'border-emerald-600 bg-emerald-600 dark:border-emerald-500 dark:bg-emerald-500' 
                          : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                      </div>

                      <div className="min-w-0">
                        <div className="font-mono text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-wide truncate">
                          {displayFormatted}
                        </div>
                        <div className="text-2xs font-extrabold text-zinc-400 dark:text-zinc-500 mt-0.5 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-zinc-400 shrink-0" />
                          <span>{num}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Operator Badge (Name ONLY, no fake logos) */}
                    <div className="shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-black border ${operator.badgeClass} shadow-2xs tracking-wide inline-block`}>
                        {operator.name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="p-5 border-t border-zinc-150 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2.5 shrink-0">
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full py-3.5 sm:py-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black rounded-2xl text-base shadow-lg shadow-emerald-600/25 cursor-pointer transition-all flex items-center justify-center gap-2.5 touch-manipulation active:scale-[0.99]"
            >
              {isNewAccount ? (
                <>
                  <UserPlus className="w-5 h-5 stroke-[2.5]" />
                  <span>{lang === 'bn' ? 'অ্যাকাউন্ট তৈরি ও নিশ্চিত করুন' : 'Confirm & Open Account'}</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 stroke-[2.5]" />
                  <span>{lang === 'bn' ? 'এই নম্বরটি নির্বাচন করুন' : 'Confirm & Use Number'}</span>
                </>
              )}
            </button>

            {isNewAccount && (
              <p className="text-center text-2xs font-bold text-zinc-400 dark:text-zinc-500">
                {lang === 'bn'
                  ? 'গ্রাহকটি সংরক্ষিত হবে এবং খতিয়ান প্রোফাইলটি সরাসরি ওপেন হবে'
                  : 'Customer account will be saved and opened immediately'}
              </p>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold rounded-2xl text-sm cursor-pointer transition-colors"
            >
              {lang === 'bn' ? 'বাতিল' : 'Cancel'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
