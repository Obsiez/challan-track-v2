import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, Check, X, User, UserPlus, Smartphone } from 'lucide-react';
import { triggerHaptic } from '../lib/haptics';
import { Language, formatNumber } from '../lib/translations';
import { cleanBangladeshiPhone, formatPhoneDisplay, getBdOperator } from '../lib/phoneUtils';
import ModalPortal, { useModalScrollLock } from './ModalPortal';

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

  // Ref-counted background scroll lock when modal is open
  useModalScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

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
    <ModalPortal lockScroll={false}>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
            <div className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur" onClick={onClose} />

            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="glass-modal w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl border shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col relative z-10"
            >
          {/* Mobile Top Indicator Bar */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 bg-slate-400/40 dark:bg-white/20 rounded-full mx-auto" />
          </div>

          {/* Modal Header */}
          <div className="p-4 sm:p-5 border-b border-slate-900/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-display font-bold text-base flex items-center justify-center shrink-0">
                {firstLetter}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-display text-base font-bold text-slate-950 dark:text-white truncate">
                    {editableName || contactName || (lang === 'bn' ? 'নির্বাচিত কন্টাক্ট' : 'Selected Contact')}
                  </h3>
                  {isNewAccount && (
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                      · {lang === 'bn' ? 'নতুন হিসাব' : 'New Account'}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <Smartphone className="w-3.5 h-3.5 stroke-[1.25] shrink-0" />
                  {cleanedNumbers.length > 1
                    ? (lang === 'bn'
                        ? `${formatNumber(cleanedNumbers.length, 'bn')}টি নম্বর পাওয়া গেছে · ১টি নির্বাচন করুন`
                        : `${cleanedNumbers.length} numbers found · Select one`)
                    : (lang === 'bn' ? '১টি নম্বর পাওয়া গেছে' : '1 phone number found')}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-900/[0.05] hover:bg-slate-900/[0.1] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-800 dark:text-white border border-slate-900/[0.08] dark:border-white/[0.08] flex items-center justify-center transition-colors cursor-pointer shrink-0 touch-press"
              title={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
            >
              <X className="w-4 h-4 stroke-[1.25]" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 min-h-0 p-4 sm:p-5 space-y-4 overflow-y-auto hide-scrollbar">
            {/* Optional Customer Name Edit Field when creating new account */}
            {isNewAccount && (
              <div className="p-3.5 surface-subcard border rounded-2xl space-y-2">
                <label className={lang === 'bn' ? 'text-[11px] font-bold text-slate-500 dark:text-slate-400 block' : 'micro-mono-label text-slate-500 dark:text-slate-400 font-semibold block'}>
                  {lang === 'bn' ? 'গ্রাহকের নাম (প্রয়োজনে পরিবর্তন করতে পারেন)' : 'Customer Name (Edit if needed)'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={editableName}
                    onChange={(e) => setEditableName(e.target.value)}
                    placeholder="e.g. Kashem Ali"
                    className="w-full px-3.5 py-2.5 pr-10 bg-white/55 dark:bg-white/[0.05] border border-slate-900/[0.08] dark:border-white/[0.1] rounded-xl text-slate-950 dark:text-white font-medium text-sm focus:border-slate-900/40 dark:focus:border-white/40 outline-none transition-colors"
                  />
                  <User className="w-4 h-4 stroke-[1.25] text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Instruction description */}
            <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {cleanedNumbers.length > 1
                ? (lang === 'bn'
                    ? 'এই কন্টাক্টটিতে একাধিক নম্বর রয়েছে। আপনি যে নম্বরটি ব্যবহার করতে চান সেটি বেছে নিন:'
                    : 'This contact has multiple phone numbers. Choose the number to link:')
                : (lang === 'bn'
                    ? 'নিচের নম্বরটি যাচাই করে নিশ্চিত করুন:'
                    : 'Verify the phone number below and confirm:')}
            </div>

            {/* Phone Number Cards */}
            <div className="space-y-2">
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
                    className={`p-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-3 touch-manipulation select-none touch-press ${
                      isSelected
                        ? 'bg-slate-950 text-white border-2 border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white shadow-md'
                        : 'bg-white/45 border border-slate-900/[0.08] dark:bg-white/[0.04] dark:border-white/[0.08] text-slate-900 dark:text-white hover:bg-white/75 dark:hover:bg-white/[0.08]'
                    }`}
                  >
                    {/* Left: Radio Indicator & Formatted Number */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                        isSelected
                          ? 'border-white bg-white dark:border-slate-950 dark:bg-slate-950'
                          : 'border-slate-400/70 dark:border-slate-500 bg-transparent'
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-950 dark:bg-white" />}
                      </div>

                      <div className="min-w-0">
                        <div className={`font-mono text-base font-bold tracking-wide truncate tabular-nums ${isSelected ? 'text-white dark:text-slate-950' : 'text-slate-950 dark:text-white'}`}>
                          {displayFormatted}
                        </div>
                        <div className={`text-[11px] font-medium mt-0.5 flex items-center gap-1.5 ${isSelected ? 'text-white/75 dark:text-slate-700' : 'text-slate-500 dark:text-slate-400'}`}>
                          <Phone className="w-3 h-3 stroke-[1.25] shrink-0" />
                          <span className="font-mono">{num}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Operator Logo + Check */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      {operator.logoLight && operator.logoDark && (
                        operator.logoLight === operator.logoDark ? (
                          <img
                            src={operator.logoLight}
                            alt={operator.name}
                            decoding="async"
                            className={`h-6 max-w-[64px] w-auto object-contain block shrink-0 pointer-events-none select-none ${operator.logoLightClass || ''}`}
                          />
                        ) : (
                          <>
                            <img
                              src={isSelected ? operator.logoDark : operator.logoLight}
                              alt={operator.name}
                              decoding="async"
                              className={`h-6 max-w-[64px] w-auto object-contain block dark:hidden shrink-0 pointer-events-none select-none ${isSelected ? (operator.logoDarkClass || '') : (operator.logoLightClass || '')}`}
                            />
                            <img
                              src={isSelected ? operator.logoLight : operator.logoDark}
                              alt={operator.name}
                              decoding="async"
                              className={`h-6 max-w-[64px] w-auto object-contain hidden dark:block shrink-0 pointer-events-none select-none ${isSelected ? (operator.logoLightClass || '') : (operator.logoDarkClass || '')}`}
                            />
                          </>
                        )
                      )}
                      {isSelected && (
                        <Check className="w-4 h-4 stroke-[1.5] shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="px-4 sm:px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-5 border-t border-slate-900/[0.06] dark:border-white/[0.06] bg-white/40 dark:bg-white/[0.02] backdrop-blur-md space-y-2 shrink-0">
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full py-3.5 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-semibold rounded-full text-sm cursor-pointer transition-all flex items-center justify-center gap-2 touch-manipulation active:scale-[0.98] shadow-md"
            >
              {isNewAccount ? (
                <>
                  <UserPlus className="w-4 h-4 stroke-[1.5]" />
                  <span>{lang === 'bn' ? 'অ্যাকাউন্ট তৈরি ও নিশ্চিত করুন' : 'Confirm & Open Account'}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[1.5]" />
                  <span>{lang === 'bn' ? 'এই নম্বরটি নির্বাচন করুন' : 'Confirm & Use Number'}</span>
                </>
              )}
            </button>

            {isNewAccount && (
              <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? 'গ্রাহকটি সংরক্ষিত হবে এবং খতিয়ান প্রোফাইলটি সরাসরি ওপেন হবে'
                  : 'Customer account will be saved and opened immediately'}
              </p>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-white/50 hover:bg-white/80 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 border border-slate-900/[0.08] dark:border-white/[0.08] font-semibold rounded-full text-xs cursor-pointer transition-colors"
            >
              {lang === 'bn' ? 'বাতিল' : 'Cancel'}
            </button>
          </div>
        </motion.div>
      </div>
      )}
      </AnimatePresence>
    </ModalPortal>
  );
}
