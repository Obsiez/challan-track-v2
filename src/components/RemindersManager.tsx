import React, { useState } from 'react';
import { Customer, Reminder, SavingGoal } from '../types';
import {
  Bell, Calendar, User, Clock, AlertTriangle, Check,
  Volume2, X, CreditCard, CalendarClock, Info, Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations, formatNumber, Language } from '../lib/translations';
import { triggerHaptic } from '../lib/haptics';
import { toast } from 'sonner';
import { showNotification } from '../lib/notifications';
import { StaggerReveal } from './MotionPrimitives';
import ModalPortal from './ModalPortal';
import {
  NativeDatePicker,
  NativeTimePicker,
  NativeOptionPicker,
  NativeCustomerPicker
} from './NativePickers';

interface RemindersManagerProps {
  reminders: Reminder[];
  customers: Customer[];
  goals?: SavingGoal[];
  addReminder: (
    customerId: string,
    notes: string,
    dueDate: Date,
    extra?: {
      type?: 'customer' | 'emi';
      goalId?: string;
      customerName?: string;
      emiDayOfMonth?: number;
      installmentAmount?: number;
    }
  ) => Promise<void>;
  toggleReminder: (id: string, active: boolean) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  dailyReminderTime: string;
  updateSettings: (time: string) => Promise<void>;
  lang: Language;
}

export default function RemindersManager({
  reminders,
  customers,
  goals = [],
  addReminder,
  toggleReminder,
  deleteReminder,
  dailyReminderTime,
  updateSettings,
  lang
}: RemindersManagerProps) {
  const t = translations[lang];

  const [showAddForm, setShowAddForm] = useState(false);
  const [reminderCategory, setReminderCategory] = useState<'customer' | 'emi'>('customer');

  // Customer Due Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDateStr, setDueDateStr] = useState('');
  const [dueTimeStr, setDueTimeStr] = useState('10:00');

  // EMI Installment Form State
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [emiTitle, setEmiTitle] = useState('');
  const [emiDayOfMonth, setEmiDayOfMonth] = useState<number>(5);
  const [emiAmount, setEmiAmount] = useState('');
  const [emiTimeStr, setEmiTimeStr] = useState('09:00');

  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // In-app test trigger alert state
  const [testAlertText, setTestAlertText] = useState<string | null>(null);

  const handleGoalSelect = (goalId: string) => {
    setSelectedGoalId(goalId);
    const g = goals.find(item => item.id === goalId);
    if (g) {
      setEmiTitle(g.title);
      if (g.installmentAmount) {
        setEmiAmount(String(g.installmentAmount));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (reminderCategory === 'customer') {
      if (!selectedCustomerId) {
        setErrorMsg(lang === 'bn' ? 'অনুগ্রহ করে গ্রাহক নির্বাচন করুন।' : 'Choose a customer to remind.');
        return;
      }

      const existingCustomerReminder = reminders.find(
        r => r.active && (r.type === 'customer' || (!r.type && !r.goalId)) && r.customerId === selectedCustomerId
      );
      if (existingCustomerReminder) {
        const cust = customers.find(c => c.id === selectedCustomerId);
        setErrorMsg(
          lang === 'bn'
            ? `এই গ্রাহকের (${cust?.name || ''}) জন্য ইতিমধ্যে একটি সক্রিয় তাগাদা রিমাইন্ডার রয়েছে।`
            : `An active reminder already exists for this customer (${cust?.name || ''}).`
        );
        return;
      }

      if (!dueDateStr) {
        setErrorMsg(lang === 'bn' ? 'অনুগ্রহ করে তারিখ বেছে নিন।' : 'Please choose a due date.');
        return;
      }

      setIsSubmitting(true);
      try {
        const fullDate = new Date(`${dueDateStr}T${dueTimeStr}:00`);
        await addReminder(selectedCustomerId, notes, fullDate, {
          type: 'customer'
        });

        setSelectedCustomerId('');
        setNotes('');
        setDueDateStr('');
        setDueTimeStr('10:00');
        setShowAddForm(false);

        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
          }
        }
        toast.success(lang === 'bn' ? 'গ্রাহক রিমাইন্ডার সংরক্ষণ করা হয়েছে' : 'Customer reminder scheduled successfully');
      } catch (err) {
        setErrorMsg(lang === 'bn' ? 'রিমাইন্ডার সংরক্ষণ করা যায়নি।' : 'Failed to save reminder.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const title = emiTitle.trim();
      if (!title) {
        setErrorMsg(lang === 'bn' ? 'কিস্তি বা ঋণের শিরোনাম লিখুন।' : 'Please enter an EMI title.');
        return;
      }

      if (selectedGoalId) {
        const existingEmiReminder = reminders.find(
          r => r.active && r.type === 'emi' && r.goalId === selectedGoalId
        );
        if (existingEmiReminder) {
          setErrorMsg(
            lang === 'bn'
              ? 'এই কিস্তি বা লক্ষ্যের জন্য ইতিমধ্যে একটি সক্রিয় রিমাইন্ডার রয়েছে।'
              : 'An active reminder already exists for this EMI or goal.'
          );
          return;
        }
      }

      setIsSubmitting(true);
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        let nextDueDate = new Date(year, month, emiDayOfMonth);
        const [hr, min] = emiTimeStr.split(':').map(Number);
        nextDueDate.setHours(hr || 9, min || 0, 0, 0);

        if (nextDueDate.getTime() < now.getTime()) {
          nextDueDate = new Date(year, month + 1, emiDayOfMonth);
          nextDueDate.setHours(hr || 9, min || 0, 0, 0);
        }

        const amt = parseFloat(emiAmount) || undefined;
        await addReminder('', notes, nextDueDate, {
          type: 'emi',
          goalId: selectedGoalId || undefined,
          customerName: title,
          emiDayOfMonth,
          installmentAmount: amt
        });

        setSelectedGoalId('');
        setEmiTitle('');
        setEmiAmount('');
        setNotes('');
        setEmiDayOfMonth(5);
        setEmiTimeStr('09:00');
        setShowAddForm(false);

        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
          }
        }
        toast.success(lang === 'bn' ? 'মাসিক কিস্তির রিমাইন্ডার সক্রিয় করা হয়েছে' : 'Monthly EMI reminder activated successfully');
      } catch (err) {
        setErrorMsg(lang === 'bn' ? 'কিস্তি রিমাইন্ডার সংরক্ষণ করা যায়নি।' : 'Failed to save EMI reminder.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const currentActiveReminders = reminders.filter(r => r.active);

  const triggerDemoAlert = () => {
    const randomPick = currentActiveReminders[0] || {
      customerName: lang === 'bn' ? 'ওয়াহিদ জামান' : 'Wahid Zaman',
      notes: lang === 'bn' ? 'বকেয়া ১২০০ টাকা পরিশোধের ফলো-আপ।' : 'Follow up on ৳1,200 pending due.'
    };

    const message = `${lang === 'bn' ? 'খাতা রিমাইন্ডার' : 'LEDGER REMINDER'}: ${randomPick.customerName}! ${lang === 'bn' ? 'নোট' : 'Note'}: "${randomPick.notes}"`;
    setTestAlertText(message);

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      showNotification(lang === 'bn' ? 'চালান ট্র্যাক অ্যালার্ট' : 'Challan Track Alert', {
        body: lang === 'bn'
          ? `বকেয়া আদায়ের জন্য ${randomPick.customerName}-এর সাথে যোগাযোগ করতে মনে রাখুন!`
          : `Remember to contact ${randomPick.customerName} for pending dues!`,
        icon: '/icon-192.png'
      });
    }

    if (typeof window !== 'undefined') {
      triggerHaptic([200, 100, 200]);
    }
  };

  const labelCls = lang === 'bn'
    ? 'text-[11px] font-bold tracking-normal text-slate-500 dark:text-slate-400'
    : 'micro-mono-label font-semibold';

  const glassInputCls =
    'w-full px-3.5 py-2.5 bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-2xl text-slate-950 dark:text-white text-xs font-medium outline-none focus:border-slate-900/30 dark:focus:border-white/30 transition-colors';

  return (
    <div className="space-y-6 no-select">
      {/* Test alert banner popup */}
      <ModalPortal lockScroll={false}>
        <AnimatePresence>
          {testAlertText && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100vw-32px)] max-w-sm glass-modal text-slate-950 dark:text-white p-4 rounded-[26px] z-[100] flex flex-col gap-2.5 border border-slate-900/[0.08] dark:border-white/[0.12] shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold flex items-center gap-1.5 ${lang === 'bn' ? 'tracking-normal' : 'uppercase tracking-wider'} text-emerald-600 dark:text-emerald-400`}>
                  <Bell className="w-3.5 h-3.5 stroke-[1.25]" />
                  {t.liveNotification}
                </span>
                <button
                  onClick={() => setTestAlertText(null)}
                  className="w-7 h-7 rounded-full bg-slate-900/[0.05] hover:bg-slate-900/[0.1] dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5 stroke-[1.25]" />
                </button>
              </div>
              <p className="font-semibold text-xs sm:text-sm leading-snug text-slate-900 dark:text-white">{testAlertText}</p>
              <div className="flex items-center justify-between pt-2 border-t border-slate-900/[0.06] dark:border-white/[0.06]">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 shrink-0 stroke-[1.25]" />
                  {t.vibrationDemo}
                </span>
                <button
                  onClick={() => setTestAlertText(null)}
                  className="text-xs font-bold bg-slate-950 text-white dark:bg-white dark:text-slate-950 px-3.5 py-1.5 rounded-full cursor-pointer touch-press"
                >
                  {t.clearAlert}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </ModalPortal>

      {/* Open Editorial Header */}
      <section className="pt-1 flex items-end justify-between gap-3">
        <div>
          <span className={labelCls}>
            {lang === 'bn' ? 'অ্যালার্ট ও ফলো-আপ' : 'Follow-up Scheduler'}
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white tracking-tight mt-0.5 flex items-baseline gap-2.5">
            <span>{t.alarmTitle}</span>
            <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
              {formatNumber(currentActiveReminders.length, lang)} {lang === 'bn' ? 'টি সক্রিয়' : 'active'}
            </span>
          </h2>
        </div>
      </section>

      {/* Sleek Frosted Daily Recap Strip */}
      <div className="surface-glass rounded-[26px] border p-4 sm:p-5 space-y-3.5">
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {t.alarmDesc}
        </p>

        <div className="pt-3.5 border-t border-slate-900/[0.06] dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-900/[0.05] dark:bg-white/[0.06] flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-slate-700 dark:text-slate-300 stroke-[1.25]" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-950 dark:text-white">{t.dailyRecap}</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.dailyRecapDesc}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <NativeTimePicker
              value={dailyReminderTime || '09:00'}
              onChange={(val) => updateSettings(val)}
              lang={lang}
              title={t.dailyRecap}
              triggerClassName="px-3.5 py-2 rounded-full border border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-950 dark:text-white font-mono font-bold text-xs outline-none hover:border-slate-900/20 dark:hover:border-white/20 transition-colors flex items-center gap-2 cursor-pointer touch-press"
            />
            <button
              onClick={triggerDemoAlert}
              className="px-4 py-2 rounded-full bg-slate-900/[0.06] hover:bg-slate-900/[0.1] dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-950 dark:text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer touch-press"
            >
              <Volume2 className="w-3.5 h-3.5 stroke-[1.25]" />
              <span>{t.testAlarm}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Add Reminder Drawer */}
      <AnimatePresence>
        {showAddForm && (
          <motion.form
            initial={{ opacity: 0, y: -8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleSubmit}
            className="surface-glass border p-5 rounded-[28px] space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 stroke-[1.25]" />
                {t.scheduleContact}
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('tick');
                  setShowAddForm(false);
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.08] cursor-pointer transition-colors"
                title={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            {/* Category Switcher: Sliding Segmented Capsule */}
            <div className="relative surface-subcard grid grid-cols-2 gap-1 p-1 rounded-full border border-slate-900/[0.06] dark:border-white/[0.08]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-6px)] rounded-full bg-slate-950 dark:bg-white border-2 border-slate-950 dark:border-white shadow-xs will-change-transform transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  transform: `translate3d(${reminderCategory === 'emi' ? 'calc(100% + 4px)' : '0px'}, 0, 0)`,
                }}
              />
              <button
                type="button"
                onClick={() => { setReminderCategory('customer'); setErrorMsg(''); }}
                className={`relative z-10 py-2 px-3 rounded-full text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  reminderCategory === 'customer'
                    ? 'text-white dark:text-slate-950'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5 stroke-[1.25] relative z-10" />
                <span className="relative z-10">{lang === 'bn' ? 'ফলো-আপ' : 'Follow-up'}</span>
              </button>
              <button
                type="button"
                onClick={() => { setReminderCategory('emi'); setErrorMsg(''); }}
                className={`relative z-10 py-2 px-3 rounded-full text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  reminderCategory === 'emi'
                    ? 'text-white dark:text-slate-950'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <CalendarClock className="w-3.5 h-3.5 stroke-[1.25] relative z-10" />
                <span className="relative z-10">{lang === 'bn' ? 'কিস্তি' : 'Installment'}</span>
              </button>
            </div>

            {reminderCategory === 'customer' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className={`${labelCls} flex items-center gap-1`}>
                    <User className="w-3 h-3 stroke-[1.25]" />
                    {lang === 'bn' ? 'গ্রাহক অ্যাকাউন্ট' : 'Customer'}
                  </label>
                  <NativeCustomerPicker
                    customers={customers}
                    value={selectedCustomerId}
                    onChange={setSelectedCustomerId}
                    lang={lang}
                    title={lang === 'bn' ? 'গ্রাহক অ্যাকাউন্ট নির্বাচন' : 'Select Customer'}
                    placeholder={t.selectCustomerPrompt}
                    disabledCustomerIds={
                      new Set(
                        reminders
                          .filter(r => r.active && (r.type === 'customer' || (!r.type && !r.goalId)))
                          .map(r => r.customerId)
                      )
                    }
                    disabledBadgeText={lang === 'bn' ? 'ইতিমধ্যে সক্রিয়' : 'Already set'}
                    triggerClassName={`${glassInputCls} flex items-center justify-between gap-2 cursor-pointer text-left touch-press`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`${labelCls} block`}>
                    {lang === 'bn' ? 'রিমাইন্ডার নোট/বিবরণ' : 'Reminder Note'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Call for rice payment"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={glassInputCls}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`${labelCls} block`}>{t.targetDate}</label>
                  <NativeDatePicker
                    value={dueDateStr}
                    onChange={setDueDateStr}
                    lang={lang}
                    title={t.targetDate}
                    placeholder={lang === 'bn' ? 'তারিখ বেছে নিন' : 'Choose date'}
                    triggerClassName={`${glassInputCls} font-mono flex items-center justify-between gap-2 cursor-pointer text-left touch-press`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`${labelCls} block`}>{t.targetTime}</label>
                  <NativeTimePicker
                    value={dueTimeStr}
                    onChange={setDueTimeStr}
                    lang={lang}
                    title={t.targetTime}
                    triggerClassName={`${glassInputCls} font-mono font-bold flex items-center justify-between gap-2 cursor-pointer text-left touch-press`}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="p-3.5 bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.06] dark:border-white/[0.06] rounded-2xl text-xs text-slate-600 dark:text-slate-300 font-medium flex items-start gap-2.5">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 stroke-[1.25]" />
                  <p className="leading-relaxed">
                    {lang === 'bn'
                      ? 'প্রতি মাসে কিস্তির নির্দিষ্ট তারিখের ৭ দিন আগে থেকে প্রতিদিন নোটিফিকেশন পাঠানো হবে যাতে আপনার কিস্তির প্রস্তুতি থাকে।'
                      : 'A notification will be sent each day 7 days prior to remind you that your upcoming monthly EMI installment is coming.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {goals.length > 0 && (
                    <div className="space-y-1.5">
                      <label className={`${labelCls} flex items-center gap-1`}>
                        <CreditCard className="w-3 h-3 stroke-[1.25]" />
                        {lang === 'bn' ? 'সংরক্ষিত লক্ষ্য বা কিস্তি (ঐচ্ছিক)' : 'Linked Goal / EMI (Optional)'}
                      </label>
                      <NativeOptionPicker
                        value={selectedGoalId}
                        onChange={handleGoalSelect}
                        lang={lang}
                        title={lang === 'bn' ? 'সংরক্ষিত লক্ষ্য বা কিস্তি' : 'Linked Goal / EMI'}
                        placeholder={lang === 'bn' ? '-- নতুন কিস্তির নাম লিখুন --' : '-- Custom EMI Title --'}
                        options={[
                          {
                            value: '',
                            label: lang === 'bn' ? '-- নতুন কিস্তির নাম লিখুন --' : '-- Custom EMI Title --'
                          },
                          ...goals.filter(g => g.status === 'active').map(g => {
                            const hasActive = reminders.some(
                              r => r.active && r.type === 'emi' && r.goalId === g.id
                            );
                            return {
                              value: g.id,
                              label: g.title,
                              sublabel: `${g.type === 'deposit' ? 'EMI' : 'Savings'} · ৳${formatNumber(g.installmentAmount || g.targetAmount, lang)}${hasActive ? (lang === 'bn' ? ' — ইতিমধ্যে সক্রিয়' : ' — Already set') : ''}`,
                              disabled: hasActive
                            };
                          })
                        ]}
                        triggerClassName={`${glassInputCls} flex items-center justify-between gap-2 cursor-pointer text-left touch-press`}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className={`${labelCls} block`}>
                      {lang === 'bn' ? 'কিস্তি/ঋণের নাম' : 'EMI Title'} *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. TV Installment, Bank Loan"
                      value={emiTitle}
                      onChange={(e) => setEmiTitle(e.target.value)}
                      className={glassInputCls}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={`${labelCls} flex items-center gap-1`}>
                      <CalendarClock className="w-3 h-3 stroke-[1.25]" />
                      {lang === 'bn' ? 'প্রতি মাসের কিস্তির তারিখ' : 'Monthly Due Day'} *
                    </label>
                    <NativeOptionPicker
                      value={emiDayOfMonth}
                      onChange={setEmiDayOfMonth}
                      lang={lang}
                      title={lang === 'bn' ? 'মাসের তারিখ বেছে নিন' : 'Monthly Due Day'}
                      gridColumns={7}
                      options={Array.from({ length: 31 }, (_, i) => i + 1).map(day => ({
                        value: day,
                        label: lang === 'bn' ? `প্রতি মাসের ${formatNumber(day, 'bn')} তারিখ` : `Every month on day ${day}`,
                        compactLabel: formatNumber(day, lang)
                      }))}
                      triggerClassName={`${glassInputCls} font-bold flex items-center justify-between gap-2 cursor-pointer text-left touch-press`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={`${labelCls} block`}>
                      {lang === 'bn' ? 'কিস্তির পরিমাণ (৳)' : 'Installment Amount (৳)'}
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 5000"
                      value={emiAmount}
                      onChange={(e) => setEmiAmount(e.target.value)}
                      className={`${glassInputCls} font-mono font-bold`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={`${labelCls} block`}>
                      {lang === 'bn' ? 'নোটিফিকেশন সময়' : 'Daily Alert Time'}
                    </label>
                    <NativeTimePicker
                      value={emiTimeStr}
                      onChange={setEmiTimeStr}
                      lang={lang}
                      title={lang === 'bn' ? 'নোটিফিকেশন সময়' : 'Daily Alert Time'}
                      triggerClassName={`${glassInputCls} font-mono font-bold flex items-center justify-between gap-2 cursor-pointer text-left touch-press`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={`${labelCls} block`}>
                      {lang === 'bn' ? 'নোট বা মন্তব্য (ঐচ্ছিক)' : 'Note (Optional)'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Pay via Bkash or bank transfer"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className={glassInputCls}
                    />
                  </div>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 p-3 bg-rose-500/10 rounded-2xl">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 stroke-[1.25]" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2.5 bg-slate-900/[0.04] hover:bg-slate-900/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-950 dark:text-white font-semibold rounded-full text-xs cursor-pointer transition-colors"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold rounded-full text-xs cursor-pointer touch-press transition-colors"
              >
                {reminderCategory === 'emi'
                  ? (lang === 'bn' ? 'কিস্তি অ্যালার্ট চালু করুন' : 'Enable EMI Alert')
                  : t.scheduleNow
                }
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Scheduled Reminders Hairline Timeline */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className={labelCls}>
              {lang === 'bn' ? 'সংরক্ষিত অ্যালার্ট তালিকা' : 'Scheduled Follow-ups'}
            </h3>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              ({formatNumber(reminders.length, lang)})
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('single');
              setShowAddForm(!showAddForm);
            }}
            className="text-xs font-bold text-slate-900 dark:text-white hover:opacity-75 flex items-center gap-1 cursor-pointer touch-press p-0 bg-transparent shrink-0"
          >
            {showAddForm ? (
              <>
                <X className="w-3.5 h-3.5 stroke-[1.5]" />
                <span>{lang === 'bn' ? 'বন্ধ' : 'Close'}</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 stroke-[1.5]" />
                <span>{t.scheduleTitle}</span>
              </>
            )}
          </button>
        </div>

        {reminders.length === 0 ? (
          <div className="surface-glass border rounded-[28px] p-10 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-full bg-slate-900/[0.04] dark:bg-white/[0.06] flex items-center justify-center mb-1">
              <Bell className="w-5 h-5 stroke-[1.25] text-slate-400" />
            </div>
            <p className="font-bold text-sm text-slate-950 dark:text-white">{t.noRemindersYet}</p>
            <p className="text-xs max-w-xs">{t.scheduleOneNotice}</p>
          </div>
        ) : (
          <div className="surface-glass border rounded-[28px] divide-y divide-slate-900/[0.06] dark:divide-white/[0.06] overflow-hidden">
            {reminders.map((rem, idx) => {
              const isEmi = rem.type === 'emi';
              return (
                <StaggerReveal key={rem.id} index={idx} staggerMs={40}>
                  <div
                    className={`p-4 sm:px-5 flex items-start justify-between gap-3.5 transition-opacity ${
                      rem.active ? '' : 'opacity-50'
                    }`}
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('single');
                          toggleReminder(rem.id, !rem.active);
                        }}
                        className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer touch-press border ${
                          rem.active
                            ? 'bg-slate-950 border-slate-950 text-white dark:bg-white dark:border-white dark:text-slate-950'
                            : 'border-slate-400/50 dark:border-white/25 text-transparent hover:border-slate-950 dark:hover:border-white'
                        }`}
                        aria-label="Toggle reminder"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[1.75]" />
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className={`text-sm font-bold truncate ${rem.active ? 'text-slate-950 dark:text-white' : 'text-slate-500 line-through'}`}>
                            {rem.customerName}
                          </span>
                          <span className={`text-[10px] font-semibold ${
                            isEmi
                              ? 'text-[var(--accent-color)]'
                              : rem.active
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-400'
                          }`}>
                            {isEmi
                              ? (lang === 'bn'
                                  ? `· মাসিক কিস্তি${rem.active ? ' · ৭ দিন আগে তাগাদা' : ''}`
                                  : `· Monthly EMI${rem.active ? ' · 7d Daily Alert' : ''}`)
                              : rem.active
                                ? `· ${t.activeAlert}`
                                : ''}
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {rem.notes || (isEmi ? (lang === 'bn' ? 'মাসিক কিস্তি পরিশোধ' : 'Monthly installment payment') : t.contactRegardingDue)}
                          {rem.installmentAmount ? ` · ৳${formatNumber(rem.installmentAmount, lang)}` : ''}
                        </p>

                        <div className={`flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 ${lang === 'bn' ? 'tracking-normal font-medium' : 'font-mono'} flex-wrap`}>
                          {isEmi && rem.emiDayOfMonth ? (
                            <>
                              <span>
                                {lang === 'bn' ? `প্রতি মাসের ${formatNumber(rem.emiDayOfMonth, 'bn')} তারিখ` : `Day ${rem.emiDayOfMonth} monthly`}
                              </span>
                              <span>·</span>
                              <span>{lang === 'bn' ? 'পরবর্তী' : 'Next'}</span>
                            </>
                          ) : null}
                          <span>
                            {new Date(rem.dueDate).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <span>·</span>
                          <span>
                            {new Date(rem.dueDate).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        triggerHaptic('single');
                        deleteReminder(rem.id);
                        toast.info(lang === 'bn' ? 'রিমাইন্ডার মুছে ফেলা হয়েছে' : 'Reminder deleted');
                      }}
                      className="w-8 h-8 rounded-full bg-slate-900/[0.04] hover:bg-rose-500/10 dark:bg-white/[0.05] dark:hover:bg-rose-500/20 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                      title="Delete reminder alarm"
                    >
                      <X className="w-3.5 h-3.5 stroke-[1.25]" />
                    </button>
                  </div>
                </StaggerReveal>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
