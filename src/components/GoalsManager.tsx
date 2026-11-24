import React, { useState, useEffect, useRef } from 'react';
import { Customer, SavingGoal, GoalContribution, Reminder } from '../types';
import { 
  Target, Calendar, Plus, Users, Trash2, CheckCircle2, ChevronRight, ChevronDown, CreditCard, X, AlertCircle, ReceiptText, AlertTriangle, PiggyBank, CalendarClock, RotateCcw, Goal, Percent, Calculator, Bell, BellRing, Info, Pencil, Check, User, Wallet, ArrowDownLeft, ArrowUpRight, Minus, Sprout 
} from 'lucide-react';
import { triggerHaptic } from '../lib/haptics';
import { translations, Language, formatNumber, formatIndianNumberString } from '../lib/translations';
import { toast } from 'sonner';
import { StaggerReveal, SpotlightCard, CircularGauge } from './MotionPrimitives';
import ModalPortal, { useModalScrollLock } from './ModalPortal';
import {
  NativeTimePicker,
  NativeOptionPicker,
  NativeCustomerPicker
} from './NativePickers';

interface GoalsManagerProps {
  goals: SavingGoal[];
  goalsSynced: boolean;
  customers: Customer[];
  createGoal: (
    title: string,
    targetAmount: number,
    frequency: 'daily' | 'weekly' | 'monthly' | 'flexible',
    installmentAmount?: number,
    type?: 'savings' | 'deposit',
    customerId?: string,
    customerName?: string,
    notes?: string,
    principalAmount?: number,
    interestRate?: number,
    interestAmount?: number,
    tenure?: number,
    isOpenEnded?: boolean
  ) => Promise<string | null>;
  addGoalContribution: (
    goalId: string,
    amount: number,
    note?: string,
    recordAsCustomerTransaction?: boolean,
    contributionType?: 'deposit' | 'withdrawal'
  ) => Promise<SavingGoal | null | void>;
  deleteGoal: (goalId: string) => Promise<void>;
  updateGoalStatus: (goalId: string, status: 'active' | 'completed' | 'cancelled') => Promise<void>;
  updateGoalTitle?: (goalId: string, newTitle: string) => Promise<void>;
  updateGoalNotes?: (goalId: string, newNotes: string) => Promise<void>;
  editGoalContribution?: (goalId: string, contributionId: string, newAmount: number, newNote: string) => Promise<void>;
  deleteGoalContribution?: (goalId: string, contributionId: string) => Promise<void>;
  reminders?: Reminder[];
  addReminder?: (
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
  deleteReminder?: (id: string) => Promise<void>;
  lang: Language;
}

// Helper to parse numeric string safely supporting Bengali numerals
const parseAmount = (val: string): number => {
  if (!val) return 0;
  const ascii = val.replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
  const clean = ascii.replace(/[^0-9.]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

export default function GoalsManager({
  goals,
  goalsSynced,
  customers,
  createGoal,
  addGoalContribution,
  deleteGoal,
  updateGoalStatus,
  updateGoalTitle,
  updateGoalNotes,
  editGoalContribution,
  deleteGoalContribution,
  reminders = [],
  addReminder,
  deleteReminder,
  lang
}: GoalsManagerProps) {
  const t = translations[lang];

  const pendingHistoryPopsRef = useRef<number>(0);

  // Tab filter: 'active' or 'history'
  const [filterTab, setFilterTab] = useState<'active' | 'history'>('active');

  // Create Goal Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isOpenEndedSavings, setIsOpenEndedSavings] = useState<boolean>(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [goalType, setGoalType] = useState<'savings' | 'deposit'>('deposit');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'flexible'>('monthly');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // 4. EMI Custom Setup: Tenure & Interest Rate
  const [tenure, setTenure] = useState<string>('6'); // Default 6 months tenure
  const [hasInterest, setHasInterest] = useState<boolean>(false);
  const [interestRate, setInterestRate] = useState<string>('10'); // Default 10% annual/fee

  // Selected Goal Details Modal state
  const [selectedGoal, setSelectedGoal] = useState<SavingGoal | null>(null);
  const [showInstallmentForm, setShowInstallmentForm] = useState(false);
  const [contributionActionType, setContributionActionType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [isEmiBreakdownOpen, setIsEmiBreakdownOpen] = useState(false);
  const [installmentInput, setInstallmentInput] = useState('');
  const [installmentNote, setInstallmentNote] = useState('');
  const [syncToLedger, setSyncToLedger] = useState(true);

  // 1 & 2. Custom Confirmation Popups (Learned from Move Customer to Trash and Restore)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReactivateConfirm, setShowReactivateConfirm] = useState(false);

  // EMI Notification Reminder Modal State
  const [emiReminderGoal, setEmiReminderGoal] = useState<SavingGoal | null>(null);
  const [emiDueDay, setEmiDueDay] = useState<number>(5);
  const [emiAlertTime, setEmiAlertTime] = useState<string>('09:00');
  const [isSavingEmiReminder, setIsSavingEmiReminder] = useState(false);

  // Goal Title Editing (Popup Modal)
  const [isEditingGoalTitle, setIsEditingGoalTitle] = useState(false);
  const [editedGoalTitle, setEditedGoalTitle] = useState('');
  const [isSavingGoalTitle, setIsSavingGoalTitle] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const installmentInputRef = useRef<HTMLInputElement>(null);
  const createGoalScrollRef = useRef<HTMLDivElement>(null);

  const centerNativeInput = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const input = e.currentTarget;
    const container = createGoalScrollRef.current;
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

  // Goal Description / Notes Editing inside Goal Detail Popup
  const [isEditingGoalNotes, setIsEditingGoalNotes] = useState(false);
  const [editedGoalNotes, setEditedGoalNotes] = useState('');
  const [isSavingGoalNotes, setIsSavingGoalNotes] = useState(false);

  // Contribution Ledger Edit / Delete
  const [editingContribution, setEditingContribution] = useState<GoalContribution | null>(null);
  const [editContribAmount, setEditContribAmount] = useState('');
  const [editContribNote, setEditContribNote] = useState('');
  const [isSavingEditContrib, setIsSavingEditContrib] = useState(false);

  const [deletingContribution, setDeletingContribution] = useState<GoalContribution | null>(null);
  const [isDeletingContrib, setIsDeletingContrib] = useState(false);

  const pushModalHistory = (name: string) => {
    window.history.pushState({ ...window.history.state, goalModal: name }, '');
  };

  const popModalHistory = (expectedModal?: string) => {
    if (window.history.state?.goalModal && (!expectedModal || window.history.state?.goalModal === expectedModal)) {
      pendingHistoryPopsRef.current += 1;
      window.history.back();
      setTimeout(() => {
        if (pendingHistoryPopsRef.current > 0) {
          pendingHistoryPopsRef.current -= 1;
        }
      }, 500);
    }
  };

  const openGoalDetail = (goal: SavingGoal) => {
    triggerHaptic('single');
    setIsEditingGoalNotes(false);
    setSelectedGoal({ ...goal });
    pushModalHistory('goalDetail');
  };

  const closeGoalDetail = () => {
    setIsEditingGoalTitle(false);
    setIsEditingGoalNotes(false);
    setEditingContribution(null);
    setDeletingContribution(null);
    setEmiReminderGoal(null);
    setShowCancelConfirm(false);
    setShowDeleteConfirm(false);
    setShowReactivateConfirm(false);
    setSelectedGoal(null);
    popModalHistory('goalDetail');
  };

  const openRenameGoal = () => {
    if (!selectedGoal) return;
    triggerHaptic('single');
    setEditedGoalTitle(selectedGoal.title);
    setIsEditingGoalTitle(true);
    pushModalHistory('renameGoal');
  };

  const closeRenameGoal = () => {
    setIsEditingGoalTitle(false);
    popModalHistory('renameGoal');
  };

  const openCreateGoalModal = () => {
    triggerHaptic('single');
    setShowCreateModal(true);
    pushModalHistory('createGoal');
  };

  const closeCreateGoalModal = () => {
    setShowCreateModal(false);
    popModalHistory('createGoal');
  };

  const openEditContributionModal = (c: GoalContribution) => {
    triggerHaptic('single');
    setEditingContribution(c);
    setEditContribAmount(c.amount.toString());
    setEditContribNote(c.note || '');
    pushModalHistory('editContrib');
  };

  const closeEditContributionModal = () => {
    setEditingContribution(null);
    popModalHistory('editContrib');
  };

  const openDeleteContributionModal = (c: GoalContribution) => {
    triggerHaptic('single');
    setDeletingContribution(c);
    pushModalHistory('deleteContrib');
  };

  const closeDeleteContributionModal = () => {
    setDeletingContribution(null);
    popModalHistory('deleteContrib');
  };

  const openEmiReminderModal = (goal: SavingGoal) => {
    triggerHaptic('single');
    setEmiReminderGoal(goal);
    const existing = reminders.find(r => r.goalId === goal.id && r.active);
    if (existing?.emiDayOfMonth) {
      setEmiDueDay(existing.emiDayOfMonth);
    }
    if (existing?.dueDate) {
      const d = new Date(existing.dueDate);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      setEmiAlertTime(`${hh}:${mm}`);
    }
    pushModalHistory('emiReminder');
  };

  const closeEmiReminderModal = () => {
    setEmiReminderGoal(null);
    popModalHistory('emiReminder');
  };

  const openDeleteGoalConfirm = () => {
    triggerHaptic('single');
    setShowDeleteConfirm(true);
    pushModalHistory('deleteGoalConfirm');
  };

  const closeDeleteGoalConfirm = () => {
    setShowDeleteConfirm(false);
    popModalHistory('deleteGoalConfirm');
  };

  const openCancelGoalConfirm = () => {
    triggerHaptic('single');
    setShowCancelConfirm(true);
    pushModalHistory('cancelGoalConfirm');
  };

  const closeCancelGoalConfirm = () => {
    setShowCancelConfirm(false);
    popModalHistory('cancelGoalConfirm');
  };

  const openReactivateGoalConfirm = () => {
    triggerHaptic('single');
    setShowReactivateConfirm(true);
    pushModalHistory('reactivateGoalConfirm');
  };

  const closeReactivateGoalConfirm = () => {
    setShowReactivateConfirm(false);
    popModalHistory('reactivateGoalConfirm');
  };

  // Back Navigation / PopState Listener
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (pendingHistoryPopsRef.current > 0) {
        pendingHistoryPopsRef.current -= 1;
        return;
      }

      const currentModalInHistory = e.state?.goalModal;

      // Case 1: Popped back to base (no goalModal in state)
      if (!currentModalInHistory) {
        setIsEditingGoalTitle(false);
        setEditingContribution(null);
        setDeletingContribution(null);
        setEmiReminderGoal(null);
        setShowCancelConfirm(false);
        setShowDeleteConfirm(false);
        setShowReactivateConfirm(false);
        setSelectedGoal(null);
        setShowCreateModal(false);
        return;
      }

      // Case 2: Popped back to goalDetail (from renameGoal, editContrib, deleteContrib, etc.)
      if (currentModalInHistory === 'goalDetail') {
        setIsEditingGoalTitle(false);
        setEditingContribution(null);
        setDeletingContribution(null);
        setEmiReminderGoal(null);
        setShowCancelConfirm(false);
        setShowDeleteConfirm(false);
        setShowReactivateConfirm(false);
        // selectedGoal remains open!
        return;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Body scroll lock while any GoalsManager popup is open
  useModalScrollLock(
    showCreateModal ||
    !!selectedGoal ||
    !!emiReminderGoal ||
    showCancelConfirm ||
    showDeleteConfirm ||
    showReactivateConfirm ||
    isEditingGoalTitle ||
    !!editingContribution ||
    !!deletingContribution
  );

  // Escape key dismissal prioritizing topmost nested modal
  useEffect(() => {
    const anyModalOpen =
      showCreateModal ||
      !!selectedGoal ||
      !!emiReminderGoal ||
      showCancelConfirm ||
      showDeleteConfirm ||
      showReactivateConfirm ||
      isEditingGoalTitle ||
      !!editingContribution ||
      !!deletingContribution;
    if (!anyModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showDeleteConfirm) {
        closeDeleteGoalConfirm();
      } else if (showCancelConfirm) {
        closeCancelGoalConfirm();
      } else if (showReactivateConfirm) {
        closeReactivateGoalConfirm();
      } else if (emiReminderGoal) {
        closeEmiReminderModal();
      } else if (deletingContribution) {
        closeDeleteContributionModal();
      } else if (editingContribution) {
        closeEditContributionModal();
      } else if (isEditingGoalTitle) {
        closeRenameGoal();
      } else if (selectedGoal) {
        closeGoalDetail();
      } else if (showCreateModal) {
        closeCreateGoalModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showCreateModal,
    selectedGoal,
    emiReminderGoal,
    showCancelConfirm,
    showDeleteConfirm,
    showReactivateConfirm,
    isEditingGoalTitle,
    editingContribution,
    deletingContribution
  ]);

  // Sync selectedGoal when goals list is updated
  useEffect(() => {
    if (selectedGoal) {
      const fresh = goals.find(g => g.id === selectedGoal.id);
      if (fresh) {
        setSelectedGoal(fresh);
      }
    }
  }, [goals]);

  // Automatically place cursor in amount input when Add Contribution / Deposit / Withdraw is pressed
  useEffect(() => {
    if (showInstallmentForm) {
      const focusInput = () => {
        if (installmentInputRef.current) {
          installmentInputRef.current.focus();
        }
      };
      focusInput();
      const rafId = requestAnimationFrame(focusInput);
      return () => cancelAnimationFrame(rafId);
    }
  }, [showInstallmentForm, contributionActionType]);

  const handleSaveGoalTitle = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedGoal || !updateGoalTitle) return;
    const trimmed = editedGoalTitle.trim();
    if (!trimmed) {
      toast.error(lang === 'bn' ? 'লক্ষ্যের শিরোনাম ফাঁকা রাখা যাবে না' : 'Goal title cannot be empty');
      return;
    }
    setIsSavingGoalTitle(true);
    try {
      await updateGoalTitle(selectedGoal.id, trimmed);
      setSelectedGoal(prev => prev ? { ...prev, title: trimmed } : null);
      closeRenameGoal();
      triggerHaptic('single');
      toast.success(lang === 'bn' ? 'লক্ষ্যের শিরোনাম আপডেট করা হয়েছে' : 'Goal title updated successfully');
    } catch (err) {
      console.error(err);
      toast.error(lang === 'bn' ? 'শিরোনাম আপডেট করতে ব্যর্থ হয়েছে' : 'Failed to update goal title');
    } finally {
      setIsSavingGoalTitle(false);
    }
  };

  const handleSaveGoalNotes = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedGoal || !updateGoalNotes) return;
    const trimmed = editedGoalNotes.trim();
    setIsSavingGoalNotes(true);
    try {
      await updateGoalNotes(selectedGoal.id, trimmed);
      setSelectedGoal(prev => prev ? { ...prev, notes: trimmed || undefined } : null);
      setIsEditingGoalNotes(false);
      triggerHaptic('single');
      toast.success(lang === 'bn' ? 'নোট সংরক্ষণ করা হয়েছে' : 'Notes updated successfully');
    } catch (err) {
      console.error(err);
      toast.error(lang === 'bn' ? 'নোট আপডেট করতে ব্যর্থ হয়েছে' : 'Failed to update notes');
    } finally {
      setIsSavingGoalNotes(false);
    }
  };

  const handleSaveEditContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal || !editingContribution || !editGoalContribution) return;
    const parsedAmount = parseAmount(editContribAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error(lang === 'bn' ? 'সঠিক পরিমাণ লিখুন' : 'Please enter a valid amount');
      return;
    }
    setIsSavingEditContrib(true);
    try {
      const contribId = editingContribution.id || editingContribution.date;
      await editGoalContribution(selectedGoal.id, contribId, parsedAmount, editContribNote);
      closeEditContributionModal();
      triggerHaptic('single');
      toast.success(lang === 'bn' ? 'জমার বিবরণ আপডেট করা হয়েছে' : 'Contribution updated successfully');
    } catch (err) {
      console.error(err);
      toast.error(lang === 'bn' ? 'আপডেট করতে ব্যর্থ হয়েছে' : 'Failed to update contribution');
    } finally {
      setIsSavingEditContrib(false);
    }
  };

  const handleConfirmDeleteContribution = async () => {
    if (!selectedGoal || !deletingContribution || !deleteGoalContribution) return;
    setIsDeletingContrib(true);
    try {
      const contribId = deletingContribution.id || deletingContribution.date;
      await deleteGoalContribution(selectedGoal.id, contribId);
      closeDeleteContributionModal();
      triggerHaptic('single');
      toast.success(lang === 'bn' ? 'জমা মুছে ফেলা হয়েছে' : 'Contribution deleted successfully');
    } catch (err) {
      console.error(err);
      toast.error(lang === 'bn' ? 'মুছে ফেলতে ব্যর্থ হয়েছে' : 'Failed to delete contribution');
    } finally {
      setIsDeletingContrib(false);
    }
  };

  const handleSaveEmiReminder = async () => {
    if (!emiReminderGoal || !addReminder) return;
    setIsSavingEmiReminder(true);
    try {
      // If an existing reminder exists for this goal, delete it first
      const existing = reminders.find(r => r.goalId === emiReminderGoal.id);
      if (existing && deleteReminder) {
        await deleteReminder(existing.id);
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const day = Math.min(31, Math.max(1, Number(emiDueDay)));
      
      let targetMonth = month;
      let targetYear = year;
      if (now.getDate() > day) {
        targetMonth = month + 1;
        if (targetMonth > 11) {
          targetMonth = 0;
          targetYear++;
        }
      }
      const [hours, minutes] = emiAlertTime.split(':').map(Number);
      const dueDate = new Date(targetYear, targetMonth, day, hours || 9, minutes || 0, 0);

      await addReminder(
        emiReminderGoal.customerId || '',
        lang === 'bn' 
          ? `${emiReminderGoal.title} - মাসিক কিস্তি পরিশোধের সময় এসেছে` 
          : `${emiReminderGoal.title} - Monthly Installment Due`,
        dueDate,
        {
          type: 'emi',
          goalId: emiReminderGoal.id,
          customerName: emiReminderGoal.title,
          emiDayOfMonth: day,
          installmentAmount: emiReminderGoal.installmentAmount || emiReminderGoal.targetAmount
        }
      );

      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
          Notification.requestPermission();
        }
      }

      triggerHaptic('double');
      toast.success(
        lang === 'bn' 
          ? `মাসিক কিস্তির অ্যালার্ট সক্রিয় করা হয়েছে (প্রতি মাসের ${formatNumber(day, 'bn')} তারিখ)` 
          : `EMI reminder set for day ${day} of every month!`
      );
      closeEmiReminderModal();
    } catch (err) {
      toast.error(lang === 'bn' ? 'রিমাইন্ডার সংরক্ষণ করা যায়নি।' : 'Failed to save reminder.');
    } finally {
      setIsSavingEmiReminder(false);
    }
  };

  const handleRemoveEmiReminder = async () => {
    if (!emiReminderGoal || !deleteReminder) return;
    const existing = reminders.find(r => r.goalId === emiReminderGoal.id);
    if (existing) {
      await deleteReminder(existing.id);
      triggerHaptic('single');
      toast.info(lang === 'bn' ? 'কিস্তির অ্যালার্ট বন্ধ করা হয়েছে' : 'EMI reminder turned off');
    }
    closeEmiReminderModal();
  };

  useEffect(() => {
    setIsEmiBreakdownOpen(false);
  }, [selectedGoal?.id]);

  // Computed lists
  const activeGoals = goals.filter(g => g.status === 'active');
  const historyGoals = goals.filter(g => g.status !== 'active');
  const visibleGoals = filterTab === 'active' ? activeGoals : historyGoals;

  const handleAmountChange = (val: string, setter: (s: string) => void) => {
    const ascii = val.replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
    const clean = ascii.replace(/[^0-9.]/g, '');
    const dots = clean.split('.');
    let sanitized = clean;
    if (dots.length > 2) {
      sanitized = dots[0] + '.' + dots.slice(1).join('');
    }
    setter(formatIndianNumberString(sanitized));
  };

  // 4. Auto-calculate EMI installment when principal, tenure, frequency, or interest changes
  useEffect(() => {
    if (goalType !== 'deposit' || frequency === 'flexible') return;
    const P = parseAmount(targetAmount);
    const N = parseInt(tenure) || 0;
    if (P > 0 && N > 0) {
      let interestAmt = 0;
      if (hasInterest) {
        const r = parseFloat(interestRate) || 0;
        const years = frequency === 'monthly' ? N / 12 : frequency === 'weekly' ? N / 52 : N / 360;
        interestAmt = Math.round(P * (r / 100) * years);
      }
      const totalPayable = P + interestAmt;
      const emi = Math.ceil(totalPayable / N);
      setInstallmentAmount(formatIndianNumberString(String(emi)));
    }
  }, [targetAmount, tenure, frequency, hasInterest, interestRate, goalType]);

  // Quick helper to compute EMI calculation preview
  const emiPreview = React.useMemo(() => {
    if (goalType !== 'deposit') return null;
    const P = parseAmount(targetAmount);
    const N = parseInt(tenure) || 0;
    if (P <= 0 || N <= 0 || frequency === 'flexible') return null;
    let interestAmt = 0;
    if (hasInterest) {
      const r = parseFloat(interestRate) || 0;
      const years = frequency === 'monthly' ? N / 12 : frequency === 'weekly' ? N / 52 : N / 360;
      interestAmt = Math.round(P * (r / 100) * years);
    }
    const total = P + interestAmt;
    const emi = Math.ceil(total / N);
    return { principal: P, interest: interestAmt, total, emi, count: N };
  }, [targetAmount, tenure, frequency, hasInterest, interestRate, goalType]);

  // Helper to extract EMI specs from selectedGoal (or parse fallback from notes if legacy)
  const selectedGoalEmiDetails = React.useMemo(() => {
    if (!selectedGoal) return null;
    let principal = selectedGoal.principalAmount;
    let interestRate = selectedGoal.interestRate;
    let interestAmount = selectedGoal.interestAmount;
    let tenure = selectedGoal.tenure;

    // Fallback parser if fields not stored directly but present in legacy notes
    if (selectedGoal.notes && (!principal || !tenure)) {
      const pMatch = selectedGoal.notes.match(/Principal:\s*[৳Tk.]*\s*([0-9,]+)/i);
      if (pMatch && !principal) principal = parseAmount(pMatch[1]);

      const feeMatch = selectedGoal.notes.match(/Fee:\s*[৳Tk.]*\s*([0-9,]+)/i);
      if (feeMatch && interestAmount === undefined) interestAmount = parseAmount(feeMatch[1]);

      const rateMatch = selectedGoal.notes.match(/\((\d+(?:\.\d+)?)\s*%\)/);
      if (rateMatch && interestRate === undefined) interestRate = parseFloat(rateMatch[1]);

      const tenureMatch = selectedGoal.notes.match(/EMI:\s*(\d+)/i);
      if (tenureMatch && !tenure) tenure = parseInt(tenureMatch[1], 10);
    }

    if (!principal && selectedGoal.type === 'deposit') {
      principal = Math.max(0, selectedGoal.targetAmount - (interestAmount || 0));
    }

    const hasEmiInfo = selectedGoal.type === 'deposit' || principal !== undefined || tenure !== undefined;
    if (!hasEmiInfo) return null;

    const tenureUnit = selectedGoal.frequency === 'monthly' 
      ? (lang === 'bn' ? 'মাস' : 'Months') 
      : selectedGoal.frequency === 'weekly' 
        ? (lang === 'bn' ? 'সপ্তাহ' : 'Weeks') 
        : (lang === 'bn' ? 'দিন' : 'Days');

    const cleanNotes = selectedGoal.notes 
      ? selectedGoal.notes.replace(/\s*•?\s*EMI:\s*\d+.*$/i, '').replace(/^EMI:\s*\d+.*$/i, '').trim() 
      : '';

    return {
      principal: principal || selectedGoal.targetAmount,
      interestRate,
      interestAmount: interestAmount || 0,
      tenure,
      tenureUnit,
      cleanNotes
    };
  }, [selectedGoal, lang]);

  // Clean user-entered notes for selectedGoal (empty if user didn't fill it)
  const cleanSelectedGoalNotes = React.useMemo(() => {
    if (!selectedGoal?.notes) return '';
    return selectedGoal.notes
      .replace(/\s*•?\s*EMI:\s*\d+.*$/i, '')
      .replace(/^EMI:\s*\d+.*$/i, '')
      .trim();
  }, [selectedGoal?.notes]);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    triggerHaptic('single');

    if (!goalTitle.trim()) {
      setFormError(lang === 'bn' ? 'লক্ষ্যের শিরোনাম লিখুন' : 'Please enter a goal title');
      return;
    }

    const isPiggyBank = goalType === 'savings' && isOpenEndedSavings;
    const effectiveGoalType = goalType;
    const effectiveIsOpenEnded = isPiggyBank;

    const principalVal = isPiggyBank ? 0 : parseAmount(targetAmount);
    if (!isPiggyBank && (!principalVal || principalVal <= 0)) {
      setFormError(lang === 'bn' ? 'টার্গেট পরিমাণ সঠিক নয়' : 'Please enter a valid target amount');
      return;
    }

    // Determine target amount (with interest if applicable)
    let finalTargetVal = isPiggyBank ? 0 : (principalVal || 0);
    const finalNote = notes.trim();

    if (effectiveGoalType === 'deposit' && frequency !== 'flexible') {
      const N = parseInt(tenure) || 0;
      if (N <= 0) {
        setFormError(lang === 'bn' ? 'কিস্তির মেয়াদ সঠিক নয়' : 'Please enter a valid tenure');
        return;
      }
      if (hasInterest) {
        const r = parseFloat(interestRate) || 0;
        const years = frequency === 'monthly' ? N / 12 : frequency === 'weekly' ? N / 52 : N / 360;
        const interestAmt = Math.round(principalVal * (r / 100) * years);
        finalTargetVal = principalVal + interestAmt;
      }
    }

    const instVal = installmentAmount ? parseAmount(installmentAmount) : undefined;
    if (!isPiggyBank && instVal !== undefined && instVal <= 0) {
      setFormError(lang === 'bn' ? 'কিস্তির পরিমাণ সঠিক নয়' : 'Please enter a valid installment amount');
      return;
    }
    if (!isPiggyBank && instVal !== undefined && finalTargetVal > 0 && instVal > finalTargetVal) {
      setFormError(lang === 'bn' ? 'কিস্তির পরিমাণ মোট লক্ষ্যের চেয়ে বেশি হতে পারে না' : 'Installment cannot be greater than target amount');
      return;
    }

    setIsSubmitting(true);

    const linkedCust = customers.find(c => c.id === selectedCustomerId);
    const tenureNum = parseInt(tenure) || 0;
    const interestAmt = (effectiveGoalType === 'deposit' && hasInterest)
      ? Math.round(principalVal * ((parseFloat(interestRate) || 0) / 100) * (frequency === 'monthly' ? tenureNum / 12 : frequency === 'weekly' ? tenureNum / 52 : tenureNum / 360))
      : 0;

    try {
      const res = await createGoal(
        goalTitle.trim(),
        finalTargetVal,
        isPiggyBank ? 'flexible' : frequency,
        isPiggyBank ? undefined : instVal,
        effectiveGoalType,
        selectedCustomerId || undefined,
        linkedCust?.name,
        finalNote || undefined,
        effectiveGoalType === 'deposit' ? principalVal : undefined,
        effectiveGoalType === 'deposit' && hasInterest ? parseFloat(interestRate) : undefined,
        effectiveGoalType === 'deposit' && hasInterest ? interestAmt : 0,
        effectiveGoalType === 'deposit' && frequency !== 'flexible' ? tenureNum : undefined,
        effectiveIsOpenEnded
      );

      if (res) {
        setGoalTitle('');
        setTargetAmount('');
        setIsOpenEndedSavings(false);
        setGoalType('deposit');
        setFrequency('monthly');
        setInstallmentAmount('');
        setTenure('6');
        setHasInterest(false);
        setInterestRate('10');
        setSelectedCustomerId('');
        setNotes('');
        closeCreateGoalModal();
        toast.success(
          isPiggyBank 
            ? (lang === 'bn' ? 'উন্মুক্ত সঞ্চয় সফলভাবে তৈরি হয়েছে' : 'Flexible Savings created successfully')
            : (lang === 'bn' ? 'নতুন লক্ষ্য সফলভাবে তৈরি হয়েছে' : 'Goal created successfully')
        );
      }
    } catch (err) {
      setFormError(lang === 'bn' ? 'লক্ষ্য তৈরি করা যায়নি' : 'Failed to create goal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal) return;
    triggerHaptic('double');

    const amt = parseAmount(installmentInput);
    if (!amt || amt <= 0) return;

    if (contributionActionType === 'withdrawal') {
      const curBalance = Number(selectedGoal.savedAmount) || 0;
      if (amt > curBalance) {
        toast.error(
          lang === 'bn' 
            ? `উত্তোলনের পরিমাণ বর্তমান জমার (৳${formatNumber(curBalance, 'bn')}) চেয়ে বেশি হতে পারে না` 
            : `Withdrawal amount cannot exceed current balance (৳${formatNumber(curBalance, 'en')})`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const updated = await addGoalContribution(
        selectedGoal.id,
        amt,
        installmentNote,
        syncToLedger,
        contributionActionType
      );
      
      let newSavedAmount = Number(selectedGoal.savedAmount) || 0;
      if (contributionActionType === 'withdrawal') {
        newSavedAmount = Math.max(0, newSavedAmount - amt);
      } else {
        newSavedAmount = newSavedAmount + amt;
      }

      const isCompleted = (!selectedGoal.isOpenEnded && (Number(selectedGoal.targetAmount) || 0) > 0)
        ? newSavedAmount >= (Number(selectedGoal.targetAmount) || 0)
        : false;
      const newStatus = isCompleted ? 'completed' : selectedGoal.status;

      const fallbackUpdated: SavingGoal = (updated as SavingGoal) || {
        ...selectedGoal,
        savedAmount: newSavedAmount,
        status: newStatus,
        contributions: [
          ...(selectedGoal.contributions || []),
          {
            id: 'temp-' + Date.now(),
            amount: amt,
            date: new Date().toISOString(),
            note: installmentNote.trim(),
            type: contributionActionType
          }
        ]
      };

      setSelectedGoal(fallbackUpdated);
      setInstallmentInput('');
      setInstallmentNote('');
      setShowInstallmentForm(false);
      
      if (contributionActionType === 'withdrawal') {
        toast.success(lang === 'bn' ? 'টাকা সফলভাবে উত্তোলন করা হয়েছে' : 'Withdrawal recorded successfully');
      } else if (isCompleted) {
        toast.success(lang === 'bn' ? 'অভিনন্দন! লক্ষ্য সম্পূর্ণ অর্জিত হয়েছে' : 'Congratulations! Goal fully achieved');
      } else {
        toast.success(lang === 'bn' ? 'টাকা সফলভাবে জমা হয়েছে' : 'Contribution recorded successfully');
      }
    } catch (err) {
      console.warn("Failed to record contribution", err);
      toast.error(lang === 'bn' ? 'লেনদেন সম্পন্ন করা সম্ভব হয়নি' : 'Failed to record transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteConfirmModal = () => {
    openDeleteGoalConfirm();
  };

  const glassLabelCls = lang === 'bn'
    ? 'text-[11px] font-bold tracking-normal text-slate-500 dark:text-slate-400'
    : 'micro-mono-label font-semibold';

  const glassFieldCls =
    'w-full px-3.5 py-2.5 rounded-2xl border border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-950 dark:text-white outline-none transition-colors';

  return (
    <div className="space-y-6 no-select">
      {/* Open Editorial Header */}
      <section className="pt-1 flex items-end justify-between gap-3">
        <div>
          <span className={glassLabelCls}>
            {lang === 'bn' ? 'সঞ্চয় ও কিস্তি পরিকল্পনা' : 'Savings & Installments'}
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white tracking-tight mt-0.5 flex items-baseline gap-2.5">
            <span>{t.goalsHeaderTitle}</span>
            <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
              {formatNumber(goals.length, lang)}
            </span>
          </h2>
        </div>

        <button
          onClick={openCreateGoalModal}
          className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold rounded-full flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-xs shrink-0 touch-press shadow-sm"
          id="create_goal_btn"
        >
          <Plus className="w-3.5 h-3.5 stroke-[1.5]" />
          <span>{t.createGoal}</span>
        </button>
      </section>

      {/* Sliding Segmented Pill Tabs (Pure GPU translate3d — zero layout projection overhead) */}
      <div className="surface-subcard relative grid grid-cols-2 p-1 rounded-full border border-slate-900/[0.06] dark:border-white/[0.08]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-full bg-slate-950 dark:bg-white border-2 border-slate-950 dark:border-white shadow-xs will-change-transform"
          style={{
            width: 'calc((100% - 8px) / 2)',
            transform: filterTab === 'active' ? 'translate3d(0%, 0, 0)' : 'translate3d(100%, 0, 0)',
            transition: 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
        <button
          onClick={() => { triggerHaptic('single'); setFilterTab('active'); }}
          className={`relative z-10 py-2 text-center text-xs font-bold rounded-full transition-colors cursor-pointer ${
            filterTab === 'active'
              ? 'text-white dark:text-slate-950'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
          }`}
        >
          <span>
            {lang === 'bn' ? 'চলমান লক্ষ্যসমূহ' : 'Active'} ({formatNumber(activeGoals.length, lang)})
          </span>
        </button>
        <button
          onClick={() => { triggerHaptic('single'); setFilterTab('history'); }}
          className={`relative z-10 py-2 text-center text-xs font-bold rounded-full transition-colors cursor-pointer ${
            filterTab === 'history'
              ? 'text-white dark:text-slate-950'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
          }`}
        >
          <span>
            {lang === 'bn' ? 'আর্কাইভ খতিয়ান' : 'History'} ({formatNumber(historyGoals.length, lang)})
          </span>
        </button>
      </div>

      {/* Goals Bento Grid */}
      {visibleGoals.length === 0 ? (
        <div
          key={`goals-empty-${filterTab}`}
          className="surface-glass border rounded-[28px] p-10 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-2.5"
        >
          <div className="w-12 h-12 rounded-full bg-slate-900/[0.04] dark:bg-white/[0.06] flex items-center justify-center">
            <Target className="w-5 h-5 stroke-[1.25]" />
          </div>
          <p className="font-bold text-sm text-slate-950 dark:text-white">{t.noGoals}</p>
          <p className="text-xs max-w-xs">{lang === 'bn' ? 'ইএমআই বা সঞ্চয় লক্ষ্য তৈরি করতে উপরের বাটনে চাপ দিন।' : 'Create EMI installment plans or savings targets using the button above.'}</p>
        </div>
      ) : (
        <div
          key={`goals-grid-${filterTab}`}
          className="grid grid-cols-1 md:grid-cols-2 gap-3.5"
        >
          {visibleGoals.map((goal, idx) => {
            const percent = Math.min(100, Math.round(((goal.savedAmount || 0) / (goal.targetAmount || 1)) * 100));
            const isSavings = goal.type === 'savings';
            const isFlexible = goal.isOpenEnded && (!goal.targetAmount || goal.targetAmount === 0);
            const ringColor = goal.status === 'completed'
              ? '#059669'
              : isSavings
                ? 'var(--accent-color)'
                : '#E11D48';

            const cardNode = (
                <SpotlightCard
                  role="button"
                  tabIndex={0}
                  onClick={() => openGoalDetail(goal)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openGoalDetail(goal);
                    }
                  }}
                  className="surface-glass-interactive border p-5 rounded-[26px] overflow-hidden cursor-pointer relative group flex flex-col justify-between min-h-[156px] touch-press select-none focus:outline-none h-full"
                >
                  <div className="flex items-start justify-between gap-3.5">
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      {/* Circular Progress Ring */}
                      <div className="relative shrink-0 flex items-center justify-center">
                        <CircularGauge
                          percent={isFlexible ? 100 : percent}
                          size={52}
                          strokeWidth={4.5}
                          strokeColor={ringColor}
                        />
                        <span className="absolute text-[10px] font-mono font-bold text-slate-950 dark:text-white tabular-nums">
                          {isFlexible ? (
                            <Sprout className="w-4 h-4 stroke-[1.25] text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            `${percent}%`
                          )}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-display text-base font-bold text-slate-950 dark:text-white truncate">
                            {goal.title}
                          </h3>
                        </div>

                        <p className={`text-[11px] font-medium mt-0.5 truncate ${
                          goal.isOpenEnded
                            ? 'text-teal-600 dark:text-teal-400'
                            : isSavings
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {goal.isOpenEnded
                            ? (lang === 'bn' ? 'উন্মুক্ত সঞ্চয়' : 'Flexible Savings')
                            : (isSavings ? t.savings : t.deposit)}
                          {' · '}
                          <span className="text-slate-500 dark:text-slate-400">
                            {goal.installmentAmount ? `৳${formatNumber(goal.installmentAmount, lang)} ` : ''}
                            {goal.frequency === 'daily' && t.daily}
                            {goal.frequency === 'weekly' && t.weekly}
                            {goal.frequency === 'monthly' && t.monthly}
                            {goal.frequency === 'flexible' && t.flexible}
                          </span>
                        </p>

                        {goal.customerName && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 mt-1 truncate">
                            <User className="w-3 h-3 stroke-[1.25] shrink-0" />
                            <span className="truncate">{goal.customerName}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {goal.status === 'active' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEmiReminderModal(goal);
                        }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                          reminders.some(r => r.goalId === goal.id && r.active)
                            ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                            : 'bg-slate-900/[0.04] dark:bg-white/[0.06] text-slate-500 hover:text-slate-950 dark:hover:text-white'
                        }`}
                        title={
                          reminders.some(r => r.goalId === goal.id && r.active)
                            ? (lang === 'bn' ? 'কিস্তির অ্যালার্ট সক্রিয় (৭ দিন আগে তাগাদা)' : 'EMI Alert Active (7-day advance reminder)')
                            : (lang === 'bn' ? 'কিস্তির অ্যালার্ট সেট করুন' : 'Set EMI Reminder')
                        }
                      >
                        {reminders.some(r => r.goalId === goal.id && r.active) ? (
                          <BellRing className="w-3.5 h-3.5 stroke-[1.25]" />
                        ) : (
                          <Bell className="w-3.5 h-3.5 stroke-[1.25]" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Bottom Monetary Ratio */}
                  <div className="mt-4 pt-3 border-t border-slate-900/[0.06] dark:border-white/[0.06] flex items-baseline justify-between gap-2">
                    {isFlexible ? (
                      <>
                        <span className="font-display text-xl font-bold text-slate-950 dark:text-white tabular-nums tracking-tight">
                          ৳{formatNumber(goal.savedAmount || 0, lang)}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {formatNumber(goal.contributions?.length || 0, lang)} {lang === 'bn' ? 'টি লেনদেন' : 'entries'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-display text-xl font-bold text-slate-950 dark:text-white tabular-nums tracking-tight">
                          ৳{formatNumber(goal.savedAmount || 0, lang)}
                        </span>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                          / ৳{formatNumber(goal.targetAmount, lang)}
                        </span>
                      </>
                    )}
                  </div>

                  {goal.status !== 'active' && (
                    <div className="absolute inset-0 bg-white/70 dark:bg-black/65 backdrop-blur-[2px] rounded-[26px] flex items-center justify-center pointer-events-none">
                      <span className="px-4 py-1.5 rounded-full font-bold text-xs flex items-center gap-1.5 glass-modal border text-slate-950 dark:text-white shadow-sm">
                        {goal.status === 'completed' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[1.5]" />
                            <span>{lang === 'bn' ? 'সম্পন্ন' : 'Completed'}</span>
                          </>
                        ) : (
                          <span>{lang === 'bn' ? 'বাতিল' : 'Cancelled'}</span>
                        )}
                      </span>
                    </div>
                  )}
                </SpotlightCard>
            );

            return idx < 6 ? (
              <StaggerReveal key={goal.id} index={idx} staggerMs={20}>
                {cardNode}
              </StaggerReveal>
            ) : (
              <div key={goal.id} className="customer-card-cv">
                {cardNode}
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE GOAL MODAL ── */}
      {showCreateModal && (
        <ModalPortal lockScroll={false}>
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
            <div className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur" onClick={closeCreateGoalModal} />

            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-slide-up glass-modal w-full sm:max-w-xl rounded-t-[2rem] sm:rounded-3xl border shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col relative z-10"
            >
              <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-900/15 dark:bg-white/20 mx-auto" />
              </div>

              <div className="px-5 py-3.5 sm:py-4 border-b border-slate-900/[0.06] dark:border-white/[0.06] flex items-center justify-between shrink-0">
                <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white tracking-tight">
                  {t.createGoal}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('medium');
                    closeCreateGoalModal();
                  }}
                  className="w-8 h-8 rounded-full bg-slate-900/[0.05] hover:bg-slate-900/[0.1] dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close"
                  id="close_goal_modal_btn"
                >
                  <X className="w-4 h-4 stroke-[1.25]" />
                </button>
              </div>

              <form onSubmit={handleCreateGoal} className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div ref={createGoalScrollRef} className="flex-1 min-h-0 overflow-y-auto hide-scrollbar p-5 space-y-5">
                {/* 1. Goal Type Selection */}
                <div className="space-y-2.5">
                  <span className={`${glassLabelCls} block`}>
                    {t.goalType}
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('single');
                        setGoalType('deposit');
                        setFrequency('monthly');
                      }}
                      className={`py-3.5 px-3.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer touch-press text-center ${
                        goalType === 'deposit'
                          ? 'bg-rose-600 border-2 border-rose-500 text-white shadow-lg shadow-rose-600/20'
                          : 'border bg-slate-900/[0.03] hover:bg-slate-900/[0.06] border-slate-900/[0.08] text-slate-700 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:border-white/[0.08] dark:text-slate-200'
                      }`}
                    >
                      <CalendarClock className="w-4 h-4 stroke-[1.25]" />
                      <span className="text-sm font-bold">{t.deposit}</span>
                      <span className={`text-[11px] leading-tight ${
                        goalType === 'deposit' ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {lang === 'bn' ? 'লোন বা পণ্যের কিস্তি পরিশোধ' : 'Loan or item installments'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('single');
                        setGoalType('savings');
                        setFrequency(isOpenEndedSavings ? 'flexible' : 'monthly');
                      }}
                      className={`py-3.5 px-3.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer touch-press text-center ${
                        goalType === 'savings'
                          ? 'bg-emerald-600 border-2 border-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                          : 'border bg-slate-900/[0.03] hover:bg-slate-900/[0.06] border-slate-900/[0.08] text-slate-700 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:border-white/[0.08] dark:text-slate-200'
                      }`}
                    >
                      <Target className="w-4 h-4 stroke-[1.25]" />
                      <span className="text-sm font-bold">{t.savings}</span>
                      <span className={`text-[11px] leading-tight ${
                        goalType === 'savings' ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {lang === 'bn' ? 'ভবিষ্যতের জন্য টাকা জমান' : 'Save money for the future'}
                      </span>
                    </button>
                  </div>

                  {goalType === 'savings' && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('single');
                        setIsOpenEndedSavings(prev => {
                          const next = !prev;
                          if (next) {
                            setTargetAmount('');
                            setInstallmentAmount('');
                            setFrequency('flexible');
                            if (document.activeElement instanceof HTMLElement && document.activeElement.getAttribute('data-numpad') === 'true') {
                              document.activeElement.blur();
                            }
                          } else {
                            setFrequency('monthly');
                          }
                          return next;
                        });
                      }}
                      className={`w-full p-3.5 rounded-2xl flex items-center justify-between gap-3 text-left transition-all cursor-pointer select-none ${
                        isOpenEndedSavings
                          ? 'bg-emerald-500/10 border-2 border-emerald-500/60'
                          : 'border bg-slate-900/[0.03] dark:bg-white/[0.04] border-slate-900/[0.07] dark:border-white/[0.08]'
                      }`}
                    >
                      <span className="text-xs sm:text-sm font-bold text-slate-950 dark:text-white truncate">
                        {lang === 'bn' ? 'উন্মুক্ত সঞ্চয়' : 'Flexible Savings'}
                      </span>

                      <div
                        className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${
                          isOpenEndedSavings
                            ? 'bg-emerald-600 justify-end'
                            : 'bg-slate-300 dark:bg-slate-700 justify-start'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-white shadow-xs transition-transform" />
                      </div>
                    </button>
                  )}
                </div>

                {/* 2. Title Input */}
                <div className="space-y-1.5">
                  <span className={`${glassLabelCls} block`}>
                    {t.goalTitle} *
                  </span>
                  <input
                    type="text"
                    required
                    placeholder={
                      goalType === 'savings' && isOpenEndedSavings
                        ? (lang === 'bn' ? 'সঞ্চয়ের নাম লিখুন (যেমন: উন্মুক্ত সঞ্চয়, জরুরি ফান্ড)' : 'Enter goal title (e.g. Flexible Savings, Emergency Fund)')
                        : goalType === 'deposit'
                        ? (lang === 'bn' ? 'লক্ষ্যের শিরোনাম লিখুন (যেমন: টিভি কিস্তি, বাইক লোন)' : 'Enter goal title (e.g. TV Installment, Bike Loan)')
                        : (lang === 'bn' ? 'লক্ষ্যের শিরোনাম লিখুন (যেমন: বাড়ি নির্মাণ, সঞ্চয় স্কিম)' : 'Enter goal title (e.g. House Construction, Savings Scheme)')
                    }
                    value={goalTitle}
                    onChange={(e) => setGoalTitle(e.target.value)}
                    onFocus={centerNativeInput}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!(goalType === 'savings' && isOpenEndedSavings)) {
                          const targetInput = e.currentTarget.form?.querySelector('input[data-numpad="true"]:not(:disabled)') as HTMLInputElement | null;
                          if (targetInput) targetInput.focus();
                        }
                      }
                    }}
                    className={`${glassFieldCls} font-semibold text-sm`}
                  />
                </div>

                {/* 3. Target Amount */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`${lang === 'bn' ? 'text-[11px] font-bold tracking-normal' : 'micro-mono-label font-semibold'} block ${
                      goalType === 'savings' && isOpenEndedSavings
                        ? 'text-slate-400 dark:text-slate-500'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {goalType === 'deposit'
                        ? (lang === 'bn' ? 'মোট ঋণের পরিমাণ / আসল টাকা *' : 'Total Principal / Loan Amount *')
                        : goalType === 'savings' && isOpenEndedSavings
                        ? t.targetAmount
                        : `${t.targetAmount} *`
                      }
                    </span>
                    {goalType === 'savings' && isOpenEndedSavings && (
                      <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                        {lang === 'bn' ? 'নিষ্ক্রিয় (উন্মুক্ত সঞ্চয়)' : 'Disabled (Open-Ended)'}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] sm:text-[22px] font-display font-medium select-none pointer-events-none ${
                      goalType === 'savings' && isOpenEndedSavings
                        ? 'text-slate-300 dark:text-slate-700'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      ৳
                    </span>
                    <input
                      type="text"
                      disabled={goalType === 'savings' && isOpenEndedSavings}
                      required={!(goalType === 'savings' && isOpenEndedSavings)}
                      inputMode="decimal"
                      data-numpad={goalType === 'savings' && isOpenEndedSavings ? 'false' : 'true'}
                      placeholder={goalType === 'savings' && isOpenEndedSavings ? (lang === 'bn' ? 'প্রযোজ্য নয়' : 'No limit') : '0'}
                      value={goalType === 'savings' && isOpenEndedSavings ? '' : targetAmount}
                      onChange={(e) => handleAmountChange(e.target.value, setTargetAmount)}
                      className={`w-full pl-9 pr-4 py-2.5 sm:py-3 rounded-2xl border font-display font-bold text-[22px] sm:text-[26px] tracking-tight tabular-nums outline-none transition-colors ${
                        goalType === 'savings' && isOpenEndedSavings
                          ? 'border-slate-900/[0.05] dark:border-white/[0.05] bg-slate-900/[0.02] dark:bg-white/[0.02] text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60'
                          : 'border-slate-900/[0.09] dark:border-white/[0.1] bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-950 dark:text-white'
                      }`}
                    />
                  </div>

                  {/* Speedy Pad Pills */}
                  <div className={`flex flex-wrap gap-1.5 pt-1 ${
                    goalType === 'savings' && isOpenEndedSavings ? 'opacity-40 pointer-events-none select-none' : ''
                  }`}>
                    {[5000, 10000, 25000, 50000, 100000].map(val => (
                      <button
                        key={val}
                        type="button"
                        disabled={goalType === 'savings' && isOpenEndedSavings}
                        onClick={() => {
                          triggerHaptic('single');
                          const cur = parseAmount(targetAmount);
                          setTargetAmount(formatIndianNumberString(String(cur + val)));
                        }}
                        className="px-3 py-1.5 bg-slate-900/[0.04] hover:bg-slate-900/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.11] text-slate-900 dark:text-white font-semibold rounded-full transition-colors text-xs cursor-pointer tabular-nums font-mono disabled:cursor-not-allowed touch-press"
                      >
                        +{formatNumber(val, lang)}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={goalType === 'savings' && isOpenEndedSavings}
                      onClick={() => {
                        triggerHaptic('tick');
                        setTargetAmount('');
                      }}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold rounded-full transition-colors text-xs cursor-pointer disabled:cursor-not-allowed touch-press"
                    >
                      {lang === 'bn' ? 'মুছুন' : 'Clear'}
                    </button>
                  </div>
                </div>

                {goalType === 'savings' && isOpenEndedSavings && (
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                    <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 stroke-[1.25]" />
                    <span>
                      {lang === 'bn'
                        ? 'উন্মুক্ত সঞ্চয়ে কোনো নির্দিষ্ট কিস্তি বা মেয়াদের বাধ্যবাধকতা নেই। আপনি যেকোনো সময় যেকোনো পরিমাণ টাকা জমা করতে ও প্রয়োজনে উত্তোলন করতে পারবেন।'
                        : 'Flexible Savings has no rigid installments or deadlines. You can deposit and withdraw arbitrary amounts anytime you like.'}
                    </span>
                  </div>
                )}

                {/* 4. EMI Custom Setup */}
                {goalType === 'deposit' && (
                  <div className="p-4 bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.07] dark:border-white/[0.08] rounded-2xl space-y-3.5">
                    <div className="flex items-center gap-2 border-b border-slate-900/[0.06] dark:border-white/[0.06] pb-2">
                      <Calculator className="w-4 h-4 text-slate-900 dark:text-white stroke-[1.25]" />
                      <span className={`${lang === 'bn' ? 'text-xs font-bold tracking-normal' : 'micro-mono-label font-semibold'} text-slate-900 dark:text-white`}>
                        {lang === 'bn' ? 'ইএমআই ক্যালকুলেটর ও কিস্তির হিসাব' : 'EMI & Tenure Auto-Calculator'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <span className={`${glassLabelCls} block`}>{t.frequency}</span>
                        <NativeOptionPicker
                          value={frequency}
                          onChange={(val) => setFrequency(val as any)}
                          lang={lang}
                          title={t.frequency}
                          options={[
                            { value: 'monthly', label: t.monthly },
                            { value: 'weekly', label: t.weekly },
                            { value: 'daily', label: t.daily },
                            { value: 'flexible', label: t.flexible }
                          ]}
                          triggerClassName={`${glassFieldCls} font-bold text-xs cursor-pointer flex items-center justify-between gap-2 text-left touch-press`}
                        />
                      </div>

                      {frequency !== 'flexible' && (
                        <div className="space-y-1">
                          <span className={`${glassLabelCls} block`}>
                            {frequency === 'monthly' && (lang === 'bn' ? 'মেয়াদ (মাস)' : 'Tenure (Months)')}
                            {frequency === 'weekly' && (lang === 'bn' ? 'মেয়াদ (সপ্তাহ)' : 'Tenure (Weeks)')}
                            {frequency === 'daily' && (lang === 'bn' ? 'মেয়াদ (দিন)' : 'Tenure (Days)')}
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            data-numpad="true"
                            data-integer-only="true"
                            value={tenure}
                            onChange={(e) => setTenure(e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder="6"
                            className={`${glassFieldCls} font-mono font-bold text-xs`}
                          />
                        </div>
                      )}
                    </div>

                    {frequency !== 'flexible' && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {frequency === 'monthly' && [3, 6, 12, 18, 24].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => { triggerHaptic('single'); setTenure(String(n)); }}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer font-mono ${
                              tenure === String(n)
                                ? 'bg-slate-950 text-white border-2 border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white'
                                : 'border bg-transparent border-slate-900/[0.08] dark:border-white/[0.1] text-slate-900 dark:text-white'
                            }`}
                          >
                            {formatNumber(n, lang)} {lang === 'bn' ? 'মাস' : 'Mo'}
                          </button>
                        ))}
                        {frequency === 'weekly' && [4, 8, 12, 24, 52].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => { triggerHaptic('single'); setTenure(String(n)); }}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer font-mono ${
                              tenure === String(n)
                                ? 'bg-slate-950 text-white border-2 border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white'
                                : 'border bg-transparent border-slate-900/[0.08] dark:border-white/[0.1] text-slate-900 dark:text-white'
                            }`}
                          >
                            {formatNumber(n, lang)} {lang === 'bn' ? 'সপ্তাহ' : 'Wk'}
                          </button>
                        ))}
                        {frequency === 'daily' && [30, 60, 90, 180, 360].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => { triggerHaptic('single'); setTenure(String(n)); }}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer font-mono ${
                              tenure === String(n)
                                ? 'bg-slate-950 text-white border-2 border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white'
                                : 'border bg-transparent border-slate-900/[0.08] dark:border-white/[0.1] text-slate-900 dark:text-white'
                            }`}
                          >
                            {formatNumber(n, lang)} {lang === 'bn' ? 'দিন' : 'Days'}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-900/[0.06] dark:border-white/[0.06] space-y-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="interest_checkbox"
                          checked={hasInterest}
                          onChange={(e) => setHasInterest(e.target.checked)}
                          className="w-4 h-4 accent-slate-950 dark:accent-white rounded cursor-pointer"
                        />
                        <label htmlFor="interest_checkbox" className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer select-none">
                          {lang === 'bn' ? 'সুদ বা অতিরিক্ত ফি / চার্জ যুক্ত করুন' : 'Add Interest / Additional Fee Rate'}
                        </label>
                      </div>

                      {hasInterest && (
                        <div className="space-y-2 p-3 bg-slate-900/[0.02] dark:bg-white/[0.03] border border-slate-900/[0.06] dark:border-white/[0.06] rounded-2xl animate-reveal">
                          <div className="flex items-center justify-between">
                            <span className={glassLabelCls}>
                              {lang === 'bn' ? 'বার্ষিক সুদের হার / কাস্টম ফি (%)' : 'Custom Interest / Fee Rate (% p.a.)'}
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">{interestRate || '0'}%</span>
                          </div>
                          <div className="relative">
                            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 stroke-[1.25]" />
                            <input
                              type="text"
                              inputMode="decimal"
                              data-numpad="true"
                              value={interestRate}
                              onChange={(e) => {
                                const ascii = e.target.value.replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
                                const clean = ascii.replace(/[^0-9.]/g, '');
                                const parts = clean.split('.');
                                const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : clean;
                                setInterestRate(sanitized);
                              }}
                              placeholder={lang === 'bn' ? 'যেমন: ১১.৫৯' : 'e.g. 11.59'}
                              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-950 dark:text-white font-mono font-bold text-xs outline-none"
                            />
                          </div>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {[5, 10, 11.5, 12, 15, 20].map(r => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => { triggerHaptic('single'); setInterestRate(String(r)); }}
                                className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold transition-all cursor-pointer ${
                                  interestRate === String(r)
                                    ? 'bg-slate-950 text-white border-2 border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white'
                                    : 'border bg-transparent border-slate-900/[0.08] dark:border-white/[0.1] text-slate-900 dark:text-white'
                                }`}
                              >
                                {r}%
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {emiPreview && (
                      <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-1.5 font-mono">
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-900 dark:text-white">
                          <span>{lang === 'bn' ? 'মূল আসল' : 'Principal'}: ৳{formatNumber(emiPreview.principal, lang)}</span>
                          {emiPreview.interest > 0 && (
                            <span className="text-rose-600 dark:text-rose-400">
                              +{lang === 'bn' ? 'সুদ' : 'Fee'}: ৳{formatNumber(emiPreview.interest, lang)}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-baseline border-t border-rose-500/15 pt-1.5">
                          <span className={`text-xs font-bold text-slate-900 dark:text-white ${lang === 'bn' ? 'tracking-normal' : 'uppercase'}`}>
                            {lang === 'bn' ? 'স্বয়ংক্রিয় কিস্তি' : 'Auto Installment'}:
                          </span>
                          <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                            ৳{formatNumber(emiPreview.emi, lang)} / {frequency === 'monthly' ? t.monthly : frequency === 'weekly' ? t.weekly : t.daily}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {goalType === 'savings' && !isOpenEndedSavings && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <span className={`${glassLabelCls} block`}>{t.installmentAmount}</span>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 select-none pointer-events-none">
                          ৳
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          data-numpad="true"
                          placeholder="0"
                          value={installmentAmount}
                          onChange={(e) => handleAmountChange(e.target.value, setInstallmentAmount)}
                          className="w-full pl-8 pr-3 py-2.5 rounded-2xl border border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-950 dark:text-white font-mono font-bold text-sm outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className={`${glassLabelCls} block`}>{t.frequency}</span>
                      <NativeOptionPicker
                        value={frequency}
                        onChange={(val) => setFrequency(val as any)}
                        lang={lang}
                        title={t.frequency}
                        options={[
                          { value: 'monthly', label: t.monthly },
                          { value: 'weekly', label: t.weekly },
                          { value: 'daily', label: t.daily },
                          { value: 'flexible', label: t.flexible }
                        ]}
                        triggerClassName={`${glassFieldCls} font-bold text-xs cursor-pointer flex items-center justify-between gap-2 text-left touch-press`}
                      />
                    </div>
                  </div>
                )}

                {/* 5. Link Customer */}
                <div className="space-y-1">
                  <span className={`${glassLabelCls} block`}>{t.linkCustomer}</span>
                  <NativeCustomerPicker
                    customers={customers}
                    value={selectedCustomerId}
                    onChange={setSelectedCustomerId}
                    lang={lang}
                    title={t.linkCustomer}
                    placeholder={lang === 'bn' ? 'কোনো নির্দিষ্ট গ্রাহক নয় (ব্যক্তিগত লক্ষ্য)' : 'None (Personal Goal)'}
                    allowNone
                    noneLabel={lang === 'bn' ? 'কোনো নির্দিষ্ট গ্রাহক নয় (ব্যক্তিগত লক্ষ্য)' : 'None (Personal Goal)'}
                    triggerClassName={`${glassFieldCls} font-medium text-xs cursor-pointer flex items-center justify-between gap-2 text-left touch-press`}
                  />
                </div>

                {/* 6. Notes */}
                <div className="space-y-1">
                  <span className={`${glassLabelCls} block`}>{t.notes}</span>
                  <textarea
                    rows={1}
                    placeholder={lang === 'bn' ? 'অতিরিক্ত কোনো মন্তব্য বা শর্ত (ঐচ্ছিক)' : 'Additional notes or remarks (Optional)'}
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.max(42, e.target.scrollHeight)}px`;
                    }}
                    className={`${glassFieldCls} min-h-[42px] text-xs resize-none overflow-hidden leading-relaxed`}
                  />
                </div>
              </div>

              <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5 border-t border-slate-900/[0.06] dark:border-white/[0.06] bg-white/60 dark:bg-black/30 backdrop-blur-xl shrink-0">
                {formError && (
                  <div className="p-3 mb-3 bg-rose-500/10 rounded-2xl text-rose-600 dark:text-rose-400 font-semibold text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 stroke-[1.25]" />
                    <span>{formError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-3.5 rounded-full font-bold text-sm flex items-center justify-center transition-all cursor-pointer select-none touch-press shadow-lg ${
                    goalType === 'deposit'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  } ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t.saving}
                    </span>
                  ) : (
                    goalType === 'savings' && isOpenEndedSavings
                      ? (lang === 'bn' ? 'উন্মুক্ত সঞ্চয় তৈরি করুন' : 'Create Flexible Savings')
                      : (lang === 'bn' ? 'লক্ষ্য সংরক্ষণ করুন' : 'Confirm & Save Goal')
                  )}
                </button>
              </div>
            </form>
          </div>
          </div>
        </ModalPortal>
      )}

      {/* ── GOAL DETAIL VIEW MODAL ── */}
      {selectedGoal && (
        <ModalPortal lockScroll={false}>
          <div
            key={selectedGoal.id}
            className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden"
          >
            <div className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur" onClick={closeGoalDetail} />

            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-slide-up glass-modal w-full sm:max-w-xl rounded-t-[2rem] sm:rounded-3xl border shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col relative z-10"
            >
              <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-900/15 dark:bg-white/20 mx-auto" />
              </div>

            {/* Header */}
            <div className="px-5 py-3.5 sm:px-6 border-b border-slate-900/[0.06] dark:border-white/[0.06] shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1 flex items-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      openRenameGoal();
                    }}
                    className="text-left min-w-0 flex-1 group cursor-pointer focus:outline-none"
                    title={lang === 'bn' ? 'শিরোনাম পরিবর্তন করতে ট্যাপ করুন' : 'Tap to rename goal'}
                  >
                    <h3 className="font-display text-xl font-bold text-slate-950 dark:text-white group-hover:opacity-75 transition-opacity truncate">
                      {selectedGoal.title}
                    </h3>
                  </button>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {selectedGoal.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => openEmiReminderModal(selectedGoal)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                        reminders.some(r => r.goalId === selectedGoal.id && r.active)
                          ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                          : 'bg-slate-900/[0.05] hover:bg-slate-900/[0.1] dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-600 dark:text-slate-300'
                      }`}
                      title={lang === 'bn' ? 'কিস্তির নোটিফিকেশন রিমাইন্ডার' : 'EMI Notification Reminder'}
                    >
                      {reminders.some(r => r.goalId === selectedGoal.id && r.active) ? (
                        <BellRing className="w-4 h-4 stroke-[1.25]" />
                      ) : (
                        <Bell className="w-4 h-4 stroke-[1.25]" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={openDeleteGoalConfirm}
                    className="w-9 h-9 bg-slate-900/[0.05] hover:bg-rose-500/15 dark:bg-white/[0.08] dark:hover:bg-rose-500/20 rounded-full text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                    title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete Goal'}
                  >
                    <Trash2 className="w-4 h-4 stroke-[1.25]" />
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic('medium');
                      closeGoalDetail();
                    }}
                    className="w-9 h-9 bg-slate-900/[0.05] hover:bg-slate-900/[0.1] dark:bg-white/[0.08] dark:hover:bg-white/[0.14] rounded-full text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4 stroke-[1.25]" />
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable Modal Content */}
            <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar p-4 sm:p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 space-y-4">
              {/* Financial Progress & Overview */}
              <div className="surface-subcard border rounded-2xl p-4 space-y-3.5">
                {selectedGoal.isOpenEnded && (!selectedGoal.targetAmount || selectedGoal.targetAmount === 0) ? (
                  <>
                    <div className="grid grid-cols-3 divide-x divide-slate-900/[0.07] dark:divide-white/[0.07] text-center">
                      <div className="px-2">
                        <span className={lang === 'bn' ? 'text-[10px] font-bold tracking-normal text-slate-500 dark:text-slate-400 block' : 'micro-mono-label font-semibold block'}>
                          {lang === 'bn' ? 'ব্যালেন্স' : 'Balance'}
                        </span>
                        <span className="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block truncate">
                          ৳{formatNumber(selectedGoal.savedAmount || 0, lang)}
                        </span>
                      </div>
                      <div className="px-2">
                        <span className={lang === 'bn' ? 'text-[10px] font-bold tracking-normal text-slate-500 dark:text-slate-400 block' : 'micro-mono-label font-semibold block'}>
                          {lang === 'bn' ? 'মোট জমা' : 'Total In'}
                        </span>
                        <span className="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block truncate">
                          +৳{formatNumber((selectedGoal.contributions || []).filter(c => c.type !== 'withdrawal').reduce((sum, c) => sum + (c.amount || 0), 0), lang)}
                        </span>
                      </div>
                      <div className="px-2">
                        <span className={lang === 'bn' ? 'text-[10px] font-bold tracking-normal text-slate-500 dark:text-slate-400 block' : 'micro-mono-label font-semibold block'}>
                          {lang === 'bn' ? 'মোট উত্তোলন' : 'Total Out'}
                        </span>
                        <span className="text-sm sm:text-base font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5 block truncate">
                          -৳{formatNumber((selectedGoal.contributions || []).filter(c => c.type === 'withdrawal').reduce((sum, c) => sum + (c.amount || 0), 0), lang)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-semibold pt-2 border-t border-slate-900/[0.06] dark:border-white/[0.06]">
                      <span className="text-slate-600 dark:text-slate-300 text-[11px]">
                        {lang === 'bn' ? 'উন্মুক্ত সঞ্চয়' : 'Flexible savings'}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                        {formatNumber((selectedGoal.contributions || []).length, lang)} {lang === 'bn' ? 'টি লেনদেন' : 'entries'}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-3 divide-x divide-slate-900/[0.07] dark:divide-white/[0.07] text-center">
                      <div className="px-2">
                        <span className={lang === 'bn' ? 'text-[10px] font-bold tracking-normal text-slate-500 dark:text-slate-400 block' : 'micro-mono-label font-semibold block'}>
                          {lang === 'bn' ? 'টার্গেট' : 'Target'}
                        </span>
                        <span className="text-sm sm:text-base font-bold font-mono text-slate-950 dark:text-white mt-0.5 block truncate">৳{formatNumber(selectedGoal.targetAmount, lang)}</span>
                      </div>
                      <div className="px-2">
                        <span className={lang === 'bn' ? 'text-[10px] font-bold tracking-normal text-slate-500 dark:text-slate-400 block' : 'micro-mono-label font-semibold block'}>
                          {lang === 'bn' ? 'জমা' : 'Saved'}
                        </span>
                        <span className="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block truncate">৳{formatNumber(selectedGoal.savedAmount || 0, lang)}</span>
                      </div>
                      <div className="px-2">
                        <span className={lang === 'bn' ? 'text-[10px] font-bold tracking-normal text-slate-500 dark:text-slate-400 block' : 'micro-mono-label font-semibold block'}>{t.remaining}</span>
                        <span className="text-sm sm:text-base font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5 block truncate">৳{formatNumber(Math.max(0, selectedGoal.targetAmount - (selectedGoal.savedAmount || 0)), lang)}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-900/[0.06] dark:border-white/[0.06]">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-600 dark:text-slate-300 text-[11px] font-mono">
                          {Math.min(100, Math.round(((selectedGoal.savedAmount || 0) / (selectedGoal.targetAmount || 1)) * 100))}% {lang === 'bn' ? 'সম্পন্ন' : 'achieved'}
                          {selectedGoal.status !== 'active' && (
                            <span className="text-slate-400 ml-1.5">
                              · {selectedGoal.status === 'completed' ? (lang === 'bn' ? 'সম্পন্ন' : 'Completed') : (lang === 'bn' ? 'বাতিল' : 'Cancelled')}
                            </span>
                          )}
                        </span>
                        {selectedGoal.installmentAmount && selectedGoal.installmentAmount > 0 && (
                          <span className="text-slate-600 dark:text-slate-300 text-[11px] font-bold font-mono">
                            ৳{formatNumber(selectedGoal.installmentAmount, lang)} / {selectedGoal.frequency === 'daily' ? t.daily : selectedGoal.frequency === 'weekly' ? t.weekly : selectedGoal.frequency === 'monthly' ? t.monthly : t.flexible}
                          </span>
                        )}
                      </div>
                      <div className="w-full h-3.5 rounded-full bg-slate-900/[0.05] dark:bg-white/[0.055] border border-slate-900/[0.06] dark:border-white/[0.07] p-[1.5px] flex items-center overflow-hidden shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
                        {(() => {
                          const pctVal = Math.min(100, Math.round(((selectedGoal.savedAmount || 0) / (selectedGoal.targetAmount || 1)) * 100));
                          if (pctVal <= 0) return null;
                          const isCompleted = selectedGoal.status === 'completed';
                          const isSavings = selectedGoal.type === 'savings';
                          const barGradient = isCompleted
                            ? 'linear-gradient(90deg, rgba(110, 231, 183, 0.90) 0%, rgba(16, 185, 129, 0.84) 50%, rgba(13, 148, 136, 0.72) 100%)'
                            : isSavings
                              ? 'linear-gradient(90deg, color-mix(in srgb, var(--accent-color) 65%, white) 0%, var(--accent-color) 52%, color-mix(in srgb, var(--accent-color) 82%, black) 100%)'
                              : 'linear-gradient(90deg, rgba(253, 164, 175, 0.90) 0%, rgba(244, 63, 94, 0.84) 48%, rgba(190, 18, 60, 0.72) 100%)';
                          const barGlow = isCompleted
                            ? '0 0 12px rgba(16, 185, 129, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.65)'
                            : isSavings
                              ? '0 0 12px var(--accent-glow), inset 0 1px 0 rgba(255, 255, 255, 0.65)'
                              : '0 0 12px rgba(244, 63, 94, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.65)';
                          return (
                            <div
                              className="h-full rounded-full relative overflow-hidden dash-anim-bar-x transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                              style={{
                                width: `${pctVal}%`,
                                background: barGradient,
                                boxShadow: barGlow
                              }}
                            >
                              <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-75 glass-bar-etch" />
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </>
                )}

                {/* Customer & Editable Notes */}
                <div className="pt-2.5 border-t border-slate-900/[0.06] dark:border-white/[0.06] space-y-2">
                  {selectedGoal.customerName && (
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-bold flex items-center gap-1.5 text-xs">
                        <User className="w-3.5 h-3.5 text-slate-500 stroke-[1.25]" />
                        <span className="text-slate-900 dark:text-white">{selectedGoal.customerName}</span>
                      </span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={lang === 'bn' ? 'text-[10px] font-bold tracking-normal text-slate-500 dark:text-slate-400' : 'micro-mono-label font-semibold'}>
                        {t.notes}
                      </span>
                      {!isEditingGoalNotes && (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('single');
                            setEditedGoalNotes(cleanSelectedGoalNotes);
                            setIsEditingGoalNotes(true);
                          }}
                          className="px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white bg-slate-900/[0.04] dark:bg-white/[0.06] flex items-center gap-1 cursor-pointer transition-colors"
                          title={lang === 'bn' ? 'নোট সম্পাদনা করুন' : 'Edit Notes'}
                        >
                          <Pencil className="w-3 h-3 stroke-[1.25]" />
                          <span>{lang === 'bn' ? 'সম্পাদনা' : 'Edit'}</span>
                        </button>
                      )}
                    </div>

                    {isEditingGoalNotes ? (
                      <form onSubmit={handleSaveGoalNotes} className="space-y-2">
                        <textarea
                          rows={2}
                          value={editedGoalNotes}
                          ref={(el) => {
                            if (el) {
                              el.style.height = 'auto';
                              el.style.height = `${Math.max(54, el.scrollHeight)}px`;
                            }
                          }}
                          onChange={(e) => {
                            setEditedGoalNotes(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = `${Math.max(54, e.target.scrollHeight)}px`;
                          }}
                          placeholder=""
                          autoFocus
                          className={`${glassFieldCls} min-h-[54px] text-xs font-medium resize-none overflow-hidden leading-relaxed block`}
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingGoalNotes(false)}
                            className="px-3.5 py-1.5 bg-slate-900/[0.05] dark:bg-white/[0.07] text-slate-700 dark:text-slate-300 font-bold rounded-full text-xs cursor-pointer transition-colors"
                          >
                            {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                          </button>
                          <button
                            type="submit"
                            disabled={isSavingGoalNotes}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-full text-xs cursor-pointer transition-colors"
                          >
                            {lang === 'bn' ? 'সেভ' : 'Save'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div
                        onClick={() => {
                          triggerHaptic('single');
                          setEditedGoalNotes(cleanSelectedGoalNotes);
                          setIsEditingGoalNotes(true);
                        }}
                        className="w-full min-h-[36px] px-3 py-2 bg-slate-900/[0.02] dark:bg-white/[0.03] border border-slate-900/[0.06] dark:border-white/[0.06] rounded-xl text-xs text-slate-800 dark:text-slate-200 cursor-pointer transition-colors whitespace-pre-wrap break-words leading-relaxed"
                        title={lang === 'bn' ? 'নোট লিখতে বা পরিবর্তন করতে ট্যাপ করুন' : 'Tap to add or edit description/notes'}
                      >
                        {cleanSelectedGoalNotes || (lang === 'bn' ? 'নোট লিখতে ট্যাপ করুন...' : 'Tap to add note...')}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* EMI & Loan Details Collapsible */}
              {selectedGoalEmiDetails && (
                <div className="surface-subcard rounded-2xl border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('single');
                      setIsEmiBreakdownOpen(prev => !prev);
                    }}
                    className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CreditCard className="w-4 h-4 text-slate-900 dark:text-white shrink-0 stroke-[1.25]" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {lang === 'bn' ? 'ইএমআই ও ঋণ বিবরণী' : 'EMI & Loan Breakdown'}
                        {selectedGoalEmiDetails.tenure && (
                          <span className="font-normal text-slate-500 dark:text-slate-400 ml-1.5">
                            · {formatNumber(selectedGoalEmiDetails.tenure, lang)} {selectedGoalEmiDetails.tenureUnit}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs font-bold font-mono text-slate-600 dark:text-slate-300">
                        ৳{formatNumber(selectedGoalEmiDetails.principal, lang)}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-500 transition-transform duration-200 stroke-[1.25] ${
                          isEmiBreakdownOpen ? 'rotate-180 text-slate-900 dark:text-white' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {isEmiBreakdownOpen && (
                    <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-900/[0.06] dark:border-white/[0.06]">
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <span className={lang === 'bn' ? 'text-[10px] font-bold tracking-normal text-slate-500 dark:text-slate-400 block' : 'micro-mono-label font-semibold block'}>
                            {lang === 'bn' ? 'মূল পরিমাণ' : 'Principal Amount'}
                          </span>
                          <span className="text-xs font-bold font-mono text-slate-900 dark:text-white mt-0.5 block">
                            ৳{formatNumber(selectedGoalEmiDetails.principal, lang)}
                          </span>
                        </div>

                        <div>
                          <span className={lang === 'bn' ? 'text-[10px] font-bold tracking-normal text-slate-500 dark:text-slate-400 block' : 'micro-mono-label font-semibold block'}>
                            {lang === 'bn' ? 'মুনাফা / ফি' : 'Interest / Fee'}
                          </span>
                          <span className="text-xs font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5 block">
                            {selectedGoalEmiDetails.interestAmount > 0
                              ? `+৳${formatNumber(selectedGoalEmiDetails.interestAmount, lang)}${selectedGoalEmiDetails.interestRate ? ` (${selectedGoalEmiDetails.interestRate}%)` : ''}`
                              : (lang === 'bn' ? '০% (ফি প্রযোজ্য নয়)' : '0% (No Fee)')}
                          </span>
                        </div>

                        <div>
                          <span className={lang === 'bn' ? 'text-[10px] font-bold tracking-normal text-slate-500 dark:text-slate-400 block' : 'micro-mono-label font-semibold block'}>
                            {lang === 'bn' ? 'প্রতি কিস্তি' : 'Installment Rate'}
                          </span>
                          <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                            ৳{formatNumber(selectedGoal.installmentAmount || Math.ceil(selectedGoal.targetAmount / (selectedGoalEmiDetails.tenure || 1)), lang)}
                          </span>
                        </div>

                        <div>
                          <span className={lang === 'bn' ? 'text-[10px] font-bold tracking-normal text-slate-500 dark:text-slate-400 block' : 'micro-mono-label font-semibold block'}>
                            {lang === 'bn' ? 'মোট প্রদেয়' : 'Total Payable'}
                          </span>
                          <span className="text-xs font-bold font-mono text-slate-900 dark:text-white mt-0.5 block">
                            ৳{formatNumber(selectedGoal.targetAmount, lang)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Installment & Withdrawal Form Section */}
              {selectedGoal.status === 'active' && (
                <div className="pt-1">
                  {!showInstallmentForm ? (
                    selectedGoal.isOpenEnded ? (
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('single');
                            setContributionActionType('deposit');
                            setShowInstallmentForm(true);
                          }}
                          className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-full transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-xs sm:text-sm touch-press shadow-md shadow-emerald-600/20"
                        >
                          <Plus className="w-4 h-4 stroke-[1.5]" />
                          <span>{lang === 'bn' ? 'টাকা জমা' : 'Deposit'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('single');
                            setContributionActionType('withdrawal');
                            setShowInstallmentForm(true);
                          }}
                          className="py-3 px-4 bg-rose-500/10 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold rounded-full transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-xs sm:text-sm touch-press"
                        >
                          <Minus className="w-4 h-4 stroke-[1.5]" />
                          <span>{lang === 'bn' ? 'টাকা উত্তোলন' : 'Withdraw'}</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          triggerHaptic('single');
                          setContributionActionType('deposit');
                          setShowInstallmentForm(true);
                        }}
                        className="w-full py-3.5 px-4 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold rounded-full transition-colors flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm touch-press shadow-sm"
                      >
                        <Plus className="w-4 h-4 stroke-[1.5]" />
                        <span>{t.addInstallment}</span>
                      </button>
                    )
                  ) : (
                    <form onSubmit={handleAddContribution} className="space-y-4 bg-slate-900/[0.03] dark:bg-white/[0.04] p-4 rounded-2xl border border-slate-900/[0.07] dark:border-white/[0.08]">
                      <div className="flex items-center justify-between border-b border-slate-900/[0.06] dark:border-white/[0.06] pb-2.5">
                        <span className="font-bold text-sm text-slate-950 dark:text-white flex items-center gap-2">
                          {contributionActionType === 'withdrawal' ? (
                            <>
                              <ArrowUpRight className="w-4 h-4 text-rose-500 stroke-[1.25]" />
                              <span>{lang === 'bn' ? 'উন্মুক্ত সঞ্চয় থেকে টাকা উত্তোলন' : 'Withdraw from Flexible Savings'}</span>
                            </>
                          ) : (
                            <>
                              <ArrowDownLeft className="w-4 h-4 text-emerald-500 stroke-[1.25]" />
                              <span>{selectedGoal.isOpenEnded ? (lang === 'bn' ? 'উন্মুক্ত সঞ্চয়ে টাকা জমা' : 'Deposit into Flexible Savings') : t.addInstallment}</span>
                            </>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowInstallmentForm(false)}
                          className="w-7 h-7 rounded-full bg-slate-900/[0.05] dark:bg-white/[0.08] text-slate-500 hover:text-slate-950 dark:hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <X className="w-3.5 h-3.5 stroke-[1.25]" />
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <label className={`${glassLabelCls} block`}>
                          {contributionActionType === 'withdrawal'
                            ? (lang === 'bn' ? 'উত্তোলনের পরিমাণ *' : 'Withdrawal Amount *')
                            : `${t.amountPaid} *`}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-display font-light text-slate-400 select-none pointer-events-none">
                            ৳
                          </span>
                          <input
                            ref={installmentInputRef}
                            type="text"
                            required
                            autoFocus
                            inputMode="decimal"
                            data-numpad="true"
                            placeholder="0"
                            value={installmentInput}
                            onChange={(e) => handleAmountChange(e.target.value, setInstallmentInput)}
                            className="w-full pl-9 pr-4 py-3 bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.09] dark:border-white/[0.1] rounded-2xl font-display font-bold text-xl text-slate-950 dark:text-white focus:outline-none transition-colors"
                          />
                        </div>

                        {contributionActionType === 'withdrawal' ? (
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('single');
                              setInstallmentInput(formatIndianNumberString(String(selectedGoal.savedAmount || 0)));
                            }}
                            className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                          >
                            <span>
                              {lang === 'bn' ? 'সর্বোচ্চ ব্যালেন্স তুলুন' : 'Withdraw Full Balance'} (৳{formatNumber(selectedGoal.savedAmount || 0, lang)})
                            </span>
                          </button>
                        ) : selectedGoal.installmentAmount && selectedGoal.installmentAmount > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('single');
                              setInstallmentInput(formatIndianNumberString(String(selectedGoal.installmentAmount)));
                            }}
                            className="text-xs font-bold text-slate-900 dark:text-white hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                          >
                            <span>{lang === 'bn' ? 'নির্ধারিত কিস্তি বসান' : 'Fill regular installment'} (৳{formatNumber(selectedGoal.installmentAmount, lang)})</span>
                          </button>
                        ) : null}

                        <div className="flex flex-wrap gap-1.5 pt-1.5">
                          {[500, 1000, 2000, 5000].map(val => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => {
                                triggerHaptic('single');
                                const cur = parseAmount(installmentInput);
                                setInstallmentInput(formatIndianNumberString(String(cur + val)));
                              }}
                              className="px-3 py-1 bg-slate-900/[0.04] hover:bg-slate-900/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.11] text-slate-900 dark:text-white font-mono font-semibold rounded-full transition-colors text-xs cursor-pointer touch-press"
                            >
                              +{formatNumber(val, lang)}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('tick');
                              setInstallmentInput('');
                            }}
                            className="px-3 py-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold rounded-full transition-colors text-xs cursor-pointer touch-press"
                          >
                            {lang === 'bn' ? 'মুছুন' : 'Clear'}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className={`${glassLabelCls} block`}>
                          {lang === 'bn' ? 'নোট / বিবরণ (ঐচ্ছিক)' : 'Note / Description (Optional)'}
                        </label>
                        <input
                          type="text"
                          placeholder={
                            contributionActionType === 'withdrawal'
                              ? (lang === 'bn' ? 'যেমন: জরুরি খরচ, কেনাকাটা' : 'e.g. Shopping, emergency expense')
                              : (lang === 'bn' ? 'যেমন: অতিরিক্ত নগদ জমা, সঞ্চয়' : 'e.g. Cash deposit, monthly surplus')
                          }
                          value={installmentNote}
                          onChange={(e) => setInstallmentNote(e.target.value)}
                          className={`${glassFieldCls} font-medium text-sm`}
                        />
                      </div>

                      {selectedGoal.customerId && (
                        <div className="flex items-start gap-2.5 pt-1">
                          <input
                            type="checkbox"
                            id="ledger_sync_checkbox"
                            checked={syncToLedger}
                            onChange={(e) => setSyncToLedger(e.target.checked)}
                            className="w-4 h-4 accent-emerald-600 rounded cursor-pointer mt-0.5"
                          />
                          <label htmlFor="ledger_sync_checkbox" className="text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer select-none leading-normal">
                            {contributionActionType === 'withdrawal'
                              ? (lang === 'bn' ? 'গ্রাহকের খতিয়ানে বাকি/প্রদান হিসেবে যুক্ত করুন' : "Record as Due/Withdrawal in Customer's Ledger")
                              : `${t.recordTxInLedger} (${selectedGoal.customerName || (lang === 'bn' ? 'গ্রাহকের খাতা' : "Customer's Ledger")})`}
                          </label>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`w-full py-3 font-bold rounded-full transition-colors cursor-pointer text-xs flex items-center justify-center gap-2 touch-press ${
                          contributionActionType === 'withdrawal'
                            ? 'bg-rose-600 hover:bg-rose-700 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        } ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                        {isSubmitting ? (
                          <span className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            {t.saving}
                          </span>
                        ) : contributionActionType === 'withdrawal' ? (
                          lang === 'bn' ? 'উত্তোলন সম্পন্ন করুন' : 'Confirm Withdrawal'
                        ) : (
                          lang === 'bn' ? 'জমা সম্পন্ন করুন' : 'Confirm Deposit'
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Contribution Timeline */}
              <div className="space-y-2.5">
                <span className={`${glassLabelCls} block`}>
                  {selectedGoal.isOpenEnded
                    ? (lang === 'bn' ? 'জমা ও উত্তোলনের বিবরণী' : 'Savings & Withdrawal Ledger')
                    : (lang === 'bn' ? 'জমার বিবরণী' : 'Contribution Ledger')} ({selectedGoal.contributions?.length || 0})
                </span>

                <div className="surface-subcard border rounded-2xl overflow-hidden">
                  <div className="max-h-[220px] overflow-y-auto divide-y divide-slate-900/[0.06] dark:divide-white/[0.06]">
                    {(!selectedGoal.contributions || selectedGoal.contributions.length === 0) ? (
                      <div className="p-6 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 flex flex-col items-center gap-1.5">
                        <ReceiptText className="w-7 h-7 stroke-[1.25] text-slate-400" />
                        {lang === 'bn' ? 'কোন জমা বা উত্তোলনের রেকর্ড পাওয়া যায়নি' : 'No records logged yet'}
                      </div>
                    ) : (
                      [...selectedGoal.contributions].reverse().map((c, index) => {
                        const contribKey = c.id || c.date || index;
                        const isWithdrawal = c.type === 'withdrawal';
                        return (
                          <div key={contribKey} className="p-3 sm:px-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.04] transition-colors">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                {isWithdrawal ? (
                                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 stroke-[1.25] shrink-0" />
                                ) : (
                                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[1.25] shrink-0" />
                                )}
                                <span className="font-semibold text-slate-900 dark:text-white truncate text-xs sm:text-sm">
                                  {c.note || (isWithdrawal ? (lang === 'bn' ? 'টাকা উত্তোলন' : 'Withdrawal') : (lang === 'bn' ? 'কিস্তি জমা' : 'Deposit Added'))}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {new Date(c.date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {new Date(c.date).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`font-bold font-mono text-sm flex items-center gap-0.5 ${
                                isWithdrawal
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}>
                                {isWithdrawal ? `-৳${formatNumber(c.amount, lang)}` : `+৳${formatNumber(c.amount, lang)}`}
                              </span>
                              <div className="flex items-center gap-0.5 pl-1.5 border-l border-slate-900/[0.07] dark:border-white/[0.08]">
                                {editGoalContribution && (
                                  <button
                                    type="button"
                                    onClick={() => openEditContributionModal(c)}
                                    className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
                                    title={lang === 'bn' ? 'সম্পাদনা করুন' : 'Edit'}
                                  >
                                    <Pencil className="w-3.5 h-3.5 stroke-[1.25]" />
                                  </button>
                                )}
                                {deleteGoalContribution && (
                                  <button
                                    type="button"
                                    onClick={() => openDeleteContributionModal(c)}
                                    className="w-7 h-7 rounded-full text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-colors cursor-pointer"
                                    title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 stroke-[1.25]" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {selectedGoal.status === 'active' ? (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={openCancelGoalConfirm}
                    className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    {lang === 'bn' ? 'লক্ষ্যটি বাতিল করুন' : 'Cancel this Goal'}
                  </button>
                </div>
              ) : (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={openReactivateGoalConfirm}
                    className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer hover:underline flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5 stroke-[1.25]" />
                    <span>{lang === 'bn' ? 'লক্ষ্যটি পুনরায় চালু করুন' : 'Reactivate this Goal'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          </div>
        </ModalPortal>
      )}

      {/* ── REACTIVATION CONFIRMATION POPUP ── */}
      {showReactivateConfirm && selectedGoal && (
        <ModalPortal lockScroll={false}>
          <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
            <div
              className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
              onClick={closeReactivateGoalConfirm}
            />
            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-3xl border shadow-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 max-h-[90dvh] overflow-y-auto hide-scrollbar"
            >
              <div className="flex justify-center pb-3 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-slate-900/15 dark:bg-white/20 mx-auto" />
              </div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-slate-900/[0.05] dark:bg-white/[0.08] rounded-full flex items-center justify-center mx-auto mb-3">
                <RotateCcw className="w-5 h-5 text-slate-900 dark:text-white stroke-[1.25]" />
              </div>
              <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white mb-1.5">
                {lang === 'bn' ? 'লক্ষ্য পুনরায় চালুকরণ' : 'Reactivate Goal'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {lang === 'bn'
                  ? 'আপনি কি নিশ্চিত এই লক্ষ্যটি পুনরায় চলমান তালিকায় ফিরিয়ে নিতে চান?'
                  : 'Are you sure you want to restore this goal back to your active list?'}
              </p>

              <div className="bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.07] dark:border-white/[0.08] rounded-2xl p-3.5 text-left space-y-2 mt-4 text-xs">
                <div className="flex justify-between items-baseline">
                  <span className={glassLabelCls}>{lang === 'bn' ? 'লক্ষ্য' : 'Goal'}</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">{selectedGoal.title}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className={glassLabelCls}>{lang === 'bn' ? 'লক্ষ্যমাত্রা' : 'Target'}</span>
                  <span className="font-bold font-mono text-slate-900 dark:text-white">৳ {formatNumber(selectedGoal.targetAmount, lang)}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className={glassLabelCls}>{lang === 'bn' ? 'জমা হয়েছে' : 'Saved'}</span>
                  <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">৳ {formatNumber(selectedGoal.savedAmount || 0, lang)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  triggerHaptic('double');
                  await updateGoalStatus(selectedGoal.id, 'active');
                  setSelectedGoal(prev => prev ? { ...prev, status: 'active' } : null);
                  closeReactivateGoalConfirm();
                  toast.success(lang === 'bn' ? 'লক্ষ্যটি সফলভাবে পুনরায় চালু করা হয়েছে' : 'Goal reactivated successfully');
                }}
                className="w-full py-3 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold rounded-full cursor-pointer transition-colors text-xs touch-press"
              >
                {lang === 'bn' ? 'হ্যাঁ, পুনরায় চালু করুন' : 'Yes, Reactivate Goal'}
              </button>
              <button
                type="button"
                onClick={closeReactivateGoalConfirm}
                className="w-full py-3 bg-slate-900/[0.05] hover:bg-slate-900/[0.09] dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 font-bold rounded-full cursor-pointer transition-colors text-xs"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
            </div>
          </div>
          </div>
        </ModalPortal>
      )}

      {/* ── CANCEL CONFIRMATION POPUP ── */}
      {showCancelConfirm && selectedGoal && (
        <ModalPortal lockScroll={false}>
          <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
            <div
              className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
              onClick={closeCancelGoalConfirm}
            />
            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-3xl border shadow-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 max-h-[90dvh] overflow-y-auto hide-scrollbar"
            >
              <div className="flex justify-center pb-3 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-slate-900/15 dark:bg-white/20 mx-auto" />
              </div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 stroke-[1.25]" />
              </div>
              <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white mb-1.5">
                {lang === 'bn' ? 'লক্ষ্য বাতিল নিশ্চিতকরণ' : 'Confirm Goal Cancellation'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {lang === 'bn'
                  ? 'আপনি কি নিশ্চিতভাবে এই লক্ষ্যটি বাতিল করতে চান? এটি আর্কাইভে সংরক্ষিত থাকবে।'
                  : 'Are you sure you want to cancel this goal? It will be moved to History.'}
              </p>

              <div className="bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.07] dark:border-white/[0.08] rounded-2xl p-3.5 text-left space-y-2 mt-4 text-xs">
                <div className="flex justify-between items-baseline">
                  <span className={glassLabelCls}>{lang === 'bn' ? 'লক্ষ্য' : 'Goal'}</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">{selectedGoal.title}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className={glassLabelCls}>{lang === 'bn' ? 'লক্ষ্যমাত্রা' : 'Target'}</span>
                  <span className="font-bold font-mono text-slate-900 dark:text-white">৳ {formatNumber(selectedGoal.targetAmount, lang)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  triggerHaptic('double');
                  await updateGoalStatus(selectedGoal.id, 'cancelled');
                  closeCancelGoalConfirm();
                  closeGoalDetail();
                  toast.success(lang === 'bn' ? 'লক্ষ্যটি বাতিল করা হয়েছে' : 'Goal cancelled');
                }}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-full cursor-pointer transition-colors text-xs touch-press"
              >
                {lang === 'bn' ? 'হ্যাঁ, বাতিল করুন' : 'Yes, Cancel Goal'}
              </button>
              <button
                type="button"
                onClick={closeCancelGoalConfirm}
                className="w-full py-3 bg-slate-900/[0.05] hover:bg-slate-900/[0.09] dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 font-bold rounded-full cursor-pointer transition-colors text-xs"
              >
                {lang === 'bn' ? 'না, ফেরত যান' : 'No, Go Back'}
              </button>
            </div>
          </div>
          </div>
        </ModalPortal>
      )}

      {/* ── DELETE CONFIRMATION POPUP ── */}
      {showDeleteConfirm && selectedGoal && (
        <ModalPortal lockScroll={false}>
          <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
            <div
              className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
              onClick={closeDeleteGoalConfirm}
            />
            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-3xl border shadow-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 max-h-[90dvh] overflow-y-auto hide-scrollbar"
            >
              <div className="flex justify-center pb-3 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-slate-900/15 dark:bg-white/20 mx-auto" />
              </div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400 stroke-[1.25]" />
              </div>
              <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white mb-1.5">
                {lang === 'bn' ? 'লক্ষ্য স্থায়ীভাবে মুছুন' : 'Delete Goal Permanently'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {lang === 'bn'
                  ? 'আপনি কি নিশ্চিত এই লক্ষ্যটি চিরতরে মুছে ফেলতে চান? এর কিস্তির সকল তথ্য চিরতরে মুছে যাবে।'
                  : 'Are you sure you want to delete this goal permanently? All contribution records will be permanently lost.'}
              </p>

              <div className="bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.07] dark:border-white/[0.08] rounded-2xl p-3.5 text-left space-y-2 mt-4 text-xs">
                <div className="flex justify-between items-baseline">
                  <span className={glassLabelCls}>{lang === 'bn' ? 'লক্ষ্য' : 'Goal'}</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">{selectedGoal.title}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className={glassLabelCls}>{lang === 'bn' ? 'লক্ষ্যমাত্রা' : 'Target'}</span>
                  <span className="font-bold font-mono text-slate-900 dark:text-white">৳ {formatNumber(selectedGoal.targetAmount, lang)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  triggerHaptic('double');
                  await deleteGoal(selectedGoal.id);
                  closeDeleteGoalConfirm();
                  closeGoalDetail();
                  toast.success(lang === 'bn' ? 'লক্ষ্যটি মুছে ফেলা হয়েছে' : 'Goal deleted successfully');
                }}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-full cursor-pointer transition-colors text-xs touch-press"
              >
                {lang === 'bn' ? 'হ্যাঁ, স্থায়ীভাবে মুছুন' : 'Yes, Delete Permanently'}
              </button>
              <button
                type="button"
                onClick={closeDeleteGoalConfirm}
                className="w-full py-3 bg-slate-900/[0.05] hover:bg-slate-900/[0.09] dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 font-bold rounded-full cursor-pointer transition-colors text-xs"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
            </div>
          </div>
          </div>
        </ModalPortal>
      )}

      {/* ── EMI NOTIFICATION REMINDER MODAL ── */}
      {emiReminderGoal && (
        <ModalPortal lockScroll={false}>
          <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
            <div className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur" onClick={closeEmiReminderModal} />

            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-slide-up glass-modal w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl border shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col relative z-10"
            >
              <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-900/15 dark:bg-white/20 mx-auto" />
              </div>

              <div className="px-5 py-3.5 border-b border-slate-900/[0.06] dark:border-white/[0.06] flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white leading-tight">
                    {lang === 'bn' ? 'কিস্তি রিমাইন্ডার' : 'Monthly EMI Reminder'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[240px] mt-0.5">
                    {emiReminderGoal.title}
                  </p>
                </div>
                <button
                  onClick={closeEmiReminderModal}
                  className="w-8 h-8 rounded-full bg-slate-900/[0.05] hover:bg-slate-900/[0.1] dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4 stroke-[1.25]" />
                </button>
              </div>

              <div className="flex-1 min-h-0 p-5 space-y-4 overflow-y-auto hide-scrollbar">
              <div className="p-3.5 bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.06] dark:border-white/[0.06] rounded-2xl text-xs text-slate-600 dark:text-slate-300 font-medium flex items-start gap-2.5 leading-relaxed">
                <Info className="w-4 h-4 shrink-0 text-slate-900 dark:text-white mt-0.5 stroke-[1.25]" />
                <span>
                  {lang === 'bn'
                    ? 'প্রতি মাসে আপনার কিস্তির নির্ধারিত তারিখের ৭ দিন আগে থেকে প্রতিদিন নোটিফিকেশন অ্যালার্ট পাঠানো হবে যাতে সময়মতো কিস্তি পরিশোধ করা যায়।'
                    : 'A notification will be sent each day 7 days prior to remind you that your upcoming monthly EMI installment is due.'}
                </span>
              </div>

              <div className="bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.07] dark:border-white/[0.08] p-3.5 rounded-2xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className={`${glassLabelCls} block`}>
                    {lang === 'bn' ? 'কিস্তির পরিমাণ' : 'Installment Amount'}
                  </span>
                  <span className="text-base font-bold font-mono text-slate-950 dark:text-white">
                    ৳{formatNumber(emiReminderGoal.installmentAmount || emiReminderGoal.targetAmount, lang)}
                  </span>
                </div>
                <div className="text-right">
                  <span className={`${glassLabelCls} block`}>
                    {lang === 'bn' ? 'ধরন' : 'Type'}
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase">
                    {emiReminderGoal.type === 'deposit' ? 'EMI / কিস্তি' : 'Savings Goal'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={`${glassLabelCls} flex items-center gap-1.5`}>
                  <CalendarClock className="w-3.5 h-3.5 text-slate-900 dark:text-white stroke-[1.25]" />
                  {lang === 'bn' ? 'প্রতি মাসের কিস্তির তারিখ' : 'Day of Month for EMI'} *
                </label>
                <NativeOptionPicker
                  value={emiDueDay}
                  onChange={setEmiDueDay}
                  lang={lang}
                  title={lang === 'bn' ? 'প্রতি মাসের কিস্তির তারিখ' : 'Day of Month for EMI'}
                  gridColumns={7}
                  options={Array.from({ length: 31 }, (_, i) => i + 1).map(day => ({
                    value: day,
                    label: lang === 'bn' ? `প্রতি মাসের ${formatNumber(day, 'bn')} তারিখ` : `Day ${day} of every month`,
                    compactLabel: formatNumber(day, lang)
                  }))}
                  triggerClassName={`${glassFieldCls} text-sm font-bold cursor-pointer flex items-center justify-between gap-2 text-left touch-press`}
                />
              </div>

              <div className="space-y-1.5">
                <label className={`${glassLabelCls} flex items-center gap-1.5`}>
                  <Bell className="w-3.5 h-3.5 text-slate-900 dark:text-white stroke-[1.25]" />
                  {lang === 'bn' ? 'নোটিফিকেশন অ্যালার্টের সময়' : 'Notification Alert Time'}
                </label>
                <NativeTimePicker
                  value={emiAlertTime}
                  onChange={setEmiAlertTime}
                  lang={lang}
                  title={lang === 'bn' ? 'নোটিফিকেশন অ্যালার্টের সময়' : 'Notification Alert Time'}
                  triggerClassName={`${glassFieldCls} text-sm font-mono font-bold flex items-center justify-between gap-2 cursor-pointer text-left touch-press`}
                />
              </div>

              {reminders.some(r => r.goalId === emiReminderGoal.id && r.active) && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-slate-900 dark:text-white font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 stroke-[1.25]" />
                  <span>
                    {lang === 'bn'
                      ? 'এই কিস্তির রিমাইন্ডার বর্তমানে সক্রিয় রয়েছে।'
                      : 'An EMI reminder is currently active for this goal.'}
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5 border-t border-slate-900/[0.06] dark:border-white/[0.06] bg-white/60 dark:bg-black/30 backdrop-blur-xl space-y-2 shrink-0">
              <button
                type="button"
                disabled={isSavingEmiReminder}
                onClick={handleSaveEmiReminder}
                className="w-full py-3 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold rounded-full text-xs cursor-pointer transition-colors flex items-center justify-center gap-2 touch-press"
              >
                <Bell className="w-4 h-4 stroke-[1.25]" />
                {reminders.some(r => r.goalId === emiReminderGoal.id && r.active)
                  ? (lang === 'bn' ? 'রিমাইন্ডার আপডেট করুন' : 'Update EMI Reminder')
                  : (lang === 'bn' ? 'কিস্তির অ্যালার্ট চালু করুন' : 'Enable EMI Reminder')}
              </button>

              {reminders.some(r => r.goalId === emiReminderGoal.id) && (
                <button
                  type="button"
                  onClick={handleRemoveEmiReminder}
                  className="w-full py-3 bg-rose-500/10 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold rounded-full text-xs cursor-pointer transition-colors"
                >
                  {lang === 'bn' ? 'রিমাইন্ডার বন্ধ করুন' : 'Turn Off Reminder'}
                </button>
              )}

              <button
                type="button"
                onClick={closeEmiReminderModal}
                className="w-full py-3 bg-slate-900/[0.05] hover:bg-slate-900/[0.09] dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 font-bold rounded-full text-xs cursor-pointer transition-colors"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
            </div>
          </div>
          </div>
        </ModalPortal>
      )}

      {/* ── EDIT CONTRIBUTION MODAL ── */}
      {editingContribution && selectedGoal && (
        <ModalPortal lockScroll={false}>
          <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
            <div
              className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
              onClick={closeEditContributionModal}
            />
            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl border shadow-2xl p-5 sm:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 max-h-[90dvh] overflow-y-auto hide-scrollbar"
            >
              <div className="flex justify-center pb-3 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-slate-900/15 dark:bg-white/20 mx-auto" />
              </div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-900/[0.06] dark:border-white/[0.06] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-slate-900/[0.05] dark:bg-white/[0.08] rounded-full flex items-center justify-center text-slate-900 dark:text-white">
                  <Pencil className="w-3.5 h-3.5 stroke-[1.25]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                    {lang === 'bn' ? 'জমার বিবরণ সম্পাদনা' : 'Edit Contribution'}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                    {selectedGoal.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditContributionModal}
                className="w-8 h-8 rounded-full bg-slate-900/[0.05] dark:bg-white/[0.08] text-slate-500 hover:text-slate-950 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[1.25]" />
              </button>
            </div>

            <form onSubmit={handleSaveEditContribution} className="space-y-3.5">
              <div>
                <label className={`${glassLabelCls} block mb-1.5`}>
                  {lang === 'bn' ? 'জমার পরিমাণ (৳)' : 'Deposit Amount (৳)'} *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  data-numpad="true"
                  required
                  value={editContribAmount}
                  onChange={(e) => handleAmountChange(e.target.value, setEditContribAmount)}
                  placeholder="0.00"
                  className={`${glassFieldCls} text-base font-mono font-bold`}
                  autoFocus
                />
              </div>

              <div>
                <label className={`${glassLabelCls} block mb-1.5`}>
                  {lang === 'bn' ? 'বিবরণ / নোট' : 'Note / Description'}
                </label>
                <input
                  type="text"
                  value={editContribNote}
                  onChange={(e) => setEditContribNote(e.target.value)}
                  placeholder={lang === 'bn' ? 'যেমন: ১ম কিস্তি' : 'e.g. 1st installment'}
                  className={`${glassFieldCls} text-sm font-medium`}
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={closeEditContributionModal}
                  className="flex-1 py-3 bg-slate-900/[0.05] hover:bg-slate-900/[0.09] dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 font-bold rounded-full text-xs cursor-pointer transition-colors"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSavingEditContrib}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-full text-xs cursor-pointer transition-colors flex items-center justify-center gap-2 touch-press"
                >
                  {isSavingEditContrib ? (
                    <span className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t.saving}
                    </span>
                  ) : (
                    lang === 'bn' ? 'আপডেট করুন' : 'Update Deposit'
                  )}
                </button>
              </div>
            </form>
          </div>
          </div>
        </ModalPortal>
      )}

      {/* ── DELETE CONTRIBUTION CONFIRMATION MODAL ── */}
      {deletingContribution && selectedGoal && (
        <ModalPortal lockScroll={false}>
          <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
            <div
              className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
              onClick={closeDeleteContributionModal}
            />
            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-3xl border shadow-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 max-h-[90dvh] overflow-y-auto hide-scrollbar"
            >
              <div className="flex justify-center pb-3 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-slate-900/15 dark:bg-white/20 mx-auto" />
              </div>
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400 stroke-[1.25]" />
              </div>
              <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white mb-1">
                {lang === 'bn' ? 'জমা মুছে ফেলুন' : 'Delete Contribution'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {lang === 'bn'
                  ? 'আপনি কি নিশ্চিত এই জমার রেকর্ডটি মুছে ফেলতে চান? এটি লক্ষ্যের মোট জমা থেকে বাদ দেওয়া হবে।'
                  : 'Are you sure you want to delete this contribution? It will be deducted from your total saved amount.'}
              </p>

              <div className="bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.07] dark:border-white/[0.08] rounded-2xl p-3.5 text-left space-y-1.5 mt-3 text-xs">
                <div className="flex justify-between items-baseline">
                  <span className={glassLabelCls}>{lang === 'bn' ? 'পরিমাণ' : 'Amount'}</span>
                  <span className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400">৳ {formatNumber(deletingContribution.amount, lang)}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className={glassLabelCls}>{lang === 'bn' ? 'বিবরণ' : 'Note'}</span>
                  <span className="font-medium text-slate-900 dark:text-white truncate max-w-[180px]">
                    {deletingContribution.note || (lang === 'bn' ? 'কিস্তি জমা' : 'Installment Added')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={isDeletingContrib}
                onClick={handleConfirmDeleteContribution}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-full text-xs cursor-pointer transition-colors flex items-center justify-center gap-2 touch-press"
              >
                {isDeletingContrib ? (
                  <span className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {lang === 'bn' ? 'মুছে ফেলা হচ্ছে...' : 'Deleting...'}
                  </span>
                ) : (
                  lang === 'bn' ? 'হ্যাঁ, মুছে ফেলুন' : 'Yes, Delete Contribution'
                )}
              </button>

              <button
                type="button"
                onClick={closeDeleteContributionModal}
                className="w-full py-3 bg-slate-900/[0.05] hover:bg-slate-900/[0.09] dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 font-bold rounded-full text-xs cursor-pointer transition-colors"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
            </div>
          </div>
          </div>
        </ModalPortal>
      )}

      {/* ── RENAME GOAL POPUP MODAL ── */}
      {isEditingGoalTitle && selectedGoal && (
        <ModalPortal lockScroll={false}>
          <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 no-select overflow-hidden">
            <div
              className="absolute inset-0 bg-slate-950/60 dark:bg-black/75 animate-backdrop-blur"
              onClick={closeRenameGoal}
            />
            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-slide-up relative z-10 glass-modal w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl border shadow-2xl p-5 sm:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 max-h-[90dvh] overflow-y-auto hide-scrollbar"
            >
              <div className="flex justify-center pb-3 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-slate-900/15 dark:bg-white/20 mx-auto" />
              </div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-900/[0.06] dark:border-white/[0.06] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-slate-900/[0.05] dark:bg-white/[0.08] rounded-full flex items-center justify-center text-slate-900 dark:text-white">
                  <Pencil className="w-3.5 h-3.5 stroke-[1.25]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                    {lang === 'bn' ? 'লক্ষ্যের শিরোনাম পরিবর্তন' : 'Rename Goal'}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                    {selectedGoal.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeRenameGoal}
                className="w-8 h-8 rounded-full bg-slate-900/[0.05] dark:bg-white/[0.08] text-slate-500 hover:text-slate-950 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[1.25]" />
              </button>
            </div>

            <form onSubmit={handleSaveGoalTitle} className="space-y-3.5">
              <div>
                <label className={`${glassLabelCls} block mb-1.5`}>
                  {lang === 'bn' ? 'নতুন শিরোনাম' : 'Goal Title'} *
                </label>
                <input
                  ref={renameInputRef}
                  type="text"
                  required
                  value={editedGoalTitle}
                  onChange={(e) => setEditedGoalTitle(e.target.value)}
                  placeholder={lang === 'bn' ? 'লক্ষ্যের নতুন নাম লিখুন' : 'Enter new goal title'}
                  className={`${glassFieldCls} text-base font-bold`}
                  autoFocus
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={closeRenameGoal}
                  className="flex-1 py-3 bg-slate-900/[0.05] hover:bg-slate-900/[0.09] dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 font-bold rounded-full text-xs cursor-pointer transition-colors"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSavingGoalTitle}
                  className="flex-1 py-3 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold rounded-full text-xs cursor-pointer transition-colors flex items-center justify-center gap-2 touch-press"
                >
                  {isSavingGoalTitle ? (
                    <span className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                      {t.saving}
                    </span>
                  ) : (
                    lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Title'
                  )}
                </button>
              </div>
            </form>
          </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
