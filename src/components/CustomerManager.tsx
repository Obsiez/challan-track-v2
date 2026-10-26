import React, { useState, useMemo, useRef } from 'react';
import { Customer, Transaction } from '../types';
import { 
	Search, UserPlus, Phone, ArrowUpRight, ArrowDownLeft, ReceiptText, ChevronDown, ChevronUp, ChevronRight, Pin, 
	MessageSquare, MessageCircleMore, CircleEllipsis, Trash2, Pencil, RefreshCw, X, UserMinus, Plus, Minus, ShieldCheck, 
	AlertTriangle, ArrowLeftRight, Check, Trash, Users, Send, ArrowLeft, ArrowUpDown, Delete,
	BookUser, Download, Share2, Copy, MoreHorizontal, Archive, RotateCcw,
	History, FileText, Info, CreditCard, Calendar
} from 'lucide-react';
import { 
  generateReceiptPng, 
  downloadReceiptImage, 
  copyReceiptImage, 
  shareReceiptImage, 
  ReceiptImageResult
} from '../lib/receiptGenerator';
import { toast } from 'sonner';
import { motion, AnimatePresence, useAnimation } from 'motion/react';
import { getPhoneticKey, matchesPhonetic, isPhoneticSearchEnabled } from '../lib/phonetics';
import { translations, formatNumber, formatIndianNumberString, Language } from '../lib/translations';
import { triggerHaptic } from '../lib/haptics';
import { showNotification } from '../lib/notifications';
import ContactNumberPickerModal from './ContactNumberPickerModal';
import { cleanBangladeshiPhone } from '../lib/phoneUtils';

const WhatsAppIcon = () => (
	<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" className="shrink-0">
		<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
	</svg>
);

const ListClockIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
	>
		<path d="M21 5H3" />
		<path d="M10 12H3" />
		<path d="M10 19H3" />
		<circle cx="17" cy="15" r="5" />
		<path d="M17 13v2l1.5 1" />
	</svg>
);


interface SwipeableCustomerItemProps {
	customer: Customer;
	lang: Language;
	onClick: () => void;
	isSelected: boolean;
	onWhatsApp: () => void;
	onDelete: () => void;
	swipeGesturesEnabled: boolean;
	isDeleting: boolean;
	children: React.ReactNode;
	activeSwipingId: string | null;
	setActiveSwipingId: (id: string | null) => void;
}

const SwipeableCustomerItem = ({
	customer,
	lang,
	onClick,
	isSelected,
	onWhatsApp,
	onDelete,
	swipeGesturesEnabled,
	isDeleting,
	children,
	activeSwipingId,
	setActiveSwipingId
}: SwipeableCustomerItemProps) => {
	const cardRef = React.useRef<HTMLDivElement>(null);
	const controls = useAnimation();
	React.useEffect(() => {
		return () => {
			if ((window as any).activeSwipingId === customer.id) {
				(window as any).activeSwipingId = null;
			}
		};
	}, [customer.id]);
	const startXRef = React.useRef(0);
	const startYRef = React.useRef(0);
	const isSwipingRef = React.useRef(false);
	const hasVibratedRef = React.useRef(false);
	const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null);
	const isSnappingRef = React.useRef(false);
	const prevIsDeletingRef = React.useRef(isDeleting);

	React.useEffect(() => {
		if (isDeleting) {
			prevIsDeletingRef.current = true;
			const cardWidth = cardRef.current?.offsetWidth || 350;
			setSwipeDir('left');
			controls.start({
				x: -cardWidth * 0.4,
				transition: { type: 'spring', stiffness: 300, damping: 15, mass: 0.6 }
			});
		} else if (prevIsDeletingRef.current) {
			prevIsDeletingRef.current = false;
			controls.start({
				x: 0,
				transition: { type: 'spring', stiffness: 300, damping: 25 }
			}).then(() => {
				setSwipeDir(null);
				isSwipingRef.current = false;
				setActiveSwipingId(null);
				(window as any).activeSwipingId = null;
			});
		}
	}, [isDeleting, controls, setActiveSwipingId]);

	const handleSnap = (targetX: number) => {
		if (isSnappingRef.current) return;
		isSnappingRef.current = true;

		// Rapidly accelerate card to targetX (underdamped spring physics: overshoot and bounce back)
		controls.start({
			x: targetX,
			transition: { type: 'spring', stiffness: 350, damping: 15, mass: 0.6 }
		}).then(() => {
			if (targetX > 0) {
				// WhatsApp action: trigger and close immediately
				onWhatsApp();
				controls.start({
					x: 0,
					transition: { type: 'spring', stiffness: 200, damping: 25 }
				}).then(() => {
					setSwipeDir(null);
					isSwipingRef.current = false;
					isSnappingRef.current = false;
					setActiveSwipingId(null);
				});
			} else {
				// Delete action: trigger and let the isDeleting prop control the open state/closing
				onDelete();
				isSnappingRef.current = false;
				setActiveSwipingId(null);
			}
		});
	};

	const handleTouchStart = (e: React.TouchEvent) => {
		if (!swipeGesturesEnabled || isSnappingRef.current || isDeleting) return;
		
		startXRef.current = e.touches[0].clientX;
		startYRef.current = e.touches[0].clientY;
		isSwipingRef.current = false;
		hasVibratedRef.current = false;
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		if (!swipeGesturesEnabled || isSnappingRef.current || isDeleting) return;
		const diffX = e.touches[0].clientX - startXRef.current;
		const diffY = e.touches[0].clientY - startYRef.current;

		if (!isSwipingRef.current) {
			// Accidental diagonal scrolls check: require diffX to be greater than diffY, and at least 15px threshold to activate swipe.
			if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 15) {
				isSwipingRef.current = true;
				setActiveSwipingId(customer.id);
				(window as any).activeSwipingId = customer.id;
			}
		}

		if (isSwipingRef.current) {
			const cardWidth = cardRef.current?.offsetWidth || 350;
			const thresholdX = cardWidth * 0.4; // 40% threshold of card width

			// 1. Rubber Banding: Apply high non-linear resistance to active horizontal drag.
			// Moves MUCH slower than actual finger distance.
			const resistanceX = Math.sign(diffX) * Math.pow(Math.abs(diffX), 0.7) * 0.85;

			const dir = resistanceX > 0 ? 'right' : (resistanceX < 0 ? 'left' : null);
			if (dir !== swipeDir) {
				setSwipeDir(dir);
			}

			// Update motion transform position directly
			controls.set({ x: resistanceX });

			// Threshold punchy haptic when finger distance reaches the critical threshold (thresholdX)
			if (Math.abs(diffX) >= thresholdX && !hasVibratedRef.current) {
				triggerHaptic('punchy');
				hasVibratedRef.current = true;
			} else if (Math.abs(diffX) < thresholdX && hasVibratedRef.current) {
				hasVibratedRef.current = false;
			}

			// 2. Threshold Override: instantly accelerate forward to 40% open state if finger crosses threshold
			if (Math.abs(diffX) >= thresholdX) {
				handleSnap(diffX > 0 ? thresholdX : -thresholdX);
				return;
			}

			if (e.cancelable) {
				e.preventDefault();
			}
		}
	};

	const handleTouchEnd = () => {
		if (!swipeGesturesEnabled || isSnappingRef.current || isDeleting) return;
		if (isSwipingRef.current) {
			// Cancel Phase: Snap back to 0% if released before the 40% threshold
			controls.start({
				x: 0,
				transition: { type: 'spring', stiffness: 400, damping: 30 }
			}).then(() => {
				setSwipeDir(null);
				isSwipingRef.current = false;
				hasVibratedRef.current = false;
				setActiveSwipingId(null);
			});
		}
	};

	return (
		<div ref={cardRef} className="relative overflow-hidden rounded-2xl w-full">
			{swipeDir === 'right' && (
				<div className="absolute inset-0 bg-[#048848] flex items-center justify-start pl-6 text-white rounded-2xl font-bold text-xs gap-2">
					<WhatsAppIcon />
					<span className="font-bold text-xs">{lang === 'bn' ? 'হোয়াটসঅ্যাপ' : 'WhatsApp'}</span>
				</div>
			)}
			{swipeDir === 'left' && (
				<div className="absolute inset-0 bg-[#E11900] flex items-center justify-end pr-6 text-white rounded-2xl font-bold text-xs gap-2">
					<span className="font-bold text-xs">{lang === 'bn' ? 'মুছুন' : 'Delete'}</span>
					<Trash2 className="w-6 h-6 text-white" />
				</div>
			)}
			<motion.div
				animate={controls}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				onTouchCancel={handleTouchEnd}
				onClick={onClick}
				className="w-full relative touch-pan-y"
			>
				{children}
			</motion.div>
		</div>
	);
};


const parseFirestoreDate = (dateVal: any): Date => {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal.toDate === 'function') return dateVal.toDate();
  if (dateVal.seconds !== undefined) return new Date(dateVal.seconds * 1000);
  const parsed = new Date(dateVal);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

interface CustomerManagerProps {
 customers: Customer[];
 transactions: Transaction[];
 createCustomer: (
   name: string,
   phone: string,
   options?: { accountType?: 'standard' | 'credit_card'; billingDay?: number }
 ) => Promise<string | null | undefined>;
 addTransaction: (
 customerId: string, 
 type: 'due' | 'payment', 
 amount: number, 
 description: string,
 date?: Date,
 fallbackCustomerInfo?: { name: string; phone: string; accountType?: 'standard' | 'credit_card'; billingDay?: number }
 ) => Promise<void>;
 updateCustomerDetails: (
   customerId: string,
   name: string,
   phone: string,
   options?: { accountType?: 'standard' | 'credit_card'; billingDay?: number }
 ) => Promise<void>;
 editTransaction?: (transactionId: string, newType: 'due' | 'payment', newAmount: number, newDescription: string) => Promise<void>;
 deleteTransaction?: (transactionId: string) => Promise<void>;
 deleteCustomer: (id: string) => Promise<void>;
 selectedCustomerId: string | null;
 setSelectedCustomerId: (id: string | null) => void;
 lang: Language;
 triggerConfirm?: (title: string, message: string, onConfirm: () => void) => void;
  swipeGesturesEnabled?: boolean;
  highlightedTxId?: string | null;
  setHighlightedTxId?: (id: string | null) => void;
  hasMoreTxs: boolean;
  loadMoreTransactions: () => void;
  customerTxLimit?: number;
  resetCustomerTxLimit?: () => void;
  activeCustomerTxCount?: number;
  archivedStatements?: any[];
  archiveCustomerExcessStatements?: (customerId: string, keepCount: number) => Promise<number>;
  exportArchivedStatements?: (customerId?: string) => Promise<any[]> | any;
}

export default function CustomerManager({
 customers,
 transactions,
 createCustomer,
 addTransaction,
 updateCustomerDetails,
 editTransaction,
 deleteTransaction,
 deleteCustomer,
 selectedCustomerId,
 setSelectedCustomerId,
 lang,
 triggerConfirm,
  swipeGesturesEnabled = true,
  highlightedTxId = null,
  setHighlightedTxId = () => {},
  hasMoreTxs,
  loadMoreTransactions,
  customerTxLimit = 5,
  resetCustomerTxLimit = () => {},
  activeCustomerTxCount = 0,
  archivedStatements = [],
  archiveCustomerExcessStatements,
  exportArchivedStatements
}: CustomerManagerProps) {
 const t = translations[lang];

 const [showExtraBalanceCards, setShowExtraBalanceCards] = useState(false);
 const [showMonthlyCycle, setShowMonthlyCycle] = useState(false);
 const [isManageStatementsOpen, setIsManageStatementsOpen] = useState(false);
 const [manualKeepCountInput, setManualKeepCountInput] = useState('15');
 const [isManualArchiving, setIsManualArchiving] = useState(false);

 React.useEffect(() => {
   setShowExtraBalanceCards(false);
   setShowMonthlyCycle(false);
   setIsManageStatementsOpen(false);
   setCardCycleTab('unbilled');
   setActionTargetCycle('unbilled');
 }, [selectedCustomerId]);

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
 const [showAddForm, setShowAddForm] = useState(false);
 const [newName, setNewName] = useState('');
 const [newPhone, setNewPhone] = useState('');
 const [newAccountType, setNewAccountType] = useState<'standard' | 'credit_card'>('standard');
 const [newBillingDay, setNewBillingDay] = useState<string>('');
 const [pendingContactChoice, setPendingContactChoice] = useState<{
   contactName: string;
   numbers: string[];
   isNewAccount?: boolean;
   onSelect: (number: string, finalName?: string) => void;
 } | null>(null);
 const [formError, setFormError] = useState('');
 const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

 // Individual Customer transaction adding form state
 const [openActionType, setOpenActionType] = useState<'due' | 'payment' | null>(null);
 const [actionAmount, setActionAmount] = useState('');
 const [actionDesc, setActionDesc] = useState('');
 const [actionTargetCycle, setActionTargetCycle] = useState<'unbilled' | 'billed'>('unbilled');
 const [txSubmitting, setTxSubmitting] = useState(false);

 // Credit Card Billing Cycle View Tab ('unbilled' = This Month, 'billed' = Last Month)
 const [cardCycleTab, setCardCycleTab] = useState<'unbilled' | 'billed'>('unbilled');

 const [filterStatus, setFilterStatus] = useState<'all' | 'due' | 'settled' | 'overpaid'>('all');
 const filterPillsContainerRef = useRef<HTMLDivElement | null>(null);
 const isSlidingFilterRef = useRef(false);

 const selectFilterPillAtClientX = (clientX: number, isInitialPress = false) => {
   const container = filterPillsContainerRef.current;
   if (!container) return;
   const pills = Array.from(container.querySelectorAll<HTMLButtonElement>('button[data-filter-pill]'));
   if (pills.length === 0) return;

   let matchedId: 'all' | 'due' | 'settled' | 'overpaid' | null = null;
   let minDist = Infinity;

   for (const pill of pills) {
     const rect = pill.getBoundingClientRect();
     const id = pill.getAttribute('data-filter-pill') as 'all' | 'due' | 'settled' | 'overpaid' | null;
     if (!id) continue;

     if (clientX >= rect.left && clientX <= rect.right) {
       matchedId = id;
       break;
     }

     const center = (rect.left + rect.right) / 2;
     const dist = Math.abs(clientX - center);
     if (dist < minDist) {
       minDist = dist;
       matchedId = id;
     }
   }

   if (matchedId) {
     setFilterStatus((prev) => {
       if (prev !== matchedId) {
         triggerHaptic(isInitialPress ? 'single' : 'tick');
         return matchedId!;
       }
       if (isInitialPress) {
         triggerHaptic('single');
       }
       return prev;
     });
   }
 };

 // Editing state for customer details
 const [isEditingCustomer, setIsEditingCustomer] = useState(false);
 const [editName, setEditName] = useState('');
 const [editPhone, setEditPhone] = useState('');
 const [editAccountType, setEditAccountType] = useState<'standard' | 'credit_card'>('standard');
 const [editBillingDay, setEditBillingDay] = useState<string>('');
 const [editError, setEditError] = useState('');
 const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Selected message template for reminder alerts
  const [selectedTemplate, setSelectedTemplate] = useState<1 | 2 | 3>(() => {
    try {
      const stored = localStorage.getItem('selected_reminder_template');
      if (stored) {
        const val = Number(stored);
        if (val === 1 || val === 2 || val === 3) return val as 1 | 2 | 3;
      }
      return 1;
    } catch (e) {
      return 1;
    }
  });

  React.useEffect(() => {
    localStorage.setItem('selected_reminder_template', String(selectedTemplate));
  }, [selectedTemplate]);

 // Transaction Edit/Delete Modal states
 
  const [phoneWarningCustomer, setPhoneWarningCustomer] = useState<Customer | null>(null);
  const [pinActionCustomer, setPinActionCustomer] = useState<Customer | null>(null);
  const [receiptResult, setReceiptResult] = useState<ReceiptImageResult | null>(null);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
  const [isCopiedReceipt, setIsCopiedReceipt] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'high_balance' | 'low_balance' | 'custom'>('recent');
  const [customOrder, setCustomOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('customers_custom_order');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  const saveCustomOrder = (newOrder: string[]) => {
    setCustomOrder(newOrder);
    localStorage.setItem('customers_custom_order', JSON.stringify(newOrder));
  };

  const [activeSwipingId, setActiveSwipingId] = useState<string | null>(null);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [pinnedCustomerNames, setPinnedCustomerNames] = useState<string[]>(() => {
    try {
      const storedNames = localStorage.getItem('pinned_customers_names');
      if (storedNames) return JSON.parse(storedNames);
      return [];
    } catch (e) {
      return [];
    }
  });

  const togglePinCustomer = (id: string) => {
    const customer = customers.find(c => c.id === id);
    if (!customer) return;
    triggerHaptic('single');
    setPinnedCustomerNames(prev => {
      const updated = prev.includes(customer.name) ? prev.filter(name => name !== customer.name) : [...prev, customer.name];
      localStorage.setItem('pinned_customers_names', JSON.stringify(updated));
      return updated;
    });
  };
const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editTxAmount, setEditTxAmount] = useState('');
  const [editTxDesc, setEditTxDesc] = useState('');
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [ledgerLimit, setLedgerLimit] = useState(5);

  const [auditLogTx, setAuditLogTx] = useState<Transaction | null>(null);

  // Background scroll disabled while Audit Log popup is opened
  React.useEffect(() => {
    if (auditLogTx) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [auditLogTx]);

  // Sync pinned customer names on storage events (e.g., from backup import)
  React.useEffect(() => {
    const handleStorage = () => {
      try {
        const stored = localStorage.getItem('pinned_customers_names');
        if (stored) setPinnedCustomerNames(JSON.parse(stored));
      } catch {}
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const [duplicateTxWarning, setDuplicateTxWarning] = useState<Transaction | null>(null);
  const [hasShownDuplicateWarning, setHasShownDuplicateWarning] = useState(false);

  React.useEffect(() => {
    setLedgerLimit(5);
    setDuplicateTxWarning(null);
    setHasShownDuplicateWarning(false);
  }, [selectedCustomerId]);

  React.useEffect(() => {
    setDuplicateTxWarning(null);
    setHasShownDuplicateWarning(false);
  }, [openActionType]);

  React.useEffect(() => {
    try {
      const oldIdsStr = localStorage.getItem('pinned_customers');
      if (oldIdsStr && customers.length > 0) {
        const oldIds = JSON.parse(oldIdsStr) as string[];
        if (oldIds.length > 0) {
          const namesToPin: string[] = [];
          oldIds.forEach(id => {
            const c = customers.find(cust => cust.id === id);
            if (c) namesToPin.push(c.name);
          });
          if (namesToPin.length > 0) {
            setPinnedCustomerNames(prev => {
              const updated = Array.from(new Set([...prev, ...namesToPin]));
              localStorage.setItem('pinned_customers_names', JSON.stringify(updated));
              return updated;
            });
          }
          localStorage.removeItem('pinned_customers');
        }
      }
    } catch (e) {
      // ignore
    }
  }, [customers]);

  // Disable background scrolling when any modal popup is active
  React.useEffect(() => {
    if (
      deletingCustomer ||
      editingTx ||
      deletingTx ||
      duplicateTxWarning ||
      phoneWarningCustomer ||
      pinActionCustomer ||
      receiptResult ||
      isManageStatementsOpen ||
      pendingContactChoice
    ) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [
    deletingCustomer,
    editingTx,
    deletingTx,
    duplicateTxWarning,
    phoneWarningCustomer,
    pinActionCustomer,
    receiptResult,
    isManageStatementsOpen,
    pendingContactChoice
  ]);

   // Handle history for modals (mobile back gesture)
  React.useEffect(() => {
    const handlePopState = () => {
      // Close edit mode first (one back press = exit edit)
      if (isEditingCustomer) {
        // Capture scroll position before React re-render to prevent unwanted scroll
        const savedScrollY = window.scrollY;
        setIsEditingCustomer(false);
        // Restore scroll position after the DOM settles from the state change
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo({ top: savedScrollY, behavior: 'instant' });
          });
        });
        return;
      }
      if (isManageStatementsOpen) {
        setIsManageStatementsOpen(false);
        return;
      }
      if (receiptResult && window.history.state?.modal !== 'receiptPreview') {
        setReceiptResult(null);
        return;
      }
      if (editingTx && window.history.state?.modal !== 'editTx') {
        setEditingTx(null);
      }
      if (deletingTx && window.history.state?.modal !== 'deleteTx') {
        setDeletingTx(null);
      }
      if (deletingCustomer && window.history.state?.modal !== 'deleteCustomer') {
        setDeletingCustomer(null);
      }
      if (duplicateTxWarning) {
        setDuplicateTxWarning(null);
      }
      if (pinActionCustomer && window.history.state?.modal !== 'pinActionCustomer') {
        setPinActionCustomer(null);
      }
      if (phoneWarningCustomer && window.history.state?.modal !== 'phoneWarningCustomer') {
        setPhoneWarningCustomer(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isEditingCustomer, isManageStatementsOpen, editingTx, deletingTx, deletingCustomer, duplicateTxWarning, pinActionCustomer, phoneWarningCustomer, receiptResult]);

  const [recentlyEditedTxId, setRecentlyEditedTxId] = useState<string | null>(null);

  // Smooth scroll and highlight effect for target transaction
  React.useEffect(() => {
    if (highlightedTxId) {
      // Delay scroll slightly so DOM settles after navigation (especially needed in PWA standalone mode)
      const scrollTimer = setTimeout(() => {
        const element = document.getElementById(`tx-row-${highlightedTxId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 120);
      const highlightTimer = setTimeout(() => {
        if (setHighlightedTxId) {
          setHighlightedTxId(null);
        }
      }, 3120);
      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(highlightTimer);
      };
    }
  }, [highlightedTxId, selectedCustomerId]);

  const parseTxDate = (d: any): Date => {
    if (!d) return new Date();
    if (d instanceof Date) return d;
    if (typeof d.toDate === 'function') return d.toDate();
    if (d.seconds !== undefined) return new Date(d.seconds * 1000);
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const getDuplicate = (actionType: 'due' | 'payment', amountStr: string) => {
    if (!selectedCustomerId || !amountStr) return null;
    const cleaned = amountStr.replace(/,/g, '');
    const amountVal = parseFloat(cleaned);
    if (isNaN(amountVal) || amountVal <= 0) return null;

    let customerTxs = transactions.filter(t => t.customerId === selectedCustomerId);
    if (customerTxs.length === 0 && typeof localStorage !== 'undefined') {
      try {
        const userId = customers.find(c => c.id === selectedCustomerId)?.userId;
        if (userId) {
          const cached = localStorage.getItem(`easy_due_txs_${userId}_${selectedCustomerId}`);
          if (cached) {
            customerTxs = JSON.parse(cached);
          }
        }
      } catch (e) {}
    }

    const now = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    return customerTxs.find(t => {
      const tDate = parseTxDate(t.createdAt || t.date);
      return t.type === actionType && 
             Math.abs(t.amount - amountVal) < 0.01 && 
             (now - tDate.getTime()) < twentyFourHoursMs;
    }) || null;
  };

 const openEditTxModal = (tx: Transaction) => {
   setEditingTx(tx);
   setEditTxAmount(tx.amount.toString());
   setEditTxDesc(tx.description || '');
   window.history.pushState({ ...window.history.state, modal: 'editTx' }, '');
 };

 const openDeleteTxModal = (tx: Transaction) => {
   setDeletingTx(tx);
   window.history.pushState({ ...window.history.state, modal: 'deleteTx' }, '');
 };

 const closeTxModals = () => {
    setEditingTx(null);
    setDeletingTx(null);
    if (window.history.state?.modal === 'editTx' || window.history.state?.modal === 'deleteTx') {
      window.history.back(); // This triggers popstate, which sets states to null
    }
  };

  const closePinActionModal = () => {
    setPinActionCustomer(null);
    if (window.history.state?.modal === 'pinActionCustomer') {
      window.history.back();
    }
  };

  const closeDeleteCustomerModal = () => {
    setDeletingCustomer(null);
    if (window.history.state?.modal === 'deleteCustomer') {
      window.history.back();
    }
  };

  const closePhoneWarningModal = () => {
    setPhoneWarningCustomer(null);
    if (window.history.state?.modal === 'phoneWarningCustomer') {
      window.history.back();
    }
  };

  const closeReceiptModal = () => {
    setReceiptResult(null);
    if (window.history.state?.modal === 'receiptPreview') {
      window.history.back();
    }
  };


  const pinnedCustomerNameSet = useMemo(() => new Set(pinnedCustomerNames), [pinnedCustomerNames]);

  // Filter & sort customers list (with O(1) Set/Map lookups and hoisted query normalization)
  const filteredCustomers = useMemo(() => {
    const trimmedQuery = searchQuery.trim();
    const lowerQuery = trimmedQuery.toLowerCase();

    // 1. Filter customers
    const filtered = customers.filter(c => {
      if (trimmedQuery) {
        const queryMatch =
          c.name.toLowerCase().includes(lowerQuery) ||
          c.phone.includes(trimmedQuery) ||
          (searchBanglaInEnglish && matchesPhonetic(c.name, trimmedQuery));
        if (!queryMatch) return false;
      }

      if (filterStatus === 'due') return c.outstandingDue > 0;
      if (filterStatus === 'settled') return c.outstandingDue === 0;
      if (filterStatus === 'overpaid') return c.outstandingDue < 0;
      return true;
    });

    const customOrderMap =
      sortBy === 'custom'
        ? new Map<string, number>(customOrder.map((id, idx) => [id, idx]))
        : null;

    // 2. Sort customers
    filtered.sort((a, b) => {
      const aPinned = pinnedCustomerNameSet.has(a.name);
      const bPinned = pinnedCustomerNameSet.has(b.name);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      if (sortBy === 'custom' && customOrderMap) {
        const idxA = customOrderMap.get(a.id) ?? 999999;
        const idxB = customOrderMap.get(b.id) ?? 999999;
        if (idxA !== idxB) return idxA - idxB;
      }
      if (sortBy === 'high_balance') {
        return b.outstandingDue - a.outstandingDue;
      }
      if (sortBy === 'low_balance') {
        return a.outstandingDue - b.outstandingDue;
      }
      
      // Default: 'recent' — last activity (payment, due, profile edit)
      const getRecency = (c: typeof a) => {
        const d = c.updatedAt ?? c.createdAt;
        return d ? parseFirestoreDate(d).getTime() : 0;
      };
      return getRecency(b) - getRecency(a);
    });

    return filtered;
  }, [customers, searchQuery, filterStatus, sortBy, pinnedCustomerNameSet, customOrder, searchBanglaInEnglish]);

 // Selected customer object & transactions
 const selectedCustomer = useMemo(() => {
 if (!selectedCustomerId) return null;
 return customers.find(c => c.id === selectedCustomerId) || null;
 }, [customers, selectedCustomerId]);

 const selectedCustomerTransactions = useMemo(() => {
    if (!selectedCustomerId) return [];
    return transactions.filter(t => t.customerId === selectedCustomerId);
  }, [transactions, selectedCustomerId]);

  const selectedCustomerMetrics = useMemo(() => {
    if (!selectedCustomer) return { totalBilled: 0, totalPaid: 0, lifetimeVolume: 0, txCount: 0 };
    const txs = selectedCustomerTransactions;
    const totalBilled = txs.filter(t => t.type === 'due').reduce((s, t) => s + t.amount, 0);
    const totalPaid = txs.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0);
    return {
      totalBilled,
      totalPaid,
      lifetimeVolume: totalBilled + totalPaid,
      txCount: txs.length
    };
  }, [selectedCustomer, selectedCustomerTransactions]);

  const handleAutoCreateAndOpenCustomer = async (customerName: string, phone: string) => {
    const trimmedName = customerName.trim() || phone;
    const rawBillingDay = parseInt(newBillingDay, 10);
    if (newAccountType === 'credit_card' && (!rawBillingDay || rawBillingDay < 1 || rawBillingDay > 31)) {
      setFormError(
        lang === 'bn'
          ? 'অনুগ্রহ করে কার্ডের বিলিং তারিখ দিন (১-৩১)'
          : 'Please enter a statement billing day (1–31)'
      );
      return;
    }
    const parsedBillingDay = rawBillingDay ? Math.min(31, Math.max(1, rawBillingDay)) : undefined;
    setIsCreatingCustomer(true);
    setFormError('');
    try {
      const [newId] = await Promise.all([
        createCustomer(trimmedName, phone, {
          accountType: newAccountType,
          billingDay: newAccountType === 'credit_card' ? parsedBillingDay : undefined
        }),
        new Promise(resolve => setTimeout(resolve, 300))
      ]);
      if (newId) {
        setNewName('');
        setNewPhone('');
        setNewAccountType('standard');
        setNewBillingDay('');
        setShowAddForm(false);
        setSelectedCustomerId(newId as string);
        triggerHaptic('single');
        toast.success(
          lang === 'bn'
            ? `"${trimmedName}"-এর হিসাব তৈরি ও খোলা হয়েছে`
            : `Account for "${trimmedName}" created & opened`
        );
      }
    } catch (err: any) {
      if (err?.message === 'DUPLICATE_NAME') {
        toast.error(
          lang === 'bn'
            ? 'এই নামের গ্রাহক ইতিমধ্যে খতিয়ানে সংরক্ষিত আছে।'
            : 'A customer with this name already exists.'
        );
      } else {
        toast.error(
          lang === 'bn'
            ? 'অ্যাকাউন্ট সংরক্ষণ করা সম্ভব হয়নি। পুনরায় চেষ্টা করুন।'
            : 'Failed to create customer account. Please try again.'
        );
      }
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const handlePickContact = async (
    onPickPhone: (phone: string) => void, 
    onPickName?: (name: string) => void,
    isNewAccount: boolean = false
  ) => {
    triggerHaptic('soft');
    if (typeof navigator !== 'undefined' && 'contacts' in navigator && (navigator as any).contacts?.select) {
      try {
        const props = ['name', 'tel'];
        const options = { multiple: false };
        const contacts = await (navigator as any).contacts.select(props, options);
        if (contacts && contacts.length > 0) {
          // Strictly limit to single contact
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

          // If coming from "New account details", always open the custom confirmation/number picker modal
          if (isNewAccount) {
            triggerHaptic('single');
            const initialName = (newName.trim() || rawName || '').trim();
            setPendingContactChoice({
              contactName: initialName,
              numbers: cleanedNumbers,
              isNewAccount: true,
              onSelect: async (chosenNumber: string, finalName?: string) => {
                const targetName = (finalName || initialName || chosenNumber).trim();
                await handleAutoCreateAndOpenCustomer(targetName, chosenNumber);
              }
            });
            return;
          }

          // If contact has multiple numbers (for existing customer edit/view)
          if (cleanedNumbers.length > 1) {
            triggerHaptic('single');
            setPendingContactChoice({
              contactName: rawName,
              numbers: cleanedNumbers,
              isNewAccount: false,
              onSelect: (chosen: string, finalName?: string) => {
                onPickPhone(chosen);
                if (onPickName && (finalName || rawName)) onPickName(finalName || rawName);
                toast.success(lang === 'bn' ? 'নম্বর সফলভাবে নেওয়া হয়েছে' : 'Contact number selected');
              }
            });
            return;
          }

          // Exactly one number: set directly
          const singleNumber = cleanedNumbers[0];
          onPickPhone(singleNumber);
          if (onPickName && rawName) {
            onPickName(rawName);
          }
          triggerHaptic('single');
          toast.success(lang === 'bn' ? 'নম্বর সফলভাবে নেওয়া হয়েছে' : 'Contact number selected');
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.warn("Contact picker failed:", err);
        }
      }
    } else {
      triggerHaptic('double');
      toast.info(lang === 'bn' 
        ? 'কন্টাক্ট পিকারটি শুধুমাত্র মোবাইল ডিভাইসের সমর্থিত ব্রাউজারে উপলব্ধ।' 
        : 'Contact picker is supported on mobile browsers (like Chrome on Android).');
    }
  };

  const handleGenerateReceiptImage = async () => {
    if (!selectedCustomer) return;
    setIsGeneratingReceipt(true);
    triggerHaptic('single');

    try {
      const currentTheme = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light';
      const result = await generateReceiptPng(
        selectedCustomer,
        selectedCustomerTransactions,
        lang,
        currentTheme
      );
      setReceiptResult(result);
      try {
        window.history.pushState({ ...window.history.state, modal: 'receiptPreview' }, '');
      } catch {
        // history navigation fallback
      }
    } catch (err: any) {
      console.error('Receipt generation error:', err);
      const errMsg = err?.message || String(err);
      toast.error(lang === 'bn' ? `রসিদ তৈরিতে ত্রুটি: ${errMsg}` : `Failed to generate receipt: ${errMsg}`);
    } finally {
      setIsGeneratingReceipt(false);
    }
  };

  // Credit Card Billing Cycle Metrics: Unbilled (This Month) vs Billed (Last Month) with Unpaid Carry-Over
  const creditCardCycleData = useMemo(() => {
    if (!selectedCustomer || selectedCustomer.accountType !== 'credit_card') return null;

    const billingDay = Math.min(31, Math.max(1, selectedCustomer.billingDay || 15));
    const getCycleBoundary = (year: number, monthIndex: number, day: number) => {
      const firstOfTarget = new Date(year, monthIndex, 1, 0, 0, 0, 0);
      const maxDays = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0).getDate();
      return new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), Math.min(day, maxDays), 0, 0, 0, 0);
    };

    const now = new Date();
    const thisMonthCutoff = getCycleBoundary(now.getFullYear(), now.getMonth(), billingDay);

    let lastStatementDate: Date;
    let prevStatementDate: Date;
    let nextStatementDate: Date;

    if (now.getTime() >= thisMonthCutoff.getTime()) {
      lastStatementDate = thisMonthCutoff;
      prevStatementDate = getCycleBoundary(now.getFullYear(), now.getMonth() - 1, billingDay);
      nextStatementDate = getCycleBoundary(now.getFullYear(), now.getMonth() + 1, billingDay);
    } else {
      lastStatementDate = getCycleBoundary(now.getFullYear(), now.getMonth() - 1, billingDay);
      prevStatementDate = getCycleBoundary(now.getFullYear(), now.getMonth() - 2, billingDay);
      nextStatementDate = thisMonthCutoff;
    }

    const lastCutoffMs = lastStatementDate.getTime();
    const prevCutoffMs = prevStatementDate.getTime();

    const unbilledTxs: Transaction[] = [];
    const billedTxs: Transaction[] = [];

    selectedCustomerTransactions.forEach((tx) => {
      const txMs = parseFirestoreDate(tx.date).getTime();
      if (txMs >= lastCutoffMs) {
        unbilledTxs.push(tx);
      } else if (txMs >= prevCutoffMs && txMs < lastCutoffMs) {
        billedTxs.push(tx);
      }
    });

    const thisMonthSpend = unbilledTxs
      .filter((t) => t.type === 'due')
      .reduce((s, t) => s + t.amount, 0);
    const paymentsSinceCutoff = unbilledTxs
      .filter((t) => t.type === 'payment')
      .reduce((s, t) => s + t.amount, 0);

    const lastMonthCycleSpend = billedTxs
      .filter((t) => t.type === 'due')
      .reduce((s, t) => s + t.amount, 0);
    const lastMonthCyclePayments = billedTxs
      .filter((t) => t.type === 'payment')
      .reduce((s, t) => s + t.amount, 0);

    // Exact statement balance at the moment the last statement closed (includes any older unpaid balance carried into it)
    const rawStatementAtCutoff = selectedCustomer.outstandingDue - thisMonthSpend + paymentsSinceCutoff;
    const billedStatementAmount = Math.max(0, rawStatementAtCutoff);

    // Payments made since cutoff pay down the Billed (Last Month) statement first; any excess reduces Unbilled (This Month)
    const paidTowardBilled = Math.min(billedStatementAmount, paymentsSinceCutoff);
    const unpaidCarryOver = Math.max(0, billedStatementAmount - paymentsSinceCutoff);
    const excessPaymentOnUnbilled = Math.max(0, paymentsSinceCutoff - billedStatementAmount);

    const netUnbilledThisMonth = Math.max(0, thisMonthSpend - excessPaymentOnUnbilled);
    const totalPayableWithCarryOver = Math.max(0, selectedCustomer.outstandingDue);

    // Prior unpaid balance from before prevStatementDate that carried into Last Month's statement
    const priorCarryIntoLastMonth = Math.max(
      0,
      billedStatementAmount - lastMonthCycleSpend + lastMonthCyclePayments
    );

    const daysUntilNextStatement = Math.max(
      1,
      Math.ceil((nextStatementDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    const lastMonthEndDisplay = new Date(lastStatementDate.getTime() - 24 * 60 * 60 * 1000);
    const thisMonthEndDisplay = new Date(nextStatementDate.getTime() - 24 * 60 * 60 * 1000);

    return {
      billingDay,
      lastStatementDate,
      prevStatementDate,
      nextStatementDate,
      lastMonthEndDisplay,
      thisMonthEndDisplay,
      daysUntilNextStatement,
      unbilledTxs,
      billedTxs,
      thisMonthSpend,
      paymentsSinceCutoff,
      lastMonthCycleSpend,
      lastMonthCyclePayments,
      billedStatementAmount,
      paidTowardBilled,
      unpaidCarryOver,
      netUnbilledThisMonth,
      totalPayableWithCarryOver,
      priorCarryIntoLastMonth
    };
  }, [selectedCustomer, selectedCustomerTransactions]);

  const groupedTransactions = useMemo(() => {
    const sourceTxs =
      selectedCustomer?.accountType === 'credit_card' && creditCardCycleData
        ? cardCycleTab === 'unbilled'
          ? creditCardCycleData.unbilledTxs
          : creditCardCycleData.billedTxs
        : selectedCustomerTransactions;

    const groups: Record<string, Transaction[]> = {};
    sourceTxs.forEach(tx => {
      const d = parseFirestoreDate(tx.date);
      const dateStr = d.toDateString(); // e.g. "Mon Jun 22 2026"
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(tx);
    });

    return Object.keys(groups)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map(dateStr => ({
        dateStr,
        dateObj: new Date(dateStr),
        items: groups[dateStr].sort((a: Transaction, b: Transaction) => {
          const tA = parseFirestoreDate(a.date).getTime();
          const tB = parseFirestoreDate(b.date).getTime();
          return tB - tA;
        })
      }));
  }, [selectedCustomer, selectedCustomerTransactions, creditCardCycleData, cardCycleTab]);

 const handleCreateCustomer = async (e: React.FormEvent) => {
 e.preventDefault();
 setFormError('');

 if (!newName.trim()) {
 setFormError(
   newAccountType === 'credit_card'
     ? (lang === 'bn' ? 'অনুগ্রহ করে কার্ড বা হিসাবের নাম লিখুন' : 'Please enter a credit card or account name')
     : (lang === 'bn' ? 'অনুগ্রহ করে গ্রাহকের নাম লিখুন' : 'Please enter a customer name')
 );
 return;
 }

 const rawBillingDay = parseInt(newBillingDay, 10);
 if (newAccountType === 'credit_card' && (!rawBillingDay || rawBillingDay < 1 || rawBillingDay > 31)) {
   setFormError(
     lang === 'bn'
       ? 'অনুগ্রহ করে কার্ডের বিলিং তারিখ লিখুন (১ থেকে ৩১ এর মধ্যে)'
       : 'Please enter a statement billing day between 1 and 31'
   );
   return;
 }
 const parsedBillingDay = rawBillingDay ? Math.min(31, Math.max(1, rawBillingDay)) : undefined;

 setIsCreatingCustomer(true);
 try {
 const [newId] = await Promise.all([
 createCustomer(newName, newPhone, {
   accountType: newAccountType,
   billingDay: newAccountType === 'credit_card' ? parsedBillingDay : undefined
 }),
 new Promise(resolve => setTimeout(resolve, 600))
 ]);
 if (newId) {
 setNewName('');
 setNewPhone('');
 setNewAccountType('standard');
 setNewBillingDay('');
 setShowAddForm(false);
 setSelectedCustomerId(newId as string); // open their profile immediately!
 toast.success(
   newAccountType === 'credit_card'
     ? (lang === 'bn' ? 'ক্রেডিট কার্ড হিসাব তৈরি সম্পন্ন হয়েছে' : 'Credit card ledger created successfully')
     : (lang === 'bn' ? 'গ্রাহক তৈরি সম্পন্ন হয়েছে' : 'Customer created successfully')
 );
 }
 } catch (err: any) {
 if (err.message === 'DUPLICATE_NAME') {
 setFormError(lang === 'bn' ? 'এই নামের হিসাব ইতিমধ্যে খতিয়ানে সংরক্ষিত আছে।' : 'An account with this name already exists.');
 } else {
 setFormError(lang === 'bn' ? 'অ্যাকাউন্ট সংরক্ষণ করা সম্ভব হয়নি। পুনরায় চেষ্টা করুন।' : 'Failed to save account. Try again.');
 }
 } finally {
 setIsCreatingCustomer(false);
 }
 };

   const handleAddInlineTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeInlineTransaction(false);
  };

  const executeInlineTransaction = async (bypassDuplicateCheck = false) => {
    if (!selectedCustomerId || !openActionType) return;
    const cleaned = actionAmount.replace(/,/g, '');
    const amountVal = parseFloat(cleaned);
    if (!amountVal || amountVal <= 0) return;

    if (!bypassDuplicateCheck && !hasShownDuplicateWarning) {
      const duplicate = getDuplicate(openActionType, actionAmount);
      if (duplicate) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setDuplicateTxWarning(duplicate);
        return;
      }
    }

    // If adding a bill into Last Month's Billed cycle on a Credit Card ledger, timestamp it at the end of last month's cycle
    let txDate = new Date();
    if (
      selectedCustomer?.accountType === 'credit_card' &&
      openActionType === 'due' &&
      actionTargetCycle === 'billed' &&
      creditCardCycleData
    ) {
      txDate = new Date(creditCardCycleData.lastStatementDate.getTime() - 12 * 60 * 60 * 1000);
    }

    setTxSubmitting(true);
    try {
      await Promise.all([
        addTransaction(selectedCustomerId, openActionType, amountVal, actionDesc, txDate),
        new Promise(resolve => setTimeout(resolve, 600))
      ]);
      setActionAmount('');
      setActionDesc('');
      setActionTargetCycle('unbilled');
      setOpenActionType(null);
      setDuplicateTxWarning(null);
      setHasShownDuplicateWarning(false);
      toast.success(lang === 'bn' ? 'হিসাব সফলভাবে যোগ হয়েছে' : 'Transaction added successfully');
    } catch (err) {
      console.error(err);
    } finally {
      setTxSubmitting(false);
    }
  };

  const handleDelete = (c: Customer) => {
    window.history.pushState({ ...window.history.state, modal: 'deleteCustomer' }, '');
    setDeletingCustomer(c);
  };

 // Generate message text based on selected template index
  const getMessageText = (c: Customer, templateIdx: number) => {
    if (lang === 'bn') {
      if (templateIdx === 1) {
        return `আসসালামু আলাইকুম ${c.name}। আপনার কাছে আমাদের বকেয়া পাওনা ৳${formatNumber(c.outstandingDue, 'bn')}। সম্ভব হলে অনুগ্রহ করে দ্রুত পরিশোধ করুন। ধন্যবাদ!`;
      } else if (templateIdx === 2) {
        return `আসসালামু আলাইকুম ${c.name}। আশা করি ভালো আছেন। আপনার বকেয়া হিসাব ৳${formatNumber(c.outstandingDue, 'bn')} পরিশোধ বা সমন্বয় করার অনুরোধ রইল। ধন্যবাদ!`;
      } else {
        return `প্রিয় ${c.name}। আপনার মোট বকেয়া পাওনা ৳${formatNumber(c.outstandingDue, 'bn')}। অনুগ্রহ করে দ্রুত পরিশোধ করার জন্য অনুরোধ করা হলো। ধন্যবাদ!`;
      }
    } else {
      if (templateIdx === 1) {
        return `Hi ${c.name}, a friendly reminder that your outstanding balance is ৳${formatNumber(c.outstandingDue, 'en')}. Please clear it at your earliest convenience. Thanks!`;
      } else if (templateIdx === 2) {
        return `Hi ${c.name}, hope you are doing well. According to our ledger, your outstanding due is ৳${formatNumber(c.outstandingDue, 'en')}. Kindly settle this balance. Thanks!`;
      } else {
        return `Dear ${c.name}, your total outstanding due is ৳${formatNumber(c.outstandingDue, 'en')}. We request you to clear it as soon as possible. Thank you!`;
      }
    }
  };

 // Generate customized shareable WhatsApp link
 const getShareLink = (c: Customer, format: 'whatsapp' | 'sms') => {
 const text = getMessageText(c, selectedTemplate);
 const encodedText = encodeURIComponent(text);
 if (format === 'whatsapp') {
 let phoneNum = c.phone ? c.phone.replace(/[^0-9]/g, '') : '';
 if (phoneNum.startsWith('01')) phoneNum = '88' + phoneNum;
 return `https://wa.me/${phoneNum}?text=${encodedText}`;
 }
 return `sms:${c.phone}?body=${encodedText}`;
 };



 return (
 <div className="space-y-6 no-select">
 
 {/* 1. LIST VIEW OF ALL CUSTOMERS */}
      {!selectedCustomer ? (
        <div className="space-y-5">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-950 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center font-bold text-xs shadow-xs">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-950 dark:text-white tracking-tight">
                  {t.customerAccounts}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {lang === 'bn' ? `${formatNumber(customers.length, lang)} জন সংরক্ষিত গ্রাহক প্রোফাইল` : `${formatNumber(customers.length, lang)} customer profiles on ledger`}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                triggerHaptic('single');
                setShowAddForm(!showAddForm);
              }}
              className="px-4 py-2 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer text-xs sm:text-sm active:scale-[0.98] shadow-xs"
              id="add_customer_btn"
            >
              <UserPlus className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>{t.createAccount}</span>
            </button>
          </div>

          {/* Form to add new customer */}
          <AnimatePresence>
            {showAddForm && (
              <motion.form 
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={handleCreateCustomer}
                className="bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-slate-800/80 p-5 sm:p-6 rounded-xl shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
                  <div className="text-xs font-mono uppercase tracking-[0.14em] font-bold text-slate-500 dark:text-slate-400">
                    {t.newAccountDetails}
                  </div>
                  <button 
                    type="button" 
                    onClick={() => {
                      triggerHaptic('medium');
                      setShowAddForm(false);
                    }}
                    className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white rounded-lg text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Account Type Selector: Standard Ledger vs Credit Card / Bill Tracker */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold block">
                    {lang === 'bn' ? 'হিসাবের ধরন নির্বাচন করুন' : 'Account Perspective / Type'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('single');
                        setNewAccountType('standard');
                      }}
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex items-start gap-3 ${
                        newAccountType === 'standard'
                          ? 'bg-slate-950 text-white border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 dark:bg-[#0D121D] dark:hover:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        newAccountType === 'standard'
                          ? 'bg-white/15 dark:bg-slate-950/15'
                          : 'bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-extrabold leading-tight">
                          {lang === 'bn' ? 'সাধারণ গ্রাহক খতিয়ান' : 'Standard Customer Ledger'}
                        </div>
                        <p className={`text-[11px] mt-0.5 leading-snug ${
                          newAccountType === 'standard' ? 'opacity-85 font-medium' : 'text-slate-500 dark:text-slate-400'
                        }`}>
                          {lang === 'bn' ? 'বাকি প্রদান ও পেমেন্ট আদায়' : 'Give Due & Got Payment'}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('single');
                        setNewAccountType('credit_card');
                      }}
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex items-start gap-3 ${
                        newAccountType === 'credit_card'
                          ? 'bg-slate-950 text-white border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 dark:bg-[#0D121D] dark:hover:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        newAccountType === 'credit_card'
                          ? 'bg-white/15 dark:bg-slate-950/15'
                          : 'bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-extrabold leading-tight">
                          {lang === 'bn' ? 'ক্রেডিট কার্ড / বিল ট্র্যাকার' : 'Credit Card / Bill Tracker'}
                        </div>
                        <p className={`text-[11px] mt-0.5 leading-snug ${
                          newAccountType === 'credit_card' ? 'opacity-85 font-medium' : 'text-slate-500 dark:text-slate-400'
                        }`}>
                          {lang === 'bn' ? 'কার্ড খরচ, বিলিং তারিখ ও মাসিক হিসাব' : 'Add Card Bills, Pay Bill & Monthly Cycle'}
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                      {newAccountType === 'credit_card'
                        ? (lang === 'bn' ? 'কার্ড / হিসাবের নাম' : 'Card / Account Name')
                        : t.customerName}
                    </label>
                    <input
                      type="text"
                      placeholder={newAccountType === 'credit_card' ? (lang === 'bn' ? 'যেমন: সিটি ব্যাংক অ্যামেক্স' : 'e.g. City Bank Amex') : 'e.g. Wahid Zaman'}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0D121D] border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white text-sm focus:outline-none focus:border-slate-950 dark:focus:border-white font-medium transition-colors"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">{t.phoneNumber}</label>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        placeholder={t.phoneSmsNotice}
                        value={newPhone}
                        onChange={(e) => setNewPhone(cleanBangladeshiPhone(e.target.value))}
                        className="flex-1 px-3.5 py-2.5 bg-white dark:bg-[#0D121D] border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white text-sm focus:outline-none focus:border-slate-950 dark:focus:border-white font-mono transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => handlePickContact(setNewPhone, (name) => { if (!newName.trim()) setNewName(name); }, true)}
                        className="px-3 bg-white hover:bg-slate-50 dark:bg-[#0D121D] dark:hover:bg-slate-800 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0 font-bold text-xs"
                        title={lang === 'bn' ? 'কন্টাক্ট নির্বাচন করুন' : 'Pick Contact'}
                      >
                        <BookUser className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                        <span className="hidden sm:inline">{lang === 'bn' ? 'কন্টাক্ট' : 'Contacts'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Billing Date Input for Credit Card Accounts (User-decided, no auto-picked presets) */}
                {newAccountType === 'credit_card' && (
                  <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <label className="text-[11px] font-mono uppercase tracking-wider text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                          <span>{lang === 'bn' ? 'স্টেটমেন্ট বিলিং তারিখ (১-৩১)' : 'Statement Billing Day (1–31)'}</span>
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {lang === 'bn'
                            ? 'মাসের কোন তারিখে কার্ডের বিল তৈরি হয় তা লিখুন (যেমন: ১৫)'
                            : 'Enter the day of the month your statement generates (1–31)'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
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
                            const num = Math.min(31, Math.max(1, parseInt(clean, 10)));
                            setNewBillingDay(String(num));
                          }}
                          className="w-20 px-3 py-2 text-center bg-white dark:bg-[#0D121D] border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white font-mono font-black text-sm focus:outline-none focus:border-slate-950 dark:focus:border-white placeholder:text-slate-400 placeholder:font-normal"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formError && (
                  <div className="text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200/40 dark:border-rose-900/40">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg text-xs cursor-pointer transition-colors"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingCustomer}
                    className="px-5 py-2 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold rounded-lg text-xs disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    {isCreatingCustomer ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin -ml-1 h-3.5 w-3.5 text-current" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t.saving || (lang === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...')}
                      </span>
                    ) : (
                      t.saveAndOpen
                    )}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Search bar with distinctive bold border */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-3 bg-white dark:bg-[#0D121D] border-2 border-slate-300 dark:border-slate-700 focus:border-slate-950 dark:focus:border-white rounded-2xl text-slate-950 dark:text-white text-sm focus:outline-none font-medium placeholder:text-slate-400 transition-colors shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('tick');
                  setSearchQuery('');
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-950 dark:hover:text-white transition-colors cursor-pointer"
                title={lang === 'bn' ? 'খালি করুন' : 'Clear search'}
              >
                <Delete className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Client Status Filter Chips (Left) & Sort Dropdown (Right) */}
          <div className="flex items-center justify-between gap-2 relative select-none z-10 pt-1">
            {/* Minimalist Oblong Pill Filter Indicators (Press & Slide or Tap) */}
            <div
              ref={filterPillsContainerRef}
              onPointerDown={(e) => {
                isSlidingFilterRef.current = true;
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
                selectFilterPillAtClientX(e.clientX, true);
              }}
              onPointerMove={(e) => {
                if (!isSlidingFilterRef.current) return;
                selectFilterPillAtClientX(e.clientX, false);
              }}
              onPointerUp={(e) => {
                isSlidingFilterRef.current = false;
                try {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                } catch {}
              }}
              onPointerCancel={() => {
                isSlidingFilterRef.current = false;
              }}
              onLostPointerCapture={() => {
                isSlidingFilterRef.current = false;
              }}
              className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-1 touch-none select-none"
            >
              {([
                { id: 'all', title: lang === 'bn' ? 'সব গ্রাহক' : 'All Customers' },
                { id: 'due', title: lang === 'bn' ? 'বাকি' : 'Due Customers' },
                { id: 'settled', title: lang === 'bn' ? 'পরিশোধিত' : 'Settled Customers' },
                { id: 'overpaid', title: lang === 'bn' ? 'অগ্রিম জমা' : 'Advance / Overpaid' },
              ] as const).map((tab) => {
                const isActive = filterStatus === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    data-filter-pill={tab.id}
                    title={tab.title}
                    aria-label={tab.title}
                    onClick={() => {
                      if (filterStatus !== tab.id) {
                        triggerHaptic('single');
                        setFilterStatus(tab.id);
                      }
                    }}
                    className={`w-7 h-3.5 rounded-full border-2 transition-all cursor-pointer shrink-0 active:scale-95 ${
                      isActive
                        ? 'bg-slate-950 border-slate-950 dark:bg-white dark:border-white shadow-2xs'
                        : 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/40 border-slate-300 dark:border-slate-700/80 hover:border-slate-900 dark:hover:border-slate-500'
                    }`}
                  />
                );
              })}
            </div>

            {/* Sort Button on Right (Less border-radius rounded-xl, slightly smaller px-3 py-1.5, same text) */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('single');
                  setIsSortOpen(!isSortOpen);
                }}
                className="px-3 py-1.5 rounded-xl font-bold text-xs border-2 border-slate-300 dark:border-slate-700/80 hover:border-slate-900 dark:hover:border-white bg-white hover:bg-slate-50 dark:bg-[#161a22] dark:hover:bg-slate-800 text-slate-900 dark:text-white flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs active:scale-95"
              >
                <ArrowUpDown className="w-3.5 h-3.5 stroke-[2.2]" />
                <span>{lang === 'bn' ? 'সাজান' : 'Sort'}</span>
              </button>

              {/* Sort options Dropdown overlay */}
              {isSortOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsSortOpen(false)} 
                  />
                  <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-[#0D121D] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-1.5 space-y-0.5 animate-reveal">
                    {(['recent', 'high_balance', 'low_balance'] as const).map((option) => {
                       const label = option === 'recent'
                          ? (lang === 'bn' ? 'সাম্প্রতিক' : 'Recent')
                          : option === 'high_balance'
                            ? (lang === 'bn' ? 'বেশি বাকি' : 'High Balance')
                            : (lang === 'bn' ? 'কম বাকি' : 'Low Balance');
                       return (
                         <button
                           key={option}
                           type="button"
                           onClick={() => {
                             triggerHaptic('single');
                             setSortBy(option);
                             setIsSortOpen(false);
                           }}
                           className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                             sortBy === option 
                               ? 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white' 
                               : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                           }`}
                         >
                           <span>{label}</span>
                           {sortBy === option && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 stroke-[3]" />}
                         </button>
                       );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Customer list database with distinctive bold borders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {filteredCustomers.map(c => {
              const initials = c.name
                .split(' ')
                .map(n => n[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'C';

              const isDue = c.outstandingDue > 0;
              const isOverpaid = c.outstandingDue < 0;

              return (
                <SwipeableCustomerItem
                  key={c.id}
                  customer={c}
                  lang={lang}
                  isSelected={selectedCustomerId === c.id}
                  swipeGesturesEnabled={swipeGesturesEnabled}
                  isDeleting={deletingCustomer?.id === c.id}
                  onWhatsApp={() => {
                    if (!c.phone || !c.phone.trim()) {
                      triggerHaptic('double');
                      window.history.pushState({ ...window.history.state, modal: 'phoneWarningCustomer' }, '');
                      setPhoneWarningCustomer(c);
                    } else {
                      triggerHaptic('single');
                      window.open(getShareLink(c, 'whatsapp'), '_blank');
                    }
                  }}
                  onDelete={() => {
                    triggerHaptic('double');
                    handleDelete(c);
                  }}
                  onClick={() => {}}
                  activeSwipingId={activeSwipingId}
                  setActiveSwipingId={setActiveSwipingId}
                >
                  <div
                    onClick={() => {
                      setSelectedCustomerId(selectedCustomerId === c.id ? null : c.id);
                    }}
                    className={`bg-white dark:bg-[#0D121D] hover:bg-slate-50/90 dark:hover:bg-slate-900/60 border-2 p-4 sm:p-5 pb-3 sm:pb-3.5 rounded-2xl transition-all cursor-pointer flex flex-col justify-between gap-3 group shadow-xs ${
                      selectedCustomerId === c.id 
                        ? 'border-slate-950 dark:border-white ring-2 ring-slate-950/20 dark:ring-white/20' 
                        : 'border-slate-300 dark:border-slate-700 hover:border-slate-950 dark:hover:border-slate-200'
                    }`}
                  >
                    {/* Top Row: Avatar + Name & Phone + Balance */}
                    <div className="flex items-center justify-between gap-3">
                      {/* Left: Initials + Name */}
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border-2 ${
                          isDue 
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-300 dark:border-rose-900' 
                            : isOverpaid 
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300 dark:border-emerald-900'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                        }`}>
                          {initials}
                        </div>

                        <div className="min-w-0">
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic('single');
                              window.history.pushState({ ...window.history.state, modal: 'pinActionCustomer' }, '');
                              setPinActionCustomer(c);
                            }}
                            className="text-sm sm:text-base font-extrabold text-slate-950 dark:text-white truncate flex items-center gap-1.5 cursor-pointer group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors"
                          >
                            <span className="truncate">{c.name}</span>
                            {pinnedCustomerNames.includes(c.name) && (
                              <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500 rotate-45 shrink-0" />
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 truncate font-mono">
                            {c.accountType === 'credit_card' ? (
                              <>
                                <Calendar className="w-3 h-3 shrink-0 opacity-70" />
                                <span className="truncate">
                                  {lang === 'bn'
                                    ? `বিলিং: প্রতি মাসের ${formatNumber(c.billingDay || 15, 'bn')} তারিখ`
                                    : `Billing Day: ${c.billingDay || 15}`}
                                </span>
                              </>
                            ) : (
                              <>
                                <Phone className="w-3 h-3 shrink-0 opacity-70" />
                                <span className="truncate">{c.phone ? cleanBangladeshiPhone(c.phone) : (lang === 'bn' ? '(ফোন নম্বর নেই)' : '(No phone)')}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Balance Header */}
                      <div className="text-right shrink-0">
                        <div className={`text-base sm:text-lg font-black font-mono tabular-nums truncate ${
                          isDue
                            ? 'text-rose-600 dark:text-rose-400'
                            : isOverpaid
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}>
                          {c.outstandingDue === 0 ? (
                            lang === 'bn' ? '৳ ০' : '৳ 0'
                          ) : (
                            `${c.outstandingDue < 0 ? '-' : ''}৳ ${formatNumber(Math.abs(c.outstandingDue), lang)}`
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Informative Status Strip + Card Tag + 1-Tap Quick Action Shortcuts */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs h-[32px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {/* Status Badge with Bold Hairline */}
                        <span className={`px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider font-bold border leading-none inline-flex items-center gap-1 shrink-0 ${
                          isDue
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                            : isOverpaid
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}>
                          {c.accountType === 'credit_card' ? (
                            isDue ? (
                              lang === 'bn' ? 'কার্ড বিল বকেয়া' : 'Card Bill Due'
                            ) : isOverpaid ? (
                              lang === 'bn' ? 'অতিরিক্ত জমা' : 'Extra Credit'
                            ) : (
                              lang === 'bn' ? 'বিল পরিশোধিত' : 'Bill Settled'
                            )
                          ) : isDue ? (
                            lang === 'bn' ? 'বকেয়া দেনাদার' : 'Due Balance'
                          ) : isOverpaid ? (
                            lang === 'bn' ? 'অগ্রিম জমা' : 'Advance Credit'
                          ) : (
                            lang === 'bn' ? 'হিসাব সম্পন্ন' : 'Settled'
                          )}
                        </span>

                        {/* Card Tag matching border, font, and background of adjacent status tag */}
                        {c.accountType === 'credit_card' && (
                          <span className="px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider font-bold border leading-none inline-flex items-center gap-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700 shrink-0">
                            <CreditCard className="w-2.5 h-2.5 shrink-0" />
                            <span>{lang === 'bn' ? 'কার্ড' : 'Card'}</span>
                          </span>
                        )}
                      </div>

                      {/* Quick 1-tap WhatsApp, Call, and Open Ledger Arrow Shortcuts */}
                      <div className="flex items-center gap-1.5">
                        {c.phone && (
                          <>
                            <a
                              href={`https://wa.me/${(c.phone.startsWith('01') ? '88' : '') + c.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerHaptic('single');
                              }}
                              className="p-1.5 rounded-lg border-2 border-emerald-300 hover:border-emerald-600 dark:border-emerald-800 dark:hover:border-emerald-500 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 transition-colors shadow-2xs active:scale-95 flex items-center justify-center"
                              title="WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`tel:${c.phone}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerHaptic('single');
                              }}
                              className="p-1.5 rounded-lg border-2 border-slate-300 hover:border-slate-800 dark:border-slate-700 dark:hover:border-slate-300 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 transition-colors shadow-2xs active:scale-95 flex items-center justify-center"
                              title={lang === 'bn' ? 'কল করুন' : 'Call'}
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic('single');
                            setSelectedCustomerId(selectedCustomerId === c.id ? null : c.id);
                          }}
                          className="p-1 -mr-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center"
                          title={lang === 'bn' ? 'খাতা খুলুন' : 'Open Ledger'}
                          aria-label={lang === 'bn' ? 'খাতা খুলুন' : 'Open Ledger'}
                        >
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </div>
                    </div>

                  </div>
                </SwipeableCustomerItem>
              );
            })}

            {filteredCustomers.length === 0 && (
              <div className="col-span-1 sm:col-span-2 p-10 text-center bg-white dark:bg-[#0F1623] rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500">
                <Users className="w-8 h-8 mx-auto stroke-[1.5] mb-2 text-slate-400" />
                <p className="font-bold text-sm text-slate-900 dark:text-white">{t.noCustomersFound}</p>
                <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">{t.createOneAbove}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
 
 /* 2. CHOSEN CUSTOMER DETAIL SHEET VIEW */
 <div className="space-y-6">
 {/* Back button */}
 <button
 onClick={() => {
 setSelectedCustomerId(null);
 setOpenActionType(null);
 setIsEditingCustomer(false);
  setLedgerLimit(5);
  }}
  className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 dark:bg-[#0D121D] dark:hover:bg-slate-900 font-bold text-slate-900 dark:text-slate-100 rounded-xl text-xs cursor-pointer transition-all border-2 border-slate-900/60 dark:border-slate-400 shadow-2xs active:scale-95"
 id="back_to_list_btn"
 >
 <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
 <span>{t.backToList}</span>
 </button>

 {/* Customer Profile card */}
 <div className="bg-white dark:bg-[#0D121D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-7 shadow-xs space-y-6 relative overflow-hidden">
 
 {/* Edit and Pin Buttons on the Top Right Side of the Card */}
  {!isEditingCustomer && (
    <div className="absolute right-4 top-4 flex items-center gap-2 z-25">
      <button
        type="button"
        onClick={() => {
          triggerHaptic('single');
          togglePinCustomer(selectedCustomer.id);
        }}
        className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white rounded-xl transition-colors cursor-pointer flex items-center justify-center"
        title={pinnedCustomerNames.includes(selectedCustomer.name) ? (lang === 'bn' ? 'আনপিন করুন' : 'Unpin Customer') : (lang === 'bn' ? 'পিন করুন' : 'Pin Customer')}
      >
        <Pin className={`w-4 h-4 ${pinnedCustomerNames.includes(selectedCustomer.name) ? 'text-amber-500 fill-amber-500 rotate-45' : 'text-slate-500 dark:text-slate-400'}`} />
      </button>
      <button
        type="button"
        onClick={() => {
          triggerHaptic('single');
          handleGenerateReceiptImage();
        }}
        disabled={isGeneratingReceipt}
        className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white rounded-xl transition-colors cursor-pointer flex items-center justify-center"
        title={lang === 'bn' ? 'রসিদ ইমেজ তৈরি ও ডাউনলোড করুন' : 'Generate & Download Receipt Image'}
      >
        {isGeneratingReceipt ? (
          <RefreshCw className="w-4 h-4 text-slate-500 animate-spin" />
        ) : (
          <ReceiptText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        )}
      </button>
      <button
        type="button"
        onClick={() => {
          triggerHaptic('single');
          setEditName(selectedCustomer.name);
          setEditPhone(cleanBangladeshiPhone(selectedCustomer.phone || ''));
          setEditAccountType(selectedCustomer.accountType || 'standard');
          setEditBillingDay(selectedCustomer.billingDay ? String(selectedCustomer.billingDay) : '');
          setEditError('');
          window.history.replaceState({ tab: 'customers', customerId: selectedCustomer.id, modal: 'editingCustomer', quickEntry: false }, '', `?tab=customers&c=${selectedCustomer.id}`);
          setIsEditingCustomer(true);
        }}
        className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white rounded-xl transition-colors cursor-pointer flex items-center justify-center"
        title={lang === 'bn' ? 'তথ্য পরিবর্তন করুন' : 'Edit Customer Info'}
      >
        <Pencil className="w-4 h-4" />
      </button>
    </div>
  )}

 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 pt-2">
 <AnimatePresence mode="wait" initial={false}>
 {isEditingCustomer ? (
 <motion.div
   key="edit-customer-form"
   initial={{ opacity: 0, y: -8, scale: 0.98 }}
   animate={{ opacity: 1, y: 0, scale: 1 }}
   exit={{ opacity: 0, y: -6, scale: 0.98 }}
   transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
   className="flex-1 space-y-3 max-w-md"
 >
 {/* Account Type Selector in Edit Mode */}
 <div>
   <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
     {lang === 'bn' ? 'হিসাবের ধরন' : 'Account Type'}
   </label>
   <div className="grid grid-cols-2 gap-2">
     <button
       type="button"
       onClick={() => {
         triggerHaptic('tick');
         setEditAccountType('standard');
       }}
       className={`py-2 px-3 rounded-xl border-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
         editAccountType === 'standard'
           ? 'bg-slate-950 text-white border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white'
           : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
       }`}
     >
       <Users className="w-3.5 h-3.5" />
       <span>{lang === 'bn' ? 'সাধারণ খতিয়ান' : 'Standard Ledger'}</span>
     </button>
     <button
       type="button"
       onClick={() => {
         triggerHaptic('tick');
         setEditAccountType('credit_card');
       }}
       className={`py-2 px-3 rounded-xl border-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
         editAccountType === 'credit_card'
           ? 'bg-slate-950 text-white border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white'
           : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
       }`}
     >
       <CreditCard className="w-3.5 h-3.5" />
       <span>{lang === 'bn' ? 'ক্রেডিট কার্ড' : 'Credit Card'}</span>
     </button>
   </div>
 </div>

 <div>
 <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
 {editAccountType === 'credit_card' ? (lang === 'bn' ? 'কার্ড / হিসাবের নাম' : 'Card / Account Name') : (lang === 'bn' ? 'গ্রাহকের নাম' : 'Customer Name')}
 </label>
 <input
 type="text"
 value={editName}
 onChange={(e) => setEditName(e.target.value)}
 className="w-full px-3.5 py-2.5 border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-950 dark:text-white focus:outline-none focus:border-slate-950 dark:focus:border-white text-sm font-bold"
 placeholder={editAccountType === 'credit_card' ? (lang === 'bn' ? 'যেমন: সিটি ব্যাংক অ্যামেক্স' : 'e.g. City Bank Amex') : (lang === 'bn' ? 'নাম লিখুন' : 'Enter name')}
 required
 />
 </div>
 <div>
 <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
 {lang === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number'}
 </label>
 <div className="flex gap-2">
    <input
      type="tel"
      id="edit_customer_phone"
      value={editPhone}
      onChange={(e) => setEditPhone(cleanBangladeshiPhone(e.target.value))}
      className="flex-1 px-3.5 py-2.5 border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-950 dark:text-white focus:outline-none focus:border-slate-950 dark:focus:border-white text-sm font-bold"
      placeholder={lang === 'bn' ? 'যেমন: ০১৭...' : 'e.g. 017...'}
    />
    <button
      type="button"
      onClick={() => handlePickContact(async (pickedPhone) => {
        setEditPhone(pickedPhone);
        if (selectedCustomer) {
          setIsSavingEdit(true);
          try {
            const rawBilling = parseInt(editBillingDay, 10);
            const parsedBilling = rawBilling ? Math.min(31, Math.max(1, rawBilling)) : (selectedCustomer.billingDay || 15);
            await updateCustomerDetails(selectedCustomer.id, editName.trim() || selectedCustomer.name, pickedPhone, {
              accountType: editAccountType,
              billingDay: editAccountType === 'credit_card' ? parsedBilling : undefined
            });
            setIsEditingCustomer(false);
            triggerHaptic('single');
            toast.success(lang === 'bn' ? 'মোবাইল নম্বর ও প্রোফাইল স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়েছে' : 'Profile saved automatically');
          } catch (err: any) {
            if (err && (err as any).message === 'DUPLICATE_NAME') {
              setEditError(lang === 'bn' ? 'এই নামের গ্রাহক ইতিমধ্যে খতিয়ানে সংরক্ষিত আছে।' : 'A customer with this name already exists.');
            } else {
              setEditError(lang === 'bn' ? 'সংরক্ষণ করতে ব্যর্থ হয়েছে' : 'Failed to save changes');
            }
          } finally {
            setIsSavingEdit(false);
          }
        }
      })}
      className="px-3.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center justify-center cursor-pointer transition-all shadow-2xs shrink-0"
      title={lang === 'bn' ? 'কন্টাক্ট নির্বাচন করুন' : 'Pick Contact'}
    >
      <BookUser className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
    </button>
  </div>
 </div>

 {editAccountType === 'credit_card' && (
   <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border-2 border-slate-300 dark:border-slate-700">
     <div className="flex items-center justify-between gap-2">
       <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
         <Calendar className="w-3.5 h-3.5" />
         <span>{lang === 'bn' ? 'স্টেটমেন্ট বিলিং তারিখ (১-৩১)' : 'Statement Billing Day (1–31)'}</span>
       </label>
       <input
         type="text"
         inputMode="numeric"
         data-numpad="true"
         placeholder={lang === 'bn' ? '১-৩১' : '1–31'}
         value={editBillingDay}
         onChange={(e) => {
           const clean = e.target.value.replace(/[^0-9]/g, '');
           if (!clean) {
             setEditBillingDay('');
             return;
           }
           setEditBillingDay(String(Math.min(31, Math.max(1, parseInt(clean, 10)))));
         }}
         className="w-20 px-2.5 py-1.5 text-center border-2 border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0D121D] text-slate-950 dark:text-white font-mono font-black text-sm focus:outline-none focus:border-slate-950 dark:focus:border-white placeholder:text-slate-400 placeholder:font-normal"
       />
     </div>
   </div>
 )}

 {editError && (
 <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{editError}</p>
 )}
 <div className="flex items-center gap-2 pt-1">
 <button
 type="button"
 disabled={isSavingEdit}
 onClick={async () => {
 triggerHaptic('single');
 if (!editName.trim()) {
 setEditError(lang === 'bn' ? 'নাম অবশ্যই দিতে হবে' : 'Name is required');
 return;
 }
 const rawBilling = parseInt(editBillingDay, 10);
 if (editAccountType === 'credit_card' && (!rawBilling || rawBilling < 1 || rawBilling > 31)) {
   setEditError(lang === 'bn' ? 'বিলিং তারিখ ১ থেকে ৩১ এর মধ্যে দিন' : 'Please enter a billing day between 1 and 31');
   return;
 }
 setIsSavingEdit(true);
 try {
 const parsedBilling = rawBilling ? Math.min(31, Math.max(1, rawBilling)) : undefined;
 await updateCustomerDetails(selectedCustomer.id, editName, editPhone, {
   accountType: editAccountType,
   billingDay: editAccountType === 'credit_card' ? parsedBilling : undefined
 });
 setIsEditingCustomer(false);
 toast.success(lang === 'bn' ? 'তথ্য আপডেট করা হয়েছে' : 'Profile updated');
     } catch (err) {
      if (err && (err as any).message === 'DUPLICATE_NAME') {
        setEditError(lang === 'bn' ? 'এই নামের গ্রাহক ইতিমধ্যে খতিয়ানে সংরক্ষিত আছে।' : 'A customer with this name already exists.');
      } else {
        setEditError(lang === 'bn' ? 'সংরক্ষণ করতে ব্যর্থ হয়েছে' : 'Failed to save changes');
      }
    } finally {
 setIsSavingEdit(false);
 }
 }}
 className="px-4 py-2 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold text-xs rounded-xl border-2 border-slate-950 dark:border-white transition-colors cursor-pointer"
 >
 {isSavingEdit ? (lang === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : (lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save')}
 </button>
 <button
 type="button"
 disabled={isSavingEdit}
 onClick={() => {
   triggerHaptic('single');
   setIsEditingCustomer(false);
 }}
 className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white transition-colors cursor-pointer"
 >
 {lang === 'bn' ? 'বাতিল' : 'Cancel'}
 </button>
 </div>
 </motion.div>
 ) : (
 <motion.div
   key="view-customer-info"
   initial={{ opacity: 0, y: 6 }}
   animate={{ opacity: 1, y: 0 }}
   exit={{ opacity: 0, y: -4 }}
   transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
 >
 <h2 className="text-xl sm:text-2xl font-extrabold text-slate-950 dark:text-white pr-28">{selectedCustomer.name}</h2>
 {selectedCustomer.phone ? (
 <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1.5 font-mono">
 <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
 <span>{cleanBangladeshiPhone(selectedCustomer.phone)}</span>
 <a 
 href={`tel:${cleanBangladeshiPhone(selectedCustomer.phone)}`}
 onClick={() => triggerHaptic('single')}
 className="ml-1.5 text-xs font-sans font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white text-slate-700 dark:text-slate-300 inline-block cursor-pointer transition-colors"
 >
 {lang === 'bn' ? 'কল করুন' : 'Call Now'}
 </a>
 </p>
 ) : (
 <button
 type="button"
 onClick={() => handlePickContact(async (pickedPhone) => {
   try {
     await updateCustomerDetails(selectedCustomer.id, selectedCustomer.name, pickedPhone, {
       accountType: selectedCustomer.accountType,
       billingDay: selectedCustomer.billingDay
     });
     triggerHaptic('single');
     toast.success(lang === 'bn' ? 'মোবাইল নম্বর স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়েছে' : 'Phone number saved automatically');
   } catch (e) {
     toast.error(lang === 'bn' ? 'সংরক্ষণ ব্যর্থ হয়েছে' : 'Failed to save phone number');
   }
 })}
 className="mt-1.5 text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1.5 cursor-pointer"
 >
 <Phone className="w-3.5 h-3.5" />
 <span>{lang === 'bn' ? '+ মোবাইল নম্বর যুক্ত করুন' : '+ Add phone number'}</span>
 </button>
 )}

 {/* Single-line Billing Date underneath the Phone Number matching Phone Number styling */}
 {selectedCustomer.accountType === 'credit_card' && creditCardCycleData && (
   <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1.5 font-mono whitespace-nowrap overflow-hidden text-ellipsis">
     <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
     <span className="truncate text-[13px]">
       {lang === 'bn'
         ? `বিলিং তারিখ: ${creditCardCycleData.nextStatementDate.toLocaleDateString('bn-BD', { month: 'long', day: 'numeric' })} (${
             creditCardCycleData.daysUntilNextStatement === 0
               ? 'আজ'
               : `${formatNumber(creditCardCycleData.daysUntilNextStatement, 'bn')} দিন পর`
           })`
         : `Billing Date: ${creditCardCycleData.nextStatementDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} (${
             creditCardCycleData.daysUntilNextStatement === 0
               ? 'today'
               : `in ${creditCardCycleData.daysUntilNextStatement}d`
           })`}
     </span>
   </p>
 )}
 </motion.div>
 )}
 </AnimatePresence>

 </div>
 {/* CURRENT BALANCE CARD + ELLIPSIS TOGGLE FOR TOTAL BILLED & TOTAL PAID */}
 <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
   {/* Primary Current Balance Box with Ellipsis button on the right */}
   <div className={`p-3.5 sm:p-4 rounded-xl border flex items-center justify-between gap-3 ${
     selectedCustomer.outstandingDue > 0
       ? 'border-rose-300 dark:border-rose-900/80 bg-rose-50/40 dark:bg-rose-950/20'
       : selectedCustomer.outstandingDue < 0
       ? 'border-emerald-300 dark:border-emerald-900/80 bg-emerald-50/40 dark:bg-emerald-950/20'
       : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40'
   }`}>
     <div className="space-y-1 min-w-0">
       <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 block">
         {selectedCustomer.accountType === 'credit_card'
           ? (lang === 'bn' ? 'মোট অপরিশোধিত কার্ড বিল (চলতি + বকেয়া)' : 'Total Outstanding Card Balance')
           : t.currentBalance}
       </span>
       <div className={`text-[22px] sm:text-[26px] font-black font-mono tabular-nums ${
         selectedCustomer.outstandingDue > 0
           ? 'text-rose-600 dark:text-rose-400'
           : selectedCustomer.outstandingDue < 0
           ? 'text-emerald-600 dark:text-emerald-400'
           : 'text-slate-500 dark:text-slate-400'
       }`}>
         {selectedCustomer.outstandingDue === 0 ? (
           lang === 'bn' ? '৳ ০ (পরিশোধিত)' : '৳ 0 (Settled)'
         ) : (
           `${selectedCustomer.outstandingDue < 0 ? '-' : ''}৳ ${formatNumber(Math.abs(selectedCustomer.outstandingDue), lang)}`
         )}
       </div>
       <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
         {selectedCustomer.accountType === 'credit_card' ? (
           selectedCustomer.outstandingDue > 0
             ? (creditCardCycleData && creditCardCycleData.unpaidCarryOver > 0
                 ? (lang === 'bn'
                     ? `চলতি মাস ৳${formatNumber(creditCardCycleData.netUnbilledThisMonth, 'bn')} + গত মাসের বকেয়া ৳${formatNumber(creditCardCycleData.unpaidCarryOver, 'bn')}`
                     : `Includes ৳${formatNumber(creditCardCycleData.unpaidCarryOver, 'en')} carried over from last month`)
                 : (lang === 'bn' ? 'মোট পরিশোধযোগ্য কার্ড বিল' : 'Total payable card balance'))
             : selectedCustomer.outstandingDue < 0
             ? (lang === 'bn' ? 'কার্ডে অতিরিক্ত পেমেন্ট জমা আছে' : 'Extra credit balance on card')
             : (lang === 'bn' ? 'সব কার্ড বিল পরিশোধিত' : 'All card bills settled')
         ) : (
           selectedCustomer.outstandingDue > 0 
             ? t.customerOwes 
             : selectedCustomer.outstandingDue < 0 
             ? t.youOweCustomer 
             : t.allClear
         )}
       </p>
     </div>

     {/* Circle-Ellipsis Button (without border) to reveal/hide Total Billed and Total Paid */}
     <button
       type="button"
       onClick={() => {
         triggerHaptic('single');
         setShowExtraBalanceCards(prev => !prev);
       }}
       className={`p-1.5 rounded-full transition-colors cursor-pointer shrink-0 flex items-center justify-center active:scale-95 ${
         showExtraBalanceCards
           ? 'text-slate-950 dark:text-white'
           : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
       }`}
       title={showExtraBalanceCards ? (lang === 'bn' ? 'মোট বিবরণ লুকান' : 'Hide totals') : (lang === 'bn' ? 'মোট বকেয়া ও আদায় দেখুন' : 'Show Total Billed & Total Paid')}
       aria-expanded={showExtraBalanceCards}
     >
       <CircleEllipsis className="w-5 h-5" />
     </button>
   </div>

   {/* Hidden by default: Total Billed & Total Paid cards (mimicking new account creation card animation) */}
   <AnimatePresence>
     {showExtraBalanceCards && (
       <motion.div
         initial={{ opacity: 0, y: -8 }}
         animate={{ opacity: 1, y: 0 }}
         exit={{ opacity: 0, y: -8 }}
         className="grid grid-cols-1 sm:grid-cols-2 gap-3"
       >
         {/* 1. Total Billed */}
         <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/40 space-y-1">
           <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 block">
             {selectedCustomer.accountType === 'credit_card'
               ? (lang === 'bn' ? 'সর্বমোট কার্ড খরচ' : 'Total Card Spend (All-Time)')
               : (lang === 'bn' ? 'মোট বিক্রয় বাকি' : 'Total Billed (Dues)')}
           </span>
           <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400 tabular-nums">
             ৳ {formatNumber(selectedCustomerMetrics.totalBilled, lang)}
           </div>
           <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
             {formatNumber(selectedCustomerMetrics.txCount, lang)} {lang === 'bn' ? 'টি মোট এন্ট্রি' : 'ledger entries'}
           </p>
         </div>

         {/* 2. Total Paid */}
         <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/40 space-y-1">
           <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 block">
             {selectedCustomer.accountType === 'credit_card'
               ? (lang === 'bn' ? 'সর্বমোট বিল পরিশোধ' : 'Total Bill Payments')
               : (lang === 'bn' ? 'মোট প্রাপ্ত নগদ' : 'Total Paid (Inflow)')}
           </span>
           <div 
             className="text-xl font-black font-mono tabular-nums"
             style={{ color: 'var(--accent-color)' }}
           >
             ৳ {formatNumber(selectedCustomerMetrics.totalPaid, lang)}
           </div>
           <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
             {selectedCustomer.accountType === 'credit_card'
               ? (lang === 'bn' ? 'পরিশোধিত কার্ড বিল' : 'Recorded bill settlements')
               : (lang === 'bn' ? 'আদায়কৃত ক্যাশ/অনলাইন' : 'Verified collections')}
           </p>
         </div>
       </motion.div>
     )}
   </AnimatePresence>
 </div>

 {/* Quick message template picker card */}
 {selectedCustomer.phone && selectedCustomer.outstandingDue > 0 && (
  <details className="bg-slate-50 dark:bg-slate-900/60 px-3.5 py-2.5 open:pb-3.5 rounded-xl border-2 border-slate-300 dark:border-slate-700 hover:border-slate-800 dark:hover:border-slate-300 transition-colors relative z-10 group [&_summary::-webkit-details-marker]:hidden">
    <summary
      onClick={() => triggerHaptic('single')}
      className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center justify-between cursor-pointer list-none select-none leading-none"
    >
      <div className="flex items-center gap-2">
        <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>{t.predefinedMessages}</span>
      </div>
      <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform group-open:-rotate-180 shrink-0" />
    </summary>
    <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('single');
            setSelectedTemplate(1);
          }}
          className={`p-2.5 text-left rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${
            selectedTemplate === 1
              ? 'bg-emerald-600 border-slate-950 dark:border-white text-white shadow-2xs'
              : 'bg-white dark:bg-[#0D121D] border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-900 dark:hover:border-white'
          }`}
        >
          {t.templatePolite}
        </button>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('single');
            setSelectedTemplate(2);
          }}
          className={`p-2.5 text-left rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${
            selectedTemplate === 2
              ? 'bg-emerald-600 border-slate-950 dark:border-white text-white shadow-2xs'
              : 'bg-white dark:bg-[#0D121D] border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-900 dark:hover:border-white'
          }`}
        >
          {t.templateRespect}
        </button>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('single');
            setSelectedTemplate(3);
          }}
          className={`p-2.5 text-left rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${
            selectedTemplate === 3
              ? 'bg-emerald-600 border-slate-950 dark:border-white text-white shadow-2xs'
              : 'bg-white dark:bg-[#0D121D] border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-900 dark:hover:border-white'
          }`}
        >
          {t.templateFormal}
        </button>
      </div>
      
      {/* Live Message Preview */}
      <div className="bg-white dark:bg-[#0D121D] border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl text-xs italic text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
        "{getMessageText(selectedCustomer, selectedTemplate)}"
      </div>
    </div>
  </details>
 )}

 {/* SEND REMINDERS / ACTIONS */}
 <div className="!mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2.5">
 {selectedCustomer.phone && selectedCustomer.outstandingDue > 0 && (
 <>
 <a
 href={getShareLink(selectedCustomer, 'whatsapp')}
 target="_blank"
 rel="noreferrer"
 onClick={() => triggerHaptic('single')}
 className="w-full basis-full sm:w-auto sm:basis-auto sm:flex-1 sm:min-w-[160px] py-2.5 px-4 bg-[#25D366] hover:bg-[#20ba59] border-2 border-transparent hover:border-slate-950 dark:hover:border-white font-bold text-white rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm transition-all"
 >
 <MessageCircleMore className="w-4 h-4" />
 {t.remindWhatsApp}
 </a>

 <a
 href={getShareLink(selectedCustomer, 'sms')}
 onClick={() => triggerHaptic('single')}
 className="flex-1 min-w-[160px] py-2.5 px-4 bg-blue-600 hover:bg-blue-700 border-2 border-transparent hover:border-slate-950 dark:hover:border-white font-bold text-white rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm transition-all"
 >
 <Send className="w-4 h-4" />
 {t.sendSmsReminder}
 </a>
 </>
 )}
 
 {/* DELETE ACCOUNT BUTTON */}
 <button
   onClick={() => {
     triggerHaptic('double');
     handleDelete(selectedCustomer);
   }}
   className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 dark:text-rose-400 border-2 border-rose-300 dark:border-rose-800/80 hover:border-rose-600 dark:hover:border-rose-400 rounded-xl flex items-center justify-center gap-2 cursor-pointer text-xs font-bold transition-all"
 >
 <Trash2 className="w-4 h-4" />
 {t.deleteAccount}
 </button>
 </div>
 </div>

 {/* TWO DUAL BIG DIRECT ENTRY BUTTONS (WITH DISTINCTIVE BOLD BORDERS) */}
 <div className="grid grid-cols-2 gap-3 sm:gap-4">
 <button
 onClick={() => {
   setActionTargetCycle(cardCycleTab);
   setOpenActionType('due');
 }}
 className={`py-4 px-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98] shadow-xs ${
 openActionType === 'due' 
 ? 'bg-rose-600 border-rose-600 text-white font-black' 
 : 'bg-white hover:bg-rose-50/60 border-rose-300 hover:border-rose-600 dark:border-rose-900 dark:hover:border-rose-500 text-rose-600 dark:bg-[#0D121D] dark:hover:bg-rose-950/20 dark:text-rose-400 font-bold'
 }`}
 >
 {selectedCustomer.accountType === 'credit_card' ? (
   <CreditCard className="w-5 h-5 stroke-[2.5]" />
 ) : (
   <ArrowUpRight className="w-5 h-5 stroke-[3]" />
 )}
 <span className="font-extrabold text-sm sm:text-base">
   + {selectedCustomer.accountType === 'credit_card'
       ? (lang === 'bn' ? 'কার্ড বিল যোগ' : 'Add Card Bill')
       : t.letThemBuy}
 </span>
 </button>

 <button
 onClick={() => setOpenActionType('payment')}
 className={`py-4 px-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98] shadow-xs ${
 openActionType === 'payment' 
 ? 'bg-emerald-600 border-emerald-600 text-white font-black' 
 : 'bg-white hover:bg-emerald-50/60 border-emerald-300 hover:border-emerald-600 dark:border-emerald-900 dark:hover:border-emerald-500 text-emerald-600 dark:bg-[#0D121D] dark:hover:bg-emerald-950/20 dark:text-emerald-400 font-bold'
 }`}
 >
 <ArrowDownLeft className="w-5 h-5 stroke-[3]" />
 <span className="font-extrabold text-sm sm:text-base">
   + {selectedCustomer.accountType === 'credit_card'
       ? (lang === 'bn' ? 'বিল পরিশোধ জমা' : 'Pay Card Bill')
       : t.gotCash}
 </span>
 </button>
 </div>

 {/* INLINE INJECT TRANSACTION MODIFIER FORM */}
 <AnimatePresence>
 {openActionType && (
 <motion.div
 initial={{ opacity: 0, scale: 0.96, y: 10 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.96, y: 8 }}
 transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
 className="bg-white dark:bg-[#0D121D] border border-slate-200/80 dark:border-slate-800/80 p-4 sm:p-5 rounded-2xl space-y-4 shadow-sm"
 >
 <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
 <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
 {selectedCustomer.accountType === 'credit_card'
   ? (openActionType === 'due'
       ? (lang === 'bn' ? `${selectedCustomer.name}-এ নতুন কার্ড বিল যোগ` : `Record Card Bill for ${selectedCustomer.name}`)
       : (lang === 'bn' ? `${selectedCustomer.name}-এ কার্ড বিল পরিশোধ` : `Record Card Bill Payment for ${selectedCustomer.name}`))
   : `${openActionType === 'due' ? (lang === 'bn' ? 'নতুন বাকি বিবরণ' : 'Record New Due') : (lang === 'bn' ? 'পেমেন্ট আদায়ের বিবরণ' : 'Record Received Payment')} ${lang === 'bn' ? 'যুক্ত হচ্ছে' : 'for'} ${selectedCustomer.name}`}
 </h4>
 <button
   type="button"
   onClick={() => {
     triggerHaptic('medium');
     setOpenActionType(null);
   }}
   className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white rounded-lg text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 <form onSubmit={handleAddInlineTransaction} className="space-y-4">
 {/* Optional Cycle Selector when recording a Card Bill on a Credit Card account */}
 {selectedCustomer.accountType === 'credit_card' && openActionType === 'due' && (
   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
     <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
       {lang === 'bn' ? 'কোন বিলিং সাইকেলে যুক্ত করবেন?' : 'Add bill to which statement cycle?'}
     </span>
     <div className="flex items-center gap-1.5">
       <button
         type="button"
         onClick={() => setActionTargetCycle('unbilled')}
         className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
           actionTargetCycle === 'unbilled'
             ? 'bg-slate-950 text-white border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white'
             : 'bg-white dark:bg-[#0D121D] text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
         }`}
       >
         {lang === 'bn' ? 'আনবিল্ড' : 'Unbilled'}
       </button>
       <button
         type="button"
         onClick={() => setActionTargetCycle('billed')}
         className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
           actionTargetCycle === 'billed'
             ? 'bg-slate-950 text-white border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white'
             : 'bg-white dark:bg-[#0D121D] text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
         }`}
       >
         {lang === 'bn' ? 'বিল্ড' : 'Billed'}
       </button>
     </div>
   </div>
 )}

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="space-y-1">
 <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.amount} (৳) *</label>
 <input
 type="text"
 inputMode="decimal"
 data-numpad="true"
 placeholder="0"
 value={actionAmount}
 onChange={(e) => {
 const val = e.target.value;
 const clean = val.replace(/[^0-9.]/g, '');
 const dots = clean.split('.');
 let sanitized = clean;
 if (dots.length > 2) {
 sanitized = dots[0] + '.' + dots.slice(1).join('');
 }
 setActionAmount(formatIndianNumberString(sanitized));
 }}
 className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white text-base sm:text-lg font-mono font-bold focus:outline-none focus:border-slate-950 dark:focus:border-white transition-colors"
 required
 autoFocus
 />

              {openActionType && !txSubmitting && getDuplicate(openActionType, actionAmount) && (
                <p className="text-xs font-bold text-amber-600 dark:text-amber-500 mt-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {t.duplicateRealtimeWarning}
                </p>
              )}

              {openActionType === 'payment' && selectedCustomer && selectedCustomer.accountType === 'credit_card' && creditCardCycleData && creditCardCycleData.unpaidCarryOver > 0 && creditCardCycleData.unpaidCarryOver !== selectedCustomer.outstandingDue && (
                <div 
                  onClick={() => {
                    triggerHaptic('single');
                    const targetBilled = creditCardCycleData.unpaidCarryOver;
                    const isChecked = actionAmount.replace(/,/g, '') === targetBilled.toString();
                    if (!isChecked) {
                      setActionAmount(formatIndianNumberString(targetBilled.toString()));
                      if (!actionDesc.trim()) {
                        setActionDesc(lang === 'bn' ? 'গত মাসের বিল পরিশোধ' : 'Last Month Bill Payment');
                      }
                    } else {
                      setActionAmount('');
                    }
                  }}
                  className="w-full flex items-center text-left gap-2.5 mt-2 p-2.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border-2 border-amber-300 dark:border-amber-800 hover:border-amber-600 dark:hover:border-amber-400 cursor-pointer transition-colors select-none shadow-2xs"
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-amber-600 rounded cursor-pointer pointer-events-none"
                    checked={actionAmount.replace(/,/g, '') === creditCardCycleData.unpaidCarryOver.toString()}
                    readOnly
                  />
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200 select-none">
                    {lang === 'bn' ? 'গত মাসের বকেয়া বিল পরিশোধ করুন' : 'Pay last month billed statement'} (৳{formatNumber(creditCardCycleData.unpaidCarryOver, lang)})
                  </span>
                </div>
              )}

              {openActionType === 'payment' && selectedCustomer && selectedCustomer.outstandingDue > 0 && (
                <div 
                  onClick={() => {
                    triggerHaptic('single');
                    const targetDue = selectedCustomer.outstandingDue;
                    const isChecked = actionAmount.replace(/,/g, '') === targetDue.toString();
                    if (!isChecked) {
                      setActionAmount(formatIndianNumberString(targetDue.toString()));
                    } else {
                      setActionAmount('');
                    }
                  }}
                  className="w-full flex items-center text-left gap-2.5 mt-2 p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white cursor-pointer transition-colors select-none shadow-2xs"
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-emerald-600 rounded cursor-pointer pointer-events-none"
                    checked={actionAmount.replace(/,/g, '') === selectedCustomer.outstandingDue.toString()}
                    readOnly
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 select-none">
                    {selectedCustomer.accountType === 'credit_card'
                      ? (lang === 'bn' ? 'সম্পূর্ণ কার্ড বিল পরিশোধ করুন' : 'Pay total card balance')
                      : (lang === 'bn' ? 'সম্পূর্ণ বকেয়া পরিশোধ করুন' : 'Settle complete due')} (৳{formatNumber(selectedCustomer.outstandingDue, lang)})
                  </span>
                </div>
              )}

 {/* Tap amount quick-add preset buttons */}
 <div className="flex flex-wrap gap-1.5 mt-2">
 {[50, 100, 500, 1000, 5000].map((preset) => (
 <button
 key={preset}
 type="button"
 onClick={() => {
 const cleaned = actionAmount.replace(/,/g, '');
 const currentVal = parseFloat(cleaned) || 0;
 const newVal = (currentVal + preset).toString();
 setActionAmount(formatIndianNumberString(newVal));
 }}
 className="bg-white hover:bg-slate-50 dark:bg-[#0D121D] dark:hover:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-slate-100 transition-colors cursor-pointer shadow-2xs active:scale-95"
 >
 +৳{formatNumber(preset, lang)}
 </button>
 ))}
 <button
 key="clear"
 type="button"
 onClick={() => setActionAmount('')}
 className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-2 border-rose-300 dark:border-rose-900 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer active:scale-95"
 >
 {lang === 'bn' ? 'মুছে ফেলুন' : 'Clear'}
 </button>
 </div>
 </div>
 <div className="space-y-1">
 <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.notes}</label>
 <input
 type="text"
 placeholder={selectedCustomer.accountType === 'credit_card'
   ? (openActionType === 'due'
       ? (lang === 'bn' ? 'যেমন: দারাজ শপিং, বিদ্যুৎ বিল, গ্রোসারি...' : 'e.g. Grocery, Electricity Bill, Online Shopping...')
       : (lang === 'bn' ? 'যেমন: বিকাশ / ব্যাংক ট্রান্সফার পেমেন্ট...' : 'e.g. Paid via Bank Transfer / bKash...'))
   : t.notesPlaceholder}
 value={actionDesc}
 onChange={(e) => setActionDesc(e.target.value)}
 className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white text-sm focus:outline-none focus:border-slate-950 dark:focus:border-white transition-colors"
 />
 </div>
 </div>

 <div className="flex justify-end items-center gap-2 pt-1">
 <button
 type="button"
 onClick={() => setOpenActionType(null)}
 className="px-3.5 py-2 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white font-bold rounded-xl cursor-pointer transition-colors"
 >
 {t.cancel}
 </button>
 <button
 type="submit"
 disabled={txSubmitting}
 className={`px-4 py-2 text-xs text-white font-bold rounded-xl transition-all cursor-pointer border-2 border-transparent hover:border-slate-950 dark:hover:border-white shadow-xs ${
 openActionType === 'due' 
 ? 'bg-rose-600 hover:bg-rose-700' 
 : 'bg-emerald-600 hover:bg-emerald-700'
 } disabled:opacity-70 disabled:cursor-not-allowed`}
 >
 {txSubmitting ? (
 <span className="flex items-center gap-1.5">
 <svg className="animate-spin h-3.5 w-3.5 text-current" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 {t.saving || (lang === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...')}
 </span>
 ) : (
 t.addToLedger
 )}
 </button>
 </div>
 </form>
 </motion.div>
 )}
 </AnimatePresence>

   {/* HISTORICAL LEDGER FOR THIS CUSTOMER */}
  <div id="statements_timeline" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      {selectedCustomer.accountType === 'credit_card' && creditCardCycleData ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('single');
              setCardCycleTab('unbilled');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              cardCycleTab === 'unbilled'
                ? 'bg-slate-950 text-white border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white shadow-2xs'
                : 'bg-white dark:bg-[#0D121D] text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white'
            }`}
          >
            <span>{lang === 'bn' ? 'আনবিল্ড' : 'Unbilled'}</span>
            <span className="px-1.5 py-0.2 rounded-md text-[10px] font-mono bg-slate-500/20">
              {formatNumber(creditCardCycleData.unbilledTxs.length, lang)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('single');
              setCardCycleTab('billed');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              cardCycleTab === 'billed'
                ? 'bg-slate-950 text-white border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white shadow-2xs'
                : 'bg-white dark:bg-[#0D121D] text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white'
            }`}
          >
            <span>{lang === 'bn' ? 'বিল্ড' : 'Billed'}</span>
            <span className="px-1.5 py-0.2 rounded-md text-[10px] font-mono bg-slate-500/20">
              {formatNumber(creditCardCycleData.billedTxs.length, lang)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('single');
              setShowMonthlyCycle(prev => !prev);
            }}
            title={lang === 'bn' ? 'মাসিক কার্ড সাইকেল' : 'Monthly card cycle'}
            aria-label={lang === 'bn' ? 'মাসিক কার্ড সাইকেল' : 'Monthly card cycle'}
            aria-expanded={showMonthlyCycle}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold border-2 transition-all cursor-pointer flex items-center justify-center ${
              showMonthlyCycle
                ? 'bg-slate-950 text-white border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white shadow-2xs'
                : 'bg-white dark:bg-[#0D121D] text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white'
            }`}
          >
            <ListClockIcon className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <span className="text-xs font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
          {t.statements} ({formatNumber(activeCustomerTxCount, lang)})
        </span>
      )}

      {/* Client Statement Tools / Borderless Merge Button */}
      {archiveCustomerExcessStatements && (
        <button
          type="button"
          onClick={() => {
            triggerHaptic('single');
            setIsManageStatementsOpen(true);
          }}
          className="px-2.5 py-1 rounded-lg bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
        >
          <Archive className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span>{lang === 'bn' ? 'মার্জ' : 'Merge'}</span>
        </button>
      )}
    </div>

    {/* EXPANDABLE MONTHLY CARD CYCLE HISTORY CARDS (Toggled via list-clock icon button) */}
    <AnimatePresence>
      {selectedCustomer.accountType === 'credit_card' && creditCardCycleData && showMonthlyCycle && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-3.5"
        >
            {/* Two-Card Comparison Grid: Unbilled (This Month) & Billed (Last Month) - History only (non-clickable) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 1. UNBILLED (THIS MONTH) CARD */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D121D] flex flex-col justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-slate-900 dark:text-white px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800">
                      {lang === 'bn' ? 'আনবিল্ড • চলতি মাস' : 'Unbilled • This Month'}
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                      {creditCardCycleData.lastStatementDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', day: 'numeric' })}
                      {' – '}
                      {creditCardCycleData.thisMonthEndDisplay.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="pt-1 flex items-baseline justify-between gap-2">
                    <div>
                      <div className="text-xl sm:text-2xl font-black font-mono text-rose-600 dark:text-rose-400 tabular-nums">
                        ৳ {formatNumber(creditCardCycleData.thisMonthSpend, lang)}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {lang === 'bn' ? 'চলতি সাইকেলে নতুন খরচ' : 'New card spend this cycle'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 block">
                        {formatNumber(creditCardCycleData.unbilledTxs.length, lang)} {lang === 'bn' ? 'টি এন্ট্রি' : 'entries'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Carry-Over Indicator inside This Month */}
                {creditCardCycleData.unpaidCarryOver > 0 ? (
                  <div className="mt-1 pt-2 border-t border-amber-200/80 dark:border-amber-900/50 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400">
                      <span>{lang === 'bn' ? '+ গত মাসের অপরিশোধিত জের:' : '+ Carried over from last month:'}</span>
                      <span className="font-mono">৳ {formatNumber(creditCardCycleData.unpaidCarryOver, lang)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-extrabold text-slate-950 dark:text-white">
                      <span>{lang === 'bn' ? 'মোট পরিশোধযোগ্য:' : 'Total Payable Now:'}</span>
                      <span className="font-mono text-rose-600 dark:text-rose-400">
                        ৳ {formatNumber(creditCardCycleData.totalPayableWithCarryOver, lang)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    <span>{lang === 'bn' ? 'গত মাসের কোনো বকেয়া জের নেই' : 'No unpaid carry-over from last month'}</span>
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  </div>
                )}
              </div>

              {/* 2. BILLED (LAST MONTH) CARD */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D121D] flex flex-col justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800">
                      {lang === 'bn' ? 'বিল্ড • গত মাস' : 'Billed • Last Month'}
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                      {creditCardCycleData.prevStatementDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', day: 'numeric' })}
                      {' – '}
                      {creditCardCycleData.lastMonthEndDisplay.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="pt-1 flex items-baseline justify-between gap-2">
                    <div>
                      <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white tabular-nums">
                        ৳ {formatNumber(creditCardCycleData.lastMonthCycleSpend, lang)}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {lang === 'bn' ? 'গত সাইকেলে মোট কার্ড খরচ' : 'Spent in last month cycle'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 block">
                        {formatNumber(creditCardCycleData.billedTxs.length, lang)} {lang === 'bn' ? 'টি এন্ট্রি' : 'entries'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Statement Settlement Status */}
                <div className="mt-1 pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1">
                  {creditCardCycleData.billedStatementAmount === 0 && creditCardCycleData.lastMonthCycleSpend === 0 ? (
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      <span>{lang === 'bn' ? 'গত মাসে কোনো বিল ছিল না' : 'No billed balance last cycle'}</span>
                      <Check className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </div>
                  ) : creditCardCycleData.unpaidCarryOver === 0 ? (
                    <div className="flex items-center justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      <span>{lang === 'bn' ? 'গত মাসের স্টেটমেন্ট সম্পূর্ণ পরিশোধিত' : 'Last month statement paid in full'}</span>
                      <Check className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400">
                      <span>
                        {lang === 'bn'
                          ? `অপরিশোধিত ৳${formatNumber(creditCardCycleData.unpaidCarryOver, 'bn')} চলতি মাসে যুক্ত`
                          : `৳${formatNumber(creditCardCycleData.unpaidCarryOver, 'en')} unpaid → carried to This Month`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Smart Spend Comparison & 1-Tap Statement Payment Bar */}
            <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {/* Spend vs Last Month comparison insight */}
              <div className="text-xs text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {creditCardCycleData.lastMonthCycleSpend === 0 ? (
                  <span>
                    {lang === 'bn'
                      ? `চলতি সাইকেলে মোট খরচ ৳${formatNumber(creditCardCycleData.thisMonthSpend, 'bn')}`
                      : `৳${formatNumber(creditCardCycleData.thisMonthSpend, 'en')} spent so far in this billing cycle`}
                  </span>
                ) : creditCardCycleData.thisMonthSpend > creditCardCycleData.lastMonthCycleSpend ? (
                  <span>
                    {lang === 'bn'
                      ? `গত মাসের তুলনায় এই মাসে ৳${formatNumber(creditCardCycleData.thisMonthSpend - creditCardCycleData.lastMonthCycleSpend, 'bn')} বেশি খরচ হয়েছে`
                      : `৳${formatNumber(creditCardCycleData.thisMonthSpend - creditCardCycleData.lastMonthCycleSpend, 'en')} more spent this month vs last month`}
                  </span>
                ) : creditCardCycleData.thisMonthSpend < creditCardCycleData.lastMonthCycleSpend ? (
                  <span>
                    {lang === 'bn'
                      ? `গত মাসের তুলনায় এই মাসে ৳${formatNumber(creditCardCycleData.lastMonthCycleSpend - creditCardCycleData.thisMonthSpend, 'bn')} কম খরচ হয়েছে`
                      : `৳${formatNumber(creditCardCycleData.lastMonthCycleSpend - creditCardCycleData.thisMonthSpend, 'en')} less spent this month vs last month`}
                  </span>
                ) : (
                  <span>
                    {lang === 'bn'
                      ? 'চলতি মাস এবং গত মাসের খরচের পরিমাণ সমান'
                      : 'Spending this month matches last month exactly'}
                  </span>
                )}
              </div>

              {/* 1-Tap Quick Settle Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {creditCardCycleData.unpaidCarryOver > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('single');
                      setOpenActionType('payment');
                      setActionAmount(formatIndianNumberString(creditCardCycleData.unpaidCarryOver.toString()));
                      setActionDesc(lang === 'bn' ? 'গত মাসের বিল পরিশোধ' : 'Last Month Bill Payment');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs cursor-pointer transition-all shadow-2xs active:scale-95"
                  >
                    {lang === 'bn'
                      ? `গত মাসের বকেয়া পরিশোধ (৳${formatNumber(creditCardCycleData.unpaidCarryOver, 'bn')})`
                      : `Pay Billed Due (৳${formatNumber(creditCardCycleData.unpaidCarryOver, 'en')})`}
                  </button>
                )}
              </div>
            </div>
        </motion.div>
      )}
    </AnimatePresence>

    <div className="bg-white dark:bg-[#0D121D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-xs">
      {groupedTransactions.length === 0 ? (
        <div className="p-10 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
          <ReceiptText className="w-10 h-10 stroke-[1.5]" />
          <p className="font-bold text-slate-800 dark:text-slate-200">
            {selectedCustomer.accountType === 'credit_card'
              ? (cardCycleTab === 'unbilled'
                  ? (lang === 'bn' ? 'চলতি আনবিল্ড সাইকেলে কোনো লেনদেন নেই' : 'No unbilled transactions this month')
                  : (lang === 'bn' ? 'গত মাসের বিল্ড সাইকেলে কোনো লেনদেন নেই' : 'No billed transactions from last month'))
              : t.noHistory}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {selectedCustomer.accountType === 'credit_card'
              ? (lang === 'bn' ? 'উপরের বাটন চেপে কার্ড বিল বা পরিশোধ যোগ করুন' : 'Use the buttons above to log card spend or bill payments')
              : t.duesVisibleHere}
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {groupedTransactions.map(group => (
              <div key={group.dateStr} className="flex flex-col">
                {/* Date Header Indicator */}
                <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-900/90 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    {group.dateObj.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                    {formatNumber(group.items.length, lang)} {lang === 'bn' ? 'টি এন্ট্রি' : 'entries'}
                  </span>
                </div>
                
                {/* Grouped Transactions List */}
                <div className="flex flex-col">
                  {group.items.map((tx: Transaction) => (
                    <div 
                      key={tx.id} 
                      id={`tx-row-${tx.id}`}
                      className={`p-4 flex flex-col hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-all duration-300 group cursor-default ${
                        highlightedTxId === tx.id 
                          ? 'ring-4 ring-inset ring-amber-500/80 dark:ring-amber-400/80 bg-amber-50 dark:bg-amber-950/40 rounded-2xl' 
                          : recentlyEditedTxId === tx.id
                          ? 'ring-[3px] ring-inset ring-emerald-500 dark:ring-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/35 rounded-2xl'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`p-2 rounded-xl shrink-0 ${
                            tx.type === 'due' 
                              ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-500' 
                              : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500'
                          }`}>
                            {tx.type === 'due' ? <ArrowUpRight className="w-4.5 h-4.5 stroke-[2.5]" /> : <ArrowDownLeft className="w-4.5 h-4.5 stroke-[2.5]" />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[15px] sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {tx.description || (tx.type === 'due' ? t.dueTrigger : t.paymentTrigger)}
                            </div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5 uppercase flex items-center gap-2 flex-wrap">
                              <span>{new Date(tx.date).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                              {(tx.isEdited || recentlyEditedTxId === tx.id || (tx.auditHistory && tx.auditHistory.length > 0)) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerHaptic('single');
                                    setAuditLogTx(tx);
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-500/10 hover:bg-slate-500/20 dark:bg-slate-400/10 dark:hover:bg-slate-400/20 text-slate-600 dark:text-slate-300 normal-case tracking-normal leading-none cursor-pointer transition-colors"
                                  title={lang === 'bn' ? 'সম্পাদনার ইতিহাস দেখুন' : 'View edit audit history'}
                                >
                                  <History className="w-2.5 h-2.5" />
                                  <span>{lang === 'bn' ? 'সম্পাদিত' : 'Edited'}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end shrink-0">
                          <div className={`text-base sm:text-lg font-black font-mono tabular-nums ${
                            tx.type === 'due' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {tx.type === 'due' ? '+' : '-'} ৳ {formatNumber(tx.amount, lang)}
                          </div>
                          <div className="flex items-center gap-2 mt-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerHaptic('single');
                                openEditTxModal(tx);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              title={lang === 'bn' ? 'পরিবর্তন' : 'Edit'}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerHaptic('double');
                                openDeleteTxModal(tx);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              title={lang === 'bn' ? 'মুছুন' : 'Delete'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {(() => {
            const showMoreVisible = hasMoreTxs;
            const showLessVisible = customerTxLimit > 5;
            if (!showMoreVisible && !showLessVisible) return null;

            return (
              <div className="p-4 text-center flex justify-center gap-3 border-t border-slate-100 dark:border-slate-800/80">
                {showMoreVisible && (
                  <button 
                    type="button"
                    onClick={() => {
                      triggerHaptic('single');
                      loadMoreTransactions();
                    }}
                    className="flex items-center gap-1 px-5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-full transition-colors cursor-pointer"
                  >
                    {lang === 'bn' ? 'আরও দেখুন' : 'Show More'}
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}
                {showLessVisible && (
                  <button 
                    type="button"
                    onClick={() => {
                      triggerHaptic('single');
                      resetCustomerTxLimit();
                    }}
                    className="flex items-center gap-1 px-5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-full transition-colors cursor-pointer"
                  >
                    {lang === 'bn' ? 'কম দেখুন' : 'Show Less'}
                    <ChevronUp className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })()}
        </>
      )}
    </div>

    {/* ARCHIVED STATEMENTS STORED ON THIS CUSTOMER'S PROFILE */}
    {(() => {
      const profileArchives = archivedStatements.filter((a: any) => a && a.customerId === selectedCustomer.id);
      if (profileArchives.length === 0) return null;
      const totalArchivedTxCount = profileArchives.reduce(
        (sum: number, a: any) => sum + (typeof a.entriesCount === 'number' ? a.entriesCount : 1),
        0
      );

      return (
        <div className="bg-white dark:bg-[#0D121D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center shrink-0">
                <Archive className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-950 dark:text-white truncate">
                  {lang === 'bn' ? 'আর্কাইভকৃত পুরনো স্টেটমেন্ট' : 'Archived Profile Statements'}
                </h4>
                <p className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {formatNumber(totalArchivedTxCount, lang)} {lang === 'bn' ? 'টি সংরক্ষিত এন্ট্রি' : 'archived entries'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                triggerHaptic('single');
                try {
                  let records: any[] = [];
                  if (exportArchivedStatements) {
                    const res = await exportArchivedStatements(selectedCustomer.id);
                    if (Array.isArray(res) && res.length > 0) {
                      records = res;
                    }
                  }
                  if (records.length === 0) {
                    records = profileArchives.map((item: any) => ({
                      id: item.id,
                      customerId: item.customerId,
                      customerName: item.customerName || selectedCustomer.name,
                      type: item.type,
                      amount: item.amount,
                      description: item.description || '',
                      date: parseFirestoreDate(item.date || item.archivedAt).toISOString(),
                      archivedAt: parseFirestoreDate(item.archivedAt || item.date).toISOString()
                    }));
                  }
                  const exportPayload = {
                    app: 'ChallanTrack Archived Profile Statements',
                    exportedAt: new Date().toISOString(),
                    customerName: selectedCustomer.name,
                    customerPhone: selectedCustomer.phone || '',
                    totalArchivedEntries: records.length,
                    archivedTransactions: records
                  };
                  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  const safeName = selectedCustomer.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'client';
                  a.href = url;
                  a.download = `challantrack-archive-${safeName}-${new Date().toISOString().split('T')[0]}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast.success(
                    lang === 'bn'
                      ? `${formatNumber(records.length, lang)}টি আর্কাইভ এন্ট্রি ডাউনলোড সম্পন্ন হয়েছে`
                      : `Downloaded ${records.length} archived statements`
                  );
                } catch (err) {
                  console.error(err);
                  toast.error(lang === 'bn' ? 'ডাউনলোড করতে সমস্যা হয়েছে' : 'Failed to download archive');
                }
              }}
              className="px-3 py-2 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold text-xs rounded-xl border-2 border-slate-950 dark:border-white flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 shadow-2xs active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'ডাউনলোড' : 'Download'}</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border-t border-slate-100 dark:border-slate-800/80 pt-2">
            {profileArchives.slice(0, 4).map((arch: any) => {
              const txDate = parseFirestoreDate(arch.date || arch.archivedAt);
              const isBatch = typeof arch.entriesCount === 'number';
              return (
                <div key={arch.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    {isBatch ? (
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-200">
                        {formatNumber(arch.entriesCount, lang)} {lang === 'bn' ? 'টি এন্ট্রি' : 'entries'}
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {arch.description || (arch.type === 'due' ? t.dueTrigger : t.paymentTrigger)}
                      </span>
                    )}
                    <span className="text-slate-400 shrink-0">•</span>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                      {txDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  {isBatch ? (
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                      {lang === 'bn' ? 'বাকি' : 'Due'}: ৳{formatNumber(arch.totalMergedDue || 0, lang)} |{' '}
                      {lang === 'bn' ? 'জমা' : 'Paid'}: ৳{formatNumber(arch.totalMergedPayment || 0, lang)}
                    </div>
                  ) : (
                    <div
                      className={`font-mono font-bold text-xs shrink-0 ${
                        arch.type === 'due'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {arch.type === 'due' ? '+' : '-'} ৳{formatNumber(arch.amount || 0, lang)}
                    </div>
                  )}
                </div>
              );
            })}
            {profileArchives.length > 4 && (
              <div className="pt-2 text-[11px] font-mono text-slate-400 dark:text-slate-500 text-center">
                {lang === 'bn'
                  ? `+ আরও ${formatNumber(profileArchives.length - 4, lang)}টি আর্কাইভকৃত লেনদেন (ডাউনলোড ফাইলে সম্পূর্ণ তালিকা)`
                  : `+ ${profileArchives.length - 4} more archived entries available in download`}
              </div>
            )}
          </div>
        </div>
      );
    })()}
  </div>
 
 </div>
 )}

  {/* Edit Transaction Modal */}
  {editingTx && (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeTxModals();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-slide-up bg-white dark:bg-[#0D121D] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 border border-slate-200/80 dark:border-slate-800"
      >
        <div className="flex items-center justify-between pb-3.5 mb-5 border-b border-slate-100 dark:border-slate-800/80">
          <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
            {lang === 'bn' ? 'লেনদেন পরিবর্তন' : 'Edit Transaction'}
          </h3>
          <button type="button" aria-label="Close" onClick={closeTxModals} className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.amount} (৳)</label>
            <input
              id="edit-tx-amount-input"
              type="text"
              inputMode="decimal"
              data-numpad="true"
              value={editTxAmount}
              onChange={(e) => {
                const clean = e.target.value.replace(/[^0-9.]/g, '');
                setEditTxAmount(clean);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white text-lg font-mono font-bold focus:outline-none focus:border-slate-950 dark:focus:border-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.notes}</label>
            <input
              id="edit-tx-desc-input"
              type="text"
              value={editTxDesc}
              onChange={(e) => setEditTxDesc(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white text-sm focus:outline-none focus:border-slate-950 dark:focus:border-white"
            />
          </div>
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={closeTxModals}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white cursor-pointer transition-colors"
            >
              {lang === 'bn' ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              onClick={() => {
                const newAmount = parseFloat(editTxAmount.replace(/,/g, ''));
                const trimmedDesc = editTxDesc.trim();
                const origDesc = (editingTx.description || '').trim();
                if (newAmount > 0 && editTransaction) {
                  const hasChanged = Math.abs(newAmount - editingTx.amount) > 0.001 || trimmedDesc !== origDesc;
                  const editedId = editingTx.id;
                  if (hasChanged) {
                    triggerHaptic('double');
                    editTransaction(editedId, editingTx.type, newAmount, trimmedDesc);
                    setRecentlyEditedTxId(editedId);
                    setTimeout(() => {
                      setRecentlyEditedTxId(prev => (prev === editedId ? null : prev));
                    }, 1500);
                  }
                  closeTxModals();
                }
              }}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl border-2 border-transparent hover:border-slate-950 dark:hover:border-white cursor-pointer transition-colors"
            >
              {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

 {/* Delete Transaction Modal */}
  {deletingTx && (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs"
      onClick={closeTxModals}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="bg-white dark:bg-[#0D121D] w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 border border-slate-200/80 dark:border-slate-800"
      >
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex items-center justify-center mx-auto mb-3.5">
            <Trash2 className="w-7 h-7 text-rose-600 dark:text-rose-400" />
          </div>
          <h3 className="text-base font-extrabold text-slate-950 dark:text-white mb-1.5">
            {lang === 'bn' ? 'হিসাব মুছুন' : 'Delete Transaction'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'আপনি কি নিশ্চিত এই লেনদেন মুছে ফেলতে চান?' : 'Are you sure you want to delete this transaction?'}
          </p>
          
          {/* Details Card showing what is being deleted */}
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 text-left space-y-2 mt-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{lang === 'bn' ? 'ধরন' : 'Type'}</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                deletingTx.type === 'due' 
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800' 
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
              }`}>
                {deletingTx.type === 'due' ? (lang === 'bn' ? 'বকেয়া (+)' : 'Due (+)') : (lang === 'bn' ? 'আদায় (-)' : 'Payment (-)')}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{lang === 'bn' ? 'পরিমাণ' : 'Amount'}</span>
              <span className={`text-sm font-black font-mono ${
                deletingTx.type === 'due' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                ৳ {formatNumber(deletingTx.amount, lang)}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{lang === 'bn' ? 'তারিখ' : 'Date'}</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {new Date(deletingTx.date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { dateStyle: 'medium' })}
              </span>
            </div>
            {deletingTx.description && (
              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex justify-between items-start gap-4">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase shrink-0">{lang === 'bn' ? 'বিবরণ' : 'Notes'}</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 text-right truncate max-w-[200px]">{deletingTx.description}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => {
              if (deleteTransaction) {
                deleteTransaction(deletingTx.id);
                closeTxModals();
              }
            }}
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl border-2 border-transparent hover:border-slate-950 dark:hover:border-white cursor-pointer text-xs transition-colors"
          >
            {lang === 'bn' ? 'হ্যাঁ, মুছুন' : 'Yes, Delete'}
          </button>
          <button
            onClick={closeTxModals}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white cursor-pointer text-xs transition-colors"
          >
            {lang === 'bn' ? 'বাতিল' : 'Cancel'}
          </button>
        </div>
      </motion.div>
    </div>
  )}


  {/* Phone Warning Modal */}
  {phoneWarningCustomer && (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs"
      onClick={closePhoneWarningModal}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#0D121D] w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 border border-slate-200/80 dark:border-slate-800"
      >
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex items-center justify-center mx-auto mb-3.5">
            <Phone className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-base font-extrabold text-amber-600 dark:text-amber-400 mb-1.5">
            {lang === 'bn' ? 'মোবাইল নম্বর নেই' : 'No Phone Number'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {lang === 'bn' 
              ? 'হোয়াটসঅ্যাপ রিমাইন্ডার পাঠাতে অনুগ্রহ করে প্রথমে এই গ্রাহকের প্রোফাইলে একটি মোবাইল নম্বর যুক্ত করুন।' 
              : 'Please add/link a phone number to this customer profile first to send WhatsApp reminders.'}
          </p>
          
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 text-left mt-4 flex justify-between items-baseline">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{lang === 'bn' ? 'গ্রাহক' : 'Customer'}</span>
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{phoneWarningCustomer.name}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => {
              const targetCustomer = phoneWarningCustomer;
              if (window.history.state?.modal === 'phoneWarningCustomer') {
                window.history.replaceState({ tab: 'customers', customerId: targetCustomer.id, quickEntry: false }, '', `?tab=customers&c=${targetCustomer.id}`);
              }
              window.history.replaceState({ tab: 'customers', customerId: targetCustomer.id, modal: 'editingCustomer', quickEntry: false }, '', `?tab=customers&c=${targetCustomer.id}`);
              
              setSelectedCustomerId(targetCustomer.id);
              setPhoneWarningCustomer(null);
              
              setEditName(targetCustomer.name);
              setEditPhone('');
              setEditError('');
              setIsEditingCustomer(true);
              setTimeout(() => {
                const phoneInput = document.getElementById('edit_customer_phone');
                if (phoneInput) phoneInput.focus();
              }, 150);
            }}
            className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold rounded-xl border-2 border-slate-950 dark:border-white cursor-pointer text-xs transition-colors"
          >
            {lang === 'bn' ? 'মোবাইল নম্বর যুক্ত করুন' : 'Add Phone Number'}
          </button>
          <button
            onClick={() => {
              setPhoneWarningCustomer(null);
              if (window.history.state?.modal === 'phoneWarningCustomer') {
                window.history.back();
              }
            }}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white cursor-pointer text-xs transition-colors"
          >
            {lang === 'bn' ? 'বাতিল' : 'Cancel'}
          </button>
        </div>
      </motion.div>
    </div>
  )}

  {/* Pin Action Modal */}
  {pinActionCustomer && (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={closePinActionModal}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#0D121D] w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 border border-slate-200/80 dark:border-slate-800"
      >
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex items-center justify-center mx-auto mb-3.5">
            <Pin className={`w-7 h-7 text-amber-500 ${pinnedCustomerNames.includes(pinActionCustomer.name) ? 'rotate-45 fill-amber-500' : ''}`} />
          </div>
          <h3 className="text-base font-extrabold text-slate-950 dark:text-white mb-1.5">
            {pinnedCustomerNames.includes(pinActionCustomer.name) 
              ? (lang === 'bn' ? 'গ্রাহক আনপিন করুন' : 'Unpin Customer') 
              : (lang === 'bn' ? 'গ্রাহক পিন করুন' : 'Pin Customer')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {pinnedCustomerNames.includes(pinActionCustomer.name)
              ? (lang === 'bn' 
                  ? `আপনি কি নিশ্চিত ${pinActionCustomer.name}-কে তালিকা থেকে আনপিন করতে চান?` 
                  : `Are you sure you want to unpin ${pinActionCustomer.name} from the top?`)
              : (lang === 'bn' 
                  ? `আপনি কি নিশ্চিত ${pinActionCustomer.name}-কে তালিকার শীর্ষে পিন করতে চান?` 
                  : `Are you sure you want to pin ${pinActionCustomer.name} to the top of the list?`)}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              togglePinCustomer(pinActionCustomer.id);
              setPinActionCustomer(null);
              if (window.history.state?.modal === 'pinActionCustomer') {
                window.history.back();
              }
            }}
            className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold rounded-xl border-2 border-slate-950 dark:border-white cursor-pointer text-xs transition-colors"
          >
            {pinnedCustomerNames.includes(pinActionCustomer.name)
              ? (lang === 'bn' ? 'হ্যাঁ, আনপিন করুন' : 'Yes, Unpin')
              : (lang === 'bn' ? 'হ্যাঁ, পিন করুন' : 'Yes, Pin to top')}
          </button>
          <button
            type="button"
            onClick={() => {
              setPinActionCustomer(null);
              if (window.history.state?.modal === 'pinActionCustomer') {
                window.history.back();
              }
            }}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white cursor-pointer text-xs transition-colors"
          >
            {lang === 'bn' ? 'বাতিল' : 'Cancel'}
          </button>
        </div>
      </motion.div>
    </div>
  )}

  {/* Delete Customer Account Modal */}
  {deletingCustomer && (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs"
      onClick={closeDeleteCustomerModal}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#0D121D] w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 border border-slate-200/80 dark:border-slate-800"
      >
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex items-center justify-center mx-auto mb-3.5">
            <AlertTriangle className="w-7 h-7 text-rose-600 dark:text-rose-400" />
          </div>
          <h3 className="text-base font-extrabold text-rose-600 dark:text-rose-400 mb-1.5">
            {lang === 'bn' ? 'গ্রাহক অ্যাকাউন্ট ট্র্যাশে সরান' : 'Move Customer to Trash'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {lang === 'bn' 
              ? 'আপনি কি নিশ্চিত এই গ্রাহকের সম্পূর্ণ অ্যাকাউন্ট ট্র্যাশে স্থানান্তর করতে চান? এটি ১৪ দিন পর স্থায়ীভাবে মুছে যাবে।' 
              : 'Are you sure you want to move this customer account to the trash? It will be permanently deleted after 14 days.'}
          </p>
          
          {/* Details Card showing customer name, phone, and outstanding balance */}
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 text-left space-y-2 mt-4">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{lang === 'bn' ? 'নাম' : 'Name'}</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{deletingCustomer.name}</span>
            </div>
            {deletingCustomer.phone && (
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{lang === 'bn' ? 'মোবাইল' : 'Mobile'}</span>
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{deletingCustomer.phone}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{lang === 'bn' ? 'বর্তমান ব্যালেন্স' : 'Current Balance'}</span>
              <span className={`text-sm font-black font-mono ${
                deletingCustomer.outstandingDue > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : deletingCustomer.outstandingDue < 0
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-slate-500'
              }`}>
                {deletingCustomer.outstandingDue === 0 ? (lang === 'bn' ? 'পরিশোধিত' : 'Settled') : `৳ ${formatNumber(deletingCustomer.outstandingDue, lang)}`}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={async () => {
              triggerHaptic('double');
              const id = deletingCustomer.id;
              setDeletingCustomer(null);
              if (window.history.state?.modal === 'deleteCustomer') {
                window.history.back();
              }
              await deleteCustomer(id);
              setSelectedCustomerId(null);
              toast.info(lang === 'bn' ? 'গ্রাহক ট্র্যাশে স্থানান্তরিত হয়েছে' : 'Customer account moved to trash');
            }}
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl border-2 border-transparent hover:border-slate-950 dark:hover:border-white cursor-pointer text-xs transition-colors"
          >
            {lang === 'bn' ? 'হ্যাঁ, ট্র্যাশে পাঠান' : 'Yes, Trash'}
          </button>
          <button
            onClick={() => {
              triggerHaptic('single');
              setDeletingCustomer(null);
              if (window.history.state?.modal === 'deleteCustomer') {
                window.history.back();
              }
            }}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white cursor-pointer text-xs transition-colors"
          >
            {lang === 'bn' ? 'বাতিল' : 'Cancel'}
          </button>
        </div>
      </motion.div>
    </div>
  )}
  {/* Duplicate Entry Warning Modal */}
  {duplicateTxWarning && (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#0D121D] w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 border border-slate-200/80 dark:border-slate-800"
      >
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex items-center justify-center mx-auto mb-3.5">
            <AlertTriangle className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-base font-extrabold text-amber-600 dark:text-amber-400 mb-1.5">
            {t.duplicateWarningTitle}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {t.duplicateWarningDesc}
          </p>
          
          {/* Details Card */}
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 text-left space-y-2 mt-4">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{t.type}</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                duplicateTxWarning.type === 'due' 
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800' 
                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
              }`}>
                {duplicateTxWarning.type === 'due' ? t.duePlus : t.paymentMinus}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{t.amount}</span>
              <span className={`text-sm font-black font-mono ${
                duplicateTxWarning.type === 'due' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                ৳ {formatNumber(duplicateTxWarning.amount, lang)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (setHighlightedTxId) {
                setHighlightedTxId(duplicateTxWarning.id);
              }
              setDuplicateTxWarning(null);
            }}
            className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold rounded-xl border-2 border-slate-950 dark:border-white cursor-pointer text-xs transition-colors"
          >
            {t.viewExistingEntry}
          </button>
          <button
            type="button"
            onClick={async () => {
              setHasShownDuplicateWarning(true);
              setDuplicateTxWarning(null);
              await executeInlineTransaction(true);
            }}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white cursor-pointer text-xs transition-colors"
          >
            {t.addAnyway}
          </button>
          <button
            type="button"
            onClick={() => {
              setDuplicateTxWarning(null);
            }}
            className="w-full py-2.5 bg-white dark:bg-[#0D121D] hover:bg-slate-50 dark:hover:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white text-slate-600 dark:text-slate-400 font-bold rounded-xl text-xs cursor-pointer transition-colors"
          >
            {t.cancel}
          </button>
        </div>
      </motion.div>
    </div>
  )}

  {/* RECEIPT IMAGE PREVIEW MODAL */}
  {receiptResult && (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={closeReceiptModal}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-[#0D121D] w-full max-w-sm sm:max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200/80 dark:border-slate-800"
      >
        {/* Modal Header */}
        <div className="p-3.5 px-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 shrink-0">
              <ReceiptText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm text-slate-950 dark:text-white truncate">
                {lang === 'bn' ? 'ডিজিটাল রসিদ স্লিপ' : 'Digital Receipt Slip'}
              </h3>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                {receiptResult.fileName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeReceiptModal}
            className="p-1.5 rounded-lg border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white text-slate-500 dark:text-slate-400 transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Image Preview Container with subtle studio grid backdrop (White in Light Mode, Dark in Dark Mode) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-white dark:bg-[#07090E] bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:14px_14px] flex justify-center items-start hide-scrollbar transition-colors">
          <div className="max-w-[272px] sm:max-w-[290px] w-full filter drop-shadow-[0_12px_24px_rgba(15,23,42,0.14)] dark:drop-shadow-[0_22px_30px_rgba(0,0,0,0.75)] transition-transform">
            <img 
              src={receiptResult.dataUrl} 
              alt="Customer Receipt" 
              className="w-full h-auto block select-none"
            />
          </div>
        </div>

        {/* Actions Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-white dark:bg-[#0D121D] space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('double');
                downloadReceiptImage(receiptResult.dataUrl, receiptResult.fileName);
                showNotification(lang === 'bn' ? 'রসিদ ডাউনলোড সম্পন্ন' : 'Receipt Downloaded', {
                  body: lang === 'bn' ? `${receiptResult.fileName} সফলভাবে ডাউনলোড হয়েছে` : `${receiptResult.fileName} downloaded successfully.`,
                  icon: '/icon-192.png'
                });
                toast.success(lang === 'bn' ? 'রসিদ ইমেজ ডাউনলোড সম্পন্ন হয়েছে' : 'Receipt downloaded successfully');
              }}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl border-2 border-transparent hover:border-slate-950 dark:hover:border-white text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              <span>{lang === 'bn' ? 'ডাউনলোড PNG' : 'Download PNG'}</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                triggerHaptic('single');
                const success = await copyReceiptImage(receiptResult.blob);
                if (success) {
                  setIsCopiedReceipt(true);
                  toast.success(lang === 'bn' ? 'ছবি ক্লিপবোর্ডে কপি হয়েছে (হোয়াটসঅ্যাপে পেস্ট করুন)' : 'Image copied to clipboard');
                  setTimeout(() => setIsCopiedReceipt(false), 2500);
                } else {
                  toast.error(lang === 'bn' ? 'কপি সমর্থিত নয়, ডাউনলোড বাটন ব্যবহার করুন' : 'Copy not supported on this browser');
                }
              }}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-[0.98]"
              title={lang === 'bn' ? 'ক্লিপবোর্ডে কপি করুন' : 'Copy Image'}
            >
              {isCopiedReceipt ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{isCopiedReceipt ? (lang === 'bn' ? 'কপি হয়েছে' : 'Copied!') : (lang === 'bn' ? 'কপি' : 'Copy')}</span>
            </button>

            {typeof navigator !== 'undefined' && 'canShare' in navigator && (
              <button
                type="button"
                onClick={async () => {
                  triggerHaptic('single');
                  await shareReceiptImage(receiptResult.blob, receiptResult.fileName, selectedCustomer?.name || 'Customer');
                }}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-[0.98]"
                title={lang === 'bn' ? 'শেয়ার করুন' : 'Share'}
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">{lang === 'bn' ? 'শেয়ার' : 'Share'}</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )}

  {/* Modern Contact Phone Selector Modal */}
  {pendingContactChoice && (
    <ContactNumberPickerModal
      isOpen={true}
      contactName={pendingContactChoice.contactName}
      numbers={pendingContactChoice.numbers}
      isNewAccount={pendingContactChoice.isNewAccount}
      onSelectNumber={(chosen, finalName) => {
        pendingContactChoice.onSelect(chosen, finalName);
        setPendingContactChoice(null);
      }}
      onClose={() => setPendingContactChoice(null)}
      lang={lang}
    />
  )}

  {/* Client-Specific Statement Merge & Fresh Ledger Modal */}
  {isManageStatementsOpen && selectedCustomer && archiveCustomerExcessStatements && (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs no-select"
      onClick={() => { if (!isManualArchiving) setIsManageStatementsOpen(false); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-slide-up bg-white dark:bg-[#0D121D] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden"
      >

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
              {lang === 'bn' ? 'খতিয়ান স্টেটমেন্ট ব্যবস্থাপনা' : 'Manage Client Ledger'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {selectedCustomer.name} • {formatNumber(activeCustomerTxCount, lang)} {lang === 'bn' ? 'টি সক্রিয় এন্ট্রি' : 'active entries'}
            </p>
          </div>
          <button
            type="button"
            disabled={isManualArchiving}
            onClick={() => {
              triggerHaptic('medium');
              setIsManageStatementsOpen(false);
            }}
            className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto hide-scrollbar">
          {/* Option 1: Keep Last N Entries (Manual Merge) */}
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 space-y-3.5">
            <div className="space-y-1">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <Archive className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'নির্দিষ্ট সংখ্যক এন্ট্রি রেখে বাকিগুলো মার্জ করুন' : 'Merge & Keep Recent Entries'}</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {lang === 'bn'
                  ? 'বর্তমান ব্যালেন্স অপরিবর্তিত রেখে সর্বশেষ কয়েকটি লেনদেন খতিয়ানে রাখুন এবং পুরনোগুলো আর্কাইভে সরিয়ে নিন।'
                  : 'Keep only the latest entries in this statement and archive older ones without changing the current balance.'}
              </p>
            </div>

            {/* Borderless + / - Stepper (No input field or squared border) + Merge Action */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="inline-flex items-center gap-2 shrink-0 select-none">
                <button
                  type="button"
                  disabled={isManualArchiving}
                  onClick={() => {
                    triggerHaptic('tick');
                    const cur = parseInt(manualKeepCountInput, 10) || 15;
                    setManualKeepCountInput(String(Math.max(1, cur - 5)));
                  }}
                  className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition-all cursor-pointer disabled:opacity-40"
                  aria-label="Decrease count"
                >
                  <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
                <span className="min-w-[2.25rem] text-center text-base font-mono font-black text-slate-950 dark:text-white tabular-nums">
                  {formatNumber(parseInt(manualKeepCountInput, 10) || 15, lang)}
                </span>
                <button
                  type="button"
                  disabled={isManualArchiving}
                  onClick={() => {
                    triggerHaptic('tick');
                    const cur = parseInt(manualKeepCountInput, 10) || 15;
                    setManualKeepCountInput(String(Math.min(500, cur + 5)));
                  }}
                  className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition-all cursor-pointer disabled:opacity-40"
                  aria-label="Increase count"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>

              <button
                type="button"
                disabled={isManualArchiving}
                onClick={async () => {
                  const keepCount = Math.max(1, parseInt(manualKeepCountInput, 10) || 15);
                  if (activeCustomerTxCount <= keepCount) {
                    toast.info(
                      lang === 'bn'
                        ? `এই প্রোফাইলে বর্তমানে মাত্র ${formatNumber(activeCustomerTxCount, lang)}টি এন্ট্রি আছে।`
                        : `This client only has ${activeCustomerTxCount} active entries (need more than ${keepCount} to merge).`
                    );
                    return;
                  }
                  setIsManualArchiving(true);
                  triggerHaptic('double');
                  try {
                    const count = await archiveCustomerExcessStatements(selectedCustomer.id, keepCount);
                    toast.success(
                      lang === 'bn'
                        ? `${formatNumber(count, lang)}টি পুরনো এন্ট্রি সফলভাবে আর্কাইভ করা হয়েছে`
                        : `Archived ${count} older entries (kept latest ${keepCount})`
                    );
                    setIsManageStatementsOpen(false);
                  } catch {
                    toast.error(lang === 'bn' ? 'মার্জ করতে সমস্যা হয়েছে' : 'Failed to merge entries');
                  } finally {
                    setIsManualArchiving(false);
                  }
                }}
                className="flex-1 py-2.5 px-3 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold text-xs rounded-xl border-2 border-slate-950 dark:border-white cursor-pointer transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {isManualArchiving
                  ? (lang === 'bn' ? 'প্রসেস হচ্ছে...' : 'Merging...')
                  : (lang === 'bn' ? 'মার্জ ও আর্কাইভ করুন' : 'Merge & Archive Older')}
              </button>
            </div>
          </div>

          {/* Option 2: Start Fresh Ledger after a settlement (download previous entries in background) */}
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="space-y-1">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'হিসাব নিষ্পত্তির পর নতুন খতিয়ান শুরু করুন' : 'Start Fresh Ledger (Post-Settlement)'}</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {lang === 'bn'
                  ? 'পূর্ববর্তী সকল লেনদেনের রেকর্ড স্বয়ংক্রিয়ভাবে ব্যাকআপ ডাউনলোড হবে এবং খতিয়ানটি নতুনভাবে পরিষ্কার হয়ে যাবে।'
                  : 'Automatically downloads a backup of previous entries in the background and archives all current rows so you can start a fresh statement.'}
              </p>
            </div>

            <button
              type="button"
              disabled={isManualArchiving || activeCustomerTxCount === 0}
              onClick={async () => {
                setIsManualArchiving(true);
                triggerHaptic('double');
                try {
                  // 1. Download current & archived entries for this client in the background
                  const existingArchives = archivedStatements.filter((a: any) => a && a.customerId === selectedCustomer.id);
                  const backupPayload = {
                    app: 'ChallanTrack Client Statement History',
                    exportedAt: new Date().toISOString(),
                    customerName: selectedCustomer.name,
                    customerPhone: selectedCustomer.phone || '',
                    currentBalanceAtExport: selectedCustomer.outstandingDue,
                    activeStatements: selectedCustomerTransactions,
                    previousArchives: existingArchives
                  };
                  const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  const safeName = selectedCustomer.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'client';
                  a.href = url;
                  a.download = `challantrack-fresh-ledger-${safeName}-${new Date().toISOString().split('T')[0]}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);

                  // 2. Archive all active entries (keepCount = 0)
                  const count = await archiveCustomerExcessStatements(selectedCustomer.id, 0);
                  toast.success(
                    lang === 'bn'
                      ? `নতুন খতিয়ান শুরু হয়েছে (${formatNumber(count, lang)}টি এন্ট্রি ডাউনলোড ও আর্কাইভ হয়েছে)`
                      : `Started fresh ledger (${count} entries downloaded & archived)`
                  );
                  setIsManageStatementsOpen(false);
                } catch {
                  toast.error(lang === 'bn' ? 'নতুন খতিয়ান শুরু করতে সমস্যা হয়েছে' : 'Failed to start fresh ledger');
                } finally {
                  setIsManualArchiving(false);
                }
              }}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 dark:bg-[#0D121D] dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs rounded-xl border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white cursor-pointer transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'পূর্বের হিসাব ডাউনলোড করে নতুন খতিয়ান শুরু করুন' : 'Download History & Start Fresh Ledger'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

  {/* Transaction Audit History Log Modal */}
  {auditLogTx && (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs no-select"
      onClick={() => setAuditLogTx(null)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-slide-up bg-white dark:bg-[#0D121D] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
                {lang === 'bn' ? 'লেনদেনের পরিবর্তনের ইতিহাস (Audit Log)' : 'Transaction Audit History'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'প্রতিটি পরিবর্তনের রেকর্ড ও বিবরণ' : 'Complete record of revisions made'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAuditLogTx(null)}
            className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {/* Current Version */}
          <div className="p-3.5 rounded-xl border-2 border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                {lang === 'bn' ? 'বর্তমান সক্রিয় হিসাব' : 'Current Active Record'}
              </span>
              <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                ৳ {formatNumber(auditLogTx.amount, lang)}
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {auditLogTx.description || (auditLogTx.type === 'due' ? t.dueTrigger : t.paymentTrigger)}
            </div>
            {auditLogTx.editedAt && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'সর্বশেষ সম্পাদনা: ' : 'Last edited: '}
                {new Date(auditLogTx.editedAt).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            )}
          </div>

          {/* Past Audit History */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {lang === 'bn' ? 'পূর্ববর্তী সংস্করণসমূহ' : 'Prior Revisions'}
              </h4>
              {auditLogTx.auditHistory && auditLogTx.auditHistory.length > 0 && (
                <span className="text-[11px] font-bold text-slate-400 font-mono">
                  {auditLogTx.auditHistory.length} / 5
                </span>
              )}
            </div>

            {/* Inform user if maximum 5 revisions limit is reached */}
            {auditLogTx.auditHistory && auditLogTx.auditHistory.length >= 5 && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 font-medium flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  {lang === 'bn' 
                    ? 'সর্বোচ্চ ৫টি পূর্ববর্তী সংস্করণ প্রদর্শিত হচ্ছে। এর আগের কোনো সংস্করণ থাকলে তা স্বয়ংক্রিয়ভাবে মুছে দেওয়া হয়েছে।'
                    : 'Showing maximum of 5 recent prior revisions. Older revisions are pruned.'}
                </span>
              </div>
            )}
            {auditLogTx.auditHistory && auditLogTx.auditHistory.length > 0 ? (
              <div className="space-y-2.5">
                {auditLogTx.auditHistory.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">
                        {lang === 'bn' ? `সংস্করণ #${auditLogTx.auditHistory!.length - idx}` : `Revision #${auditLogTx.auditHistory!.length - idx}`}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                        ৳ {formatNumber(item.amount, lang)}
                      </span>
                    </div>
                    {item.description && (
                      <div className="text-xs text-slate-700 dark:text-slate-300">
                        {item.description}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400 font-mono">
                      {new Date(item.editedAt).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-400">
                {lang === 'bn' ? 'কোনো পূর্ববর্তী সংস্করণ পাওয়া যায়নি।' : 'No earlier revision entries recorded.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )}
 </div>
 );
}
