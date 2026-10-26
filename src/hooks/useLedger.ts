import { useState, useEffect, useRef, useMemo } from 'react';
import { 
 collection, 
 doc, 
 setDoc,
 updateDoc, 
 deleteDoc, 
 onSnapshot, 
 query, 
 orderBy, 
 increment, 
 serverTimestamp,
 writeBatch,
 limit,
 where,
 getCountFromServer,
 getDocs
} from 'firebase/firestore';
import { db, auth, OperationType } from '../firebase';
import { Customer, Transaction, Reminder, UserSettings, SavingGoal, GoalContribution, ImportProgress, TransactionAuditEntry } from '../types';
import { cleanBangladeshiPhone } from '../lib/phoneUtils';

export function useLedger(
  userId: string | undefined, 
  selectedDailyDate?: Date,
  activeCustomerId?: string | null
) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [trashCustomers, setTrashCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customerTransactions, setCustomerTransactions] = useState<Transaction[]>([]);
  const [allCustomerTxs, setAllCustomerTxs] = useState<Transaction[]>([]);
  const [archiveTransactions, setArchiveTransactions] = useState<Transaction[]>([]);
    const [monthlySummaries, setMonthlySummaries] = useState<any[]>([]);

  // Robust date parser to handle Firestore plain-serialized, timestamp and Date formats safely
  const parseTxDate = (dateField: any): Date => {
    if (!dateField) return new Date();
    if (dateField instanceof Date) return dateField;
    if (typeof dateField.toDate === 'function') return dateField.toDate();
    if (typeof dateField.seconds === 'number') return new Date(dateField.seconds * 1000);
    const parsed = new Date(dateField);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const normalizeTxDescription = (desc: any): string => {
    if (typeof desc !== 'string') return '';
    if (desc === 'পূর্ববর্তী জের সমন্বয় / Initial Balance Adjustment') {
      return 'Initial Balance Adjustment';
    }
    if (desc === 'Last Month Billed Statement Payment') {
      return 'Last Month Bill Payment';
    }
    return desc;
  };

  // Atomically adjust monthly summaries state locally for instant offline sync
  const adjustLocalMonthlySummaries = (
    oldTx: Transaction | null,
    newTx: Transaction | null
  ) => {
    const getTxMonthKey = (tx: Transaction) => {
      const d = parseTxDate(tx.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const targetMonth = newTx ? getTxMonthKey(newTx) : (oldTx ? getTxMonthKey(oldTx) : null);
    if (!targetMonth) return;

    setMonthlySummaries(prev => {
      const list = [...prev];
      let summary = list.find(s => s.id === targetMonth);
      if (!summary) {
        summary = {
          id: targetMonth,
          dues: 0,
          payments: 0,
          count: 0,
          customerPayments: {}
        };
        list.push(summary);
      }

      if (oldTx) {
        summary.count = Math.max(0, (summary.count || 0) - 1);
        if (oldTx.type === 'due') {
          summary.dues = (summary.dues || 0) - oldTx.amount;
        } else {
          summary.payments = (summary.payments || 0) - oldTx.amount;
          if (summary.customerPayments && summary.customerPayments[oldTx.customerId]) {
            summary.customerPayments[oldTx.customerId].total = Math.max(
              0,
              (summary.customerPayments[oldTx.customerId].total || 0) - oldTx.amount
            );
          }
        }
      }

      if (newTx) {
        summary.count = (summary.count || 0) + 1;
        if (newTx.type === 'due') {
          summary.dues = (summary.dues || 0) + newTx.amount;
        } else {
          summary.payments = (summary.payments || 0) + newTx.amount;
          if (!summary.customerPayments) summary.customerPayments = {};
          if (!summary.customerPayments[newTx.customerId]) {
            summary.customerPayments[newTx.customerId] = {
              name: newTx.customerName || 'Unknown',
              total: 0
            };
          }
          summary.customerPayments[newTx.customerId].total = (summary.customerPayments[newTx.customerId].total || 0) + newTx.amount;
        }
      }

      const filteredList = list.filter(s => s.count > 0);
      localStorage.setItem(`easy_due_monthly_summaries_${userId}`, JSON.stringify(filteredList));
      return filteredList;
    });
  };
  const [activeCustomerTxCount, setActiveCustomerTxCount] = useState<number>(0);
  const [goals, setGoals] = useState<SavingGoal[]>([]);
  const [goalsSynced, setGoalsSynced] = useState(false);

  const saveLocalGoals = (list: SavingGoal[]) => {
    localStorage.setItem(`easy_due_goals_${userId}`, JSON.stringify(list));
  };
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [archivedStatements, setArchivedStatements] = useState<Transaction[]>([]);
  const archivedTxIdsRef = useRef<Set<string>>(new Set());
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const settingsRef = useRef<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [customersSynced, setCustomersSynced] = useState(false);
  const [transactionsSynced, setTransactionsSynced] = useState(false);
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);
  const [customerTxLimit, setCustomerTxLimit] = useState(5);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Sync count of total transactions for the selected customer in guest/offline mode
  useEffect(() => {
    if (!userId || !activeCustomerId) {
      setActiveCustomerTxCount(0);
      return;
    }
    if (userId === 'local-guest-session' || isOfflineFallback) {
      try {
        const stored = localStorage.getItem(`easy_due_transactions_${userId}`);
        if (stored) {
          const count = JSON.parse(stored).filter(
            (t: any) => t.customerId === activeCustomerId && !archivedTxIdsRef.current.has(t.id)
          ).length;
          setActiveCustomerTxCount(count);
        }
      } catch (e) {
        console.warn(e);
      }
    }
  }, [userId, activeCustomerId, isOfflineFallback, transactions]);

const lastSubmitRef = useRef<{
   timestamp: number;
   customerId: string;
   type: 'due' | 'payment';
   amount: number;
 } | null>(null);

 // Helper: Load all ledger data from local storage
 const loadLocalData = () => {
 if (!userId) return;
 try {
 const storedCustomers = localStorage.getItem(`easy_due_customers_${userId}`);
 const storedTxs = localStorage.getItem(`easy_due_transactions_${userId}`);
 const storedReminders = localStorage.getItem(`easy_due_reminders_${userId}`);
 const storedSettings = localStorage.getItem(`easy_due_settings_${userId}`);
      const storedSummaries = localStorage.getItem(`easy_due_monthly_summaries_${userId}`);
      const storedGoals = localStorage.getItem(`easy_due_goals_${userId}`);
      const storedArchived = localStorage.getItem(`easy_due_archived_statements_${userId}`);

 if (storedCustomers) {
 const parsed = JSON.parse(storedCustomers).map((c: any) => ({
 ...c,
 createdAt: new Date(c.createdAt),
 updatedAt: new Date(c.updatedAt),
 deletedAt: c.deletedAt ? new Date(c.deletedAt) : null
 }));
 setCustomers(parsed.filter((c: any) => !c.isDeleted));
 setTrashCustomers(parsed.filter((c: any) => c.isDeleted));
 } else {
 setCustomers([]);
 setTrashCustomers([]);
 }

 if (storedTxs) {
 setTransactions(JSON.parse(storedTxs).map((t: any) => ({
 ...t,
 description: normalizeTxDescription(t.description),
 date: new Date(t.date),
 createdAt: new Date(t.createdAt)
 })));
 } else {
 setTransactions([]);
 }

 if (storedReminders) {
 setReminders(JSON.parse(storedReminders).map((r: any) => ({
 ...r,
 dueDate: new Date(r.dueDate),
 createdAt: new Date(r.createdAt)
 })));
 } else {
 setReminders([]);
      }

      if (storedSummaries) {
        setMonthlySummaries(JSON.parse(storedSummaries));
      } else {
        setMonthlySummaries([]);
      }

      if (storedGoals) {
        setGoals(JSON.parse(storedGoals).map((g: any) => ({
          ...g,
          createdAt: new Date(g.createdAt),
          updatedAt: new Date(g.updatedAt)
        })));
      } else {
        setGoals([]);
      }

      const storedArchivedIds = localStorage.getItem(`easy_due_archived_ids_${userId}`);
      const idSet = new Set<string>();
      if (storedArchivedIds) {
        try {
          JSON.parse(storedArchivedIds).forEach((id: string) => idSet.add(id));
        } catch {}
      }

      if (storedArchived) {
        const parsedArch: Transaction[] = JSON.parse(storedArchived).map((t: any) => {
          if (t.id) idSet.add(t.id);
          return {
            ...t,
            date: new Date(t.date),
            createdAt: new Date(t.createdAt)
          };
        });
        archivedTxIdsRef.current = idSet;
        setArchivedStatements(parsedArch);
      } else {
        archivedTxIdsRef.current = idSet;
        setArchivedStatements([]);
      }

      if (storedTxs) {
        const parsedTxs = JSON.parse(storedTxs)
          .filter((t: any) => !archivedTxIdsRef.current.has(t.id))
          .map((t: any) => ({
            ...t,
            description: normalizeTxDescription(t.description),
            date: new Date(t.date),
            createdAt: new Date(t.createdAt)
          }));
        setTransactions(parsedTxs);
      }

 if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        if (!parsed.theme || (parsed.theme !== 'light' && parsed.theme !== 'dark')) {
          parsed.theme = 'dark';
        }
        setSettings(parsed);
 } else {
        setSettings({
          uid: userId,
          email: auth.currentUser?.email || 'guest@challantrack.local',
          theme: 'dark',
          dailyReminderTime: '09:00',
          autoMergeStatements: false,
          statementKeepCount: 15,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
 }
 } catch (e) {
 console.warn("Failed to parse local stored ledger data:", e);
 }
 };

 // Local storage save operations
 const saveLocalCustomers = (list: Customer[]) => {
 localStorage.setItem(`easy_due_customers_${userId}`, JSON.stringify(list));
 };
 const saveLocalTransactions = (list: Transaction[]) => {
 localStorage.setItem(`easy_due_transactions_${userId}`, JSON.stringify(list));
 };
 const saveLocalReminders = (list: Reminder[]) => {
 localStorage.setItem(`easy_due_reminders_${userId}`, JSON.stringify(list));
 };
 const saveLocalSettings = (val: UserSettings) => {
 localStorage.setItem(`easy_due_settings_${userId}`, JSON.stringify(val));
 };
 const saveLocalArchivedStatements = (list: Transaction[]) => {
   localStorage.setItem(`easy_due_archived_statements_${userId}`, JSON.stringify(list));
   list.forEach(item => {
     if (item?.id) archivedTxIdsRef.current.add(item.id);
   });
   localStorage.setItem(
     `easy_due_archived_ids_${userId}`,
     JSON.stringify(Array.from(archivedTxIdsRef.current))
   );
 };

  // Load cache immediately on userId change to populate UI with 0ms delay, and set up sync timeout
  useEffect(() => {
    if (userId) {
      loadLocalData();
      setLoading(false);
      
      // Initialize sync tracking states
      setCustomersSynced(false);
      setTransactionsSynced(true);
      
      // If we are offline, mark synced immediately to skip waiting
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setCustomersSynced(true);
        setTransactionsSynced(true);
        return;
      }
      
      // Max wait time for server sync to complete (prevents long loader for slow internet)
      const timer = setTimeout(() => {
        setCustomersSynced(true);
        setTransactionsSynced(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else {
      setCustomers([]);
      setTransactions([]);
      setReminders([]);
      setSettings(null);
      setCustomersSynced(true);
      setTransactionsSynced(true);
      setLoading(false);
    }
  }, [userId]);

 // 1. Sync User settings
 useEffect(() => {
 if (!userId) {
 setLoading(false);
 return;
 }

 if (userId === 'local-guest-session' || isOfflineFallback) {
 loadLocalData();
 setLoading(false);
 return;
 }

 const userDocRef = doc(db, 'users', userId);
 const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
 if (docSnap.exists()) {
        const data = docSnap.data() as UserSettings;
        if (!data.theme || (data.theme !== 'light' && data.theme !== 'dark')) {
          data.theme = 'dark';
        }
        setSettings(data);
        saveLocalSettings(data);
 } else {
        // Initialize default user settings if not exists (Dark mode default for new accounts)
        const defaultSettings: UserSettings = {
          uid: userId,
          email: auth.currentUser?.email || '',
          theme: 'dark',
          dailyReminderTime: '09:00',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setDoc(userDocRef, defaultSettings)
 .then(() => {
 setSettings(defaultSettings);
 saveLocalSettings(defaultSettings);
 })
 .catch(err => {
 console.warn("Firestore error creating user settings, using offline cache fallback:", err);
 loadLocalData();
 });
 }
 }, (error) => {
 console.warn("Firestore error loading user settings, using offline cache fallback:", error);
 loadLocalData();
 });

 return () => unsubscribe();
 }, [userId]);

 // 2. Sync Customers collection
 useEffect(() => {
 if (!userId) return;
 if (userId === 'local-guest-session') {
 return;
 }

 const customersRef = collection(db, 'users', userId, 'customers');
 const q = query(customersRef, orderBy('createdAt', 'desc'));

 const storedCustomers = localStorage.getItem(`easy_due_customers_${userId}`);
 const unsubscribe = onSnapshot(q, (snapshot) => {
   const list: Customer[] = [];
   snapshot.forEach((docSnap) => {
   const data = docSnap.data();
   list.push({
   ...data,
   id: docSnap.id,
   createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
   updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
   deletedAt: data.deletedAt?.toDate ? data.deletedAt.toDate() : (data.deletedAt ? new Date(data.deletedAt) : null)
   } as Customer);
   });
   setCustomers(list.filter(c => !c.isDeleted));
   setTrashCustomers(list.filter(c => c.isDeleted));
   saveLocalCustomers(list);
   if (!snapshot.metadata.fromCache) {
     setCustomersSynced(true);
   }
  }, (error) => {
  console.warn("Firestore error syncing customers list, using offline cache fallback:", error);
  loadLocalData();
  setCustomersSynced(true);
  });

 return () => unsubscribe();
 }, [userId]);

// 3. Sync Customer Transactions on-demand (Option A: Client-Side Sorting - No composite index required!)
  useEffect(() => {
    if (!userId || userId === 'local-guest-session' || isOfflineFallback) {
      return;
    }
    if (!activeCustomerId) {
      setAllCustomerTxs([]);
      setCustomerTransactions([]);
      return;
    }

    // Try loading immediately from local cache if available for instant display
    try {
      const cached = localStorage.getItem(`easy_due_txs_${userId}_${activeCustomerId}`);
      if (cached) {
        const parsed: Transaction[] = JSON.parse(cached)
          .filter((t: any) => !archivedTxIdsRef.current.has(t.id) && !t.isArchived)
          .map((t: any) => ({
            ...t,
            description: normalizeTxDescription(t.description),
            date: parseTxDate(t.date),
            createdAt: parseTxDate(t.createdAt)
          }));
        setAllCustomerTxs(parsed);
        setActiveCustomerTxCount(parsed.length);
      }
    } catch (e) {
      console.warn("Failed to load cached customer txs:", e);
    }

    const txRef = collection(db, 'users', userId, 'transactions');
    // Equality query only on 'customerId' - supported by default single-field index without requiring composite index!
    const q = query(
      txRef,
      where('customerId', '==', activeCustomerId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        if (archivedTxIdsRef.current.has(docSnap.id)) return;
        const data = docSnap.data();
        if ((data as any).isArchived) return;
        list.push({
          ...data,
          id: docSnap.id,
          description: normalizeTxDescription(data.description),
          date: parseTxDate(data.date),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt).toISOString() : new Date()),
        } as Transaction);
      });

      // Client-side sort descending by date (newest first)
      list.sort((a, b) => {
        const dateA = parseTxDate(a.date).getTime();
        const dateB = parseTxDate(b.date).getTime();
        return dateB - dateA;
      });

      const currentSettings = settingsRef.current;
      const keepLimit = currentSettings?.autoMergeStatements
        ? Math.max(1, Number(currentSettings.statementKeepCount) || 15)
        : null;

      if (keepLimit !== null && list.length > keepLimit) {
        const keptList = list.slice(0, keepLimit);
        setAllCustomerTxs(keptList);
        setActiveCustomerTxCount(keptList.length);
        try {
          localStorage.setItem(`easy_due_txs_${userId}_${activeCustomerId}`, JSON.stringify(keptList));
        } catch {}
        // Trigger background archive of the excess entries
        setTimeout(() => {
          archiveCustomerExcessStatements(activeCustomerId, keepLimit);
        }, 0);
        return;
      }

      setAllCustomerTxs(list);
      setActiveCustomerTxCount(list.length);

      // Save to local cache for instant future loads
      try {
        localStorage.setItem(`easy_due_txs_${userId}_${activeCustomerId}`, JSON.stringify(list));
      } catch (e) {
        console.warn("Failed to cache customer txs:", e);
      }
    }, (error) => {
      console.warn("Firestore error syncing customer transactions:", error);
    });

    return () => unsubscribe();
  }, [userId, activeCustomerId, isOfflineFallback]);

  // 3a. Slice Customer Transactions according to pagination limit (for both cloud & guest sessions)
  useEffect(() => {
    if (!activeCustomerId) {
      setCustomerTransactions([]);
      return;
    }

    if (userId === 'local-guest-session' || isOfflineFallback) {
      const allActiveForCust = transactions
        .filter(t => t.customerId === activeCustomerId && !archivedTxIdsRef.current.has(t.id))
        .sort((a, b) => {
          const dateA = parseTxDate(a.date).getTime();
          const dateB = parseTxDate(b.date).getTime();
          return dateB - dateA;
        });
      setActiveCustomerTxCount(allActiveForCust.length);
      setCustomerTransactions(allActiveForCust.slice(0, customerTxLimit));
    } else {
      setCustomerTransactions(allCustomerTxs.slice(0, customerTxLimit));
    }
  }, [userId, isOfflineFallback, activeCustomerId, transactions, allCustomerTxs, customerTxLimit]);

// 3b. Sync Daily Archive Transactions (Option A: Instant local cache + windowed Firestore query)
  useEffect(() => {
    if (!userId || userId === 'local-guest-session' || isOfflineFallback || !selectedDailyDate) {
      setArchiveTransactions([]);
      return;
    }

    const dayKey = `${selectedDailyDate.getFullYear()}-${String(selectedDailyDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDailyDate.getDate()).padStart(2, '0')}`;

    // Try loading immediately from local cache if available for instant display
    try {
      const cached = localStorage.getItem(`easy_due_daily_${userId}_${dayKey}`);
      if (cached) {
        const parsed: Transaction[] = JSON.parse(cached).map((t: any) => ({
          ...t,
          date: parseTxDate(t.date),
          createdAt: parseTxDate(t.createdAt)
        }));
        setArchiveTransactions(parsed);
      }
    } catch (e) {
      console.warn("Failed to load cached daily txs:", e);
    }

    // Query firestore directly for the selected date range
    const startOfDay = new Date(selectedDailyDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDailyDate);
    endOfDay.setHours(23, 59, 59, 999);

    const txRef = collection(db, 'users', userId, 'transactions');
    const q = query(
      txRef,
      orderBy('date', 'desc'),
      where('date', '>=', startOfDay),
      where('date', '<=', endOfDay)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          ...data,
          id: docSnap.id,
          date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
        } as Transaction);
      });

      list.sort((a, b) => {
        const dateA = parseTxDate(a.date).getTime();
        const dateB = parseTxDate(b.date).getTime();
        return dateB - dateA;
      });

      setArchiveTransactions(list);

      // Save to local cache for instant future loads
      try {
        localStorage.setItem(`easy_due_daily_${userId}_${dayKey}`, JSON.stringify(list));
      } catch (e) {
        console.warn("Failed to cache daily txs:", e);
      }
    }, (error) => {
      console.warn("Firestore error syncing daily archive transactions:", error);
    });

    return () => unsubscribe();
  }, [userId, selectedDailyDate, isOfflineFallback]);

// Compute daily transactions dynamically based on date context
  const dailyTransactions = useMemo(() => {
    if (!selectedDailyDate) return [];
    
    const filterDateStr = selectedDailyDate.toDateString();
    const map = new Map<string, Transaction>();

    archiveTransactions.forEach(tx => {
      const d = parseTxDate(tx.date);
      if (d.toDateString() === filterDateStr) {
        map.set(tx.id, tx);
      }
    });

    transactions.forEach(tx => {
      const d = parseTxDate(tx.date);
      if (d.toDateString() === filterDateStr) {
        map.set(tx.id, tx);
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const dateA = parseTxDate(a.date).getTime();
      const dateB = parseTxDate(b.date).getTime();
      return dateB - dateA;
    });
  }, [transactions, selectedDailyDate, archiveTransactions]);

  const todayTransactions = useMemo(() => {
    const todayStr = new Date().toDateString();
    const map = new Map<string, Transaction>();

    archiveTransactions.forEach(tx => {
      const d = parseTxDate(tx.date);
      if (d.toDateString() === todayStr) {
        map.set(tx.id, tx);
      }
    });

    transactions.forEach(tx => {
      const d = parseTxDate(tx.date);
      if (d.toDateString() === todayStr) {
        map.set(tx.id, tx);
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const dateA = parseTxDate(a.date).getTime();
      const dateB = parseTxDate(b.date).getTime();
      return dateB - dateA;
    });
  }, [transactions, archiveTransactions]);

  // 3c. Sync Monthly Summaries (retention last 6 months)
  useEffect(() => {
    if (!userId || userId === 'local-guest-session' || isOfflineFallback) {
      return;
    }
    const summariesRef = collection(db, 'users', userId, 'monthly_summaries');
    const q = query(summariesRef, limit(12));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
      list.sort((a, b) => b.id.localeCompare(a.id));
      setMonthlySummaries(list);
      localStorage.setItem(`easy_due_monthly_summaries_${userId}`, JSON.stringify(list));
    }, (error) => {
      console.warn("Firestore error syncing monthly summaries:", error);
    });

    return () => unsubscribe();
  }, [userId, isOfflineFallback]);

  const effectiveMonthlySummaries = useMemo(() => {
    if (monthlySummaries && monthlySummaries.length > 0) {
      return monthlySummaries;
    }
    const summaries: Record<string, any> = {};
    const allTxs = [...transactions, ...archiveTransactions];
    const seenIds = new Set<string>();

    allTxs.forEach(tx => {
      if (seenIds.has(tx.id)) return;
      seenIds.add(tx.id);

      const d = parseTxDate(tx.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!summaries[monthKey]) {
        summaries[monthKey] = {
          id: monthKey,
          dues: 0,
          payments: 0,
          count: 0,
          customerPayments: {}
        };
      }
      const s = summaries[monthKey];
      s.count++;
      if (tx.type === 'due') {
        s.dues += tx.amount;
      } else {
        s.payments += tx.amount;
        if (!s.customerPayments[tx.customerId]) {
          s.customerPayments[tx.customerId] = {
            name: tx.customerName || 'Unknown',
            total: 0
          };
        }
        s.customerPayments[tx.customerId].total += tx.amount;
      }
    });

    return Object.values(summaries).sort((a: any, b: any) => b.id.localeCompare(a.id));
  }, [monthlySummaries, transactions, archiveTransactions]);

// Sync Goals collection
  useEffect(() => {
    if (!userId) return;
    if (userId === 'local-guest-session') {
      return;
    }

    const goalsRef = collection(db, 'users', userId, 'goals');
    const q = query(goalsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: SavingGoal[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          ...data,
          id: docSnap.id,
          savedAmount: Number(data.savedAmount) || 0,
          targetAmount: Number(data.targetAmount) || 0,
          installmentAmount: data.installmentAmount ? Number(data.installmentAmount) : undefined,
          contributions: Array.isArray(data.contributions) ? data.contributions : [],
          status: data.status || 'active',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)
        } as SavingGoal);
      });
      setGoals(list);
      saveLocalGoals(list);
      setGoalsSynced(true);
    }, (error) => {
      console.warn("Firestore error syncing goals, using offline cache fallback:", error);
      try {
        const stored = localStorage.getItem(`easy_due_goals_${userId}`);
        if (stored) {
          setGoals(JSON.parse(stored).map((g: any) => ({
            ...g,
            savedAmount: Number(g.savedAmount) || 0,
            targetAmount: Number(g.targetAmount) || 0,
            installmentAmount: g.installmentAmount ? Number(g.installmentAmount) : undefined,
            contributions: Array.isArray(g.contributions) ? g.contributions : [],
            status: g.status || 'active',
            createdAt: new Date(g.createdAt),
            updatedAt: new Date(g.updatedAt)
          })));
        }
      } catch (e) {
        console.warn(e);
      }
      setGoalsSynced(true);
    });

    return () => unsubscribe();
  }, [userId]);

  // Sync count from server once on startup using server aggregation count
  useEffect(() => {
    if (!userId || userId === 'local-guest-session' || isOfflineFallback) {
      if (userId === 'local-guest-session') {
        const stored = localStorage.getItem(`easy_due_transactions_${userId}`);
        const count = stored ? JSON.parse(stored).length : 0;
        if (settings && settings.transactionsCount !== count) {
          const newSettings = { ...settings, transactionsCount: count };
          setSettings(newSettings);
          saveLocalSettings(newSettings);
        }
      }
      return;
    }
    
    const syncCount = async () => {
      try {
        const txRef = collection(db, 'users', userId, 'transactions');
        const snap = await getCountFromServer(txRef);
        const count = snap.data().count;
        
        if (settings && settings.transactionsCount !== count) {
          const newSettings = { ...settings, transactionsCount: count };
          setSettings(newSettings);
          saveLocalSettings(newSettings);
          
          const userDocRef = doc(db, 'users', userId);
          await updateDoc(userDocRef, { transactionsCount: count, updatedAt: serverTimestamp() });
        }
      } catch (err) {
        console.warn("Failed to sync total transaction count:", err);
      }
    };
    
    if (settings) {
      syncCount();
    }
  }, [userId, !settings, isOfflineFallback] /* triggers count sync */);

  // 4. Sync Reminders collection
 useEffect(() => {
 if (!userId) return;
 if (userId === 'local-guest-session') {
 return;
 }

 const remindersRef = collection(db, 'users', userId, 'reminders');

 const unsubscribe = onSnapshot(remindersRef, (snapshot) => {
 const list: Reminder[] = [];
 snapshot.forEach((docSnap) => {
 const data = docSnap.data();
 const rawDue = data.dueDate;
 const parsedDueDate = rawDue?.toDate ? rawDue.toDate() : (rawDue ? new Date(rawDue) : new Date());
 const rawCreated = data.createdAt;
 const parsedCreatedAt = rawCreated?.toDate ? rawCreated.toDate() : (rawCreated ? new Date(rawCreated) : new Date());
 list.push({
 ...data,
 id: docSnap.id,
 dueDate: parsedDueDate,
 createdAt: parsedCreatedAt,
 } as Reminder);
 });
 list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
 setReminders(list);
 saveLocalReminders(list);
 }, (error) => {
 console.warn("Firestore error syncing reminders, using offline cache fallback:", error);
 loadLocalData();
 });

 return () => unsubscribe();
 }, [userId]);

 // --- ACTIONS ---

 // Update theme setting
 const updateTheme = async (theme: 'light' | 'dark') => {
 if (!userId) return;
 const updatedSettings = settings ? { ...settings, theme, updatedAt: new Date() } : {
 uid: userId,
 email: auth.currentUser?.email || 'guest@challantrack.local',
 theme,
 dailyReminderTime: '09:00',
 createdAt: new Date(),
 updatedAt: new Date()
 };
 setSettings(updatedSettings);
 saveLocalSettings(updatedSettings);

 if (userId === 'local-guest-session' || isOfflineFallback) {
 return;
 }

 const userDocRef = doc(db, 'users', userId);
 try {
 await updateDoc(userDocRef, {
 theme,
 updatedAt: serverTimestamp()
 });
 } catch (err) {
 console.warn("Firestore updateTheme failed, saved locally:", err);
 }
 };

 // Update general settings
 const updateSettings = async (time: string) => {
 if (!userId) return;
 const updatedSettings = settings ? { ...settings, dailyReminderTime: time, updatedAt: new Date() } : {
 uid: userId,
 email: auth.currentUser?.email || 'guest@challantrack.local',
 theme: 'dark' as const,
 dailyReminderTime: time,
 createdAt: new Date(),
 updatedAt: new Date()
 };
 setSettings(updatedSettings);
 saveLocalSettings(updatedSettings);

 if (userId === 'local-guest-session' || isOfflineFallback) {
 return;
 }

 const userDocRef = doc(db, 'users', userId);
 try {
 await updateDoc(userDocRef, {
 dailyReminderTime: time,
 updatedAt: serverTimestamp()
 });
 } catch (err) {
 console.warn("Firestore updateSettings failed, saved locally:", err);
 }
 };

  // Sync Archived Statements collection (merging remote with local cache so local archives are never lost)
  useEffect(() => {
    if (!userId || userId === 'local-guest-session' || isOfflineFallback) return;
    const archRef = collection(db, 'users', userId, 'archived_transactions');
    const unsubscribe = onSnapshot(archRef, (snapshot) => {
      const remoteList: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        archivedTxIdsRef.current.add(docSnap.id);
        remoteList.push({
          ...data,
          id: docSnap.id,
          date: parseTxDate(data.date),
          createdAt: parseTxDate(data.createdAt),
          archivedAt: (data as any).archivedAt ? parseTxDate((data as any).archivedAt) : parseTxDate(data.date)
        } as any);
      });

      setArchivedStatements(prev => {
        const map = new Map<string, Transaction>();
        prev.forEach(item => {
          if (item?.id) {
            archivedTxIdsRef.current.add(item.id);
            map.set(item.id, item);
          }
        });
        remoteList.forEach(item => {
          if (item?.id) {
            map.set(item.id, item);
          }
        });
        const merged = Array.from(map.values()).sort(
          (a, b) => parseTxDate(b.date).getTime() - parseTxDate(a.date).getTime()
        );
        saveLocalArchivedStatements(merged);
        return merged;
      });
    }, (err) => {
      console.warn("Firestore error syncing archived_transactions:", err);
    });
    return () => unsubscribe();
  }, [userId, isOfflineFallback]);

  // Helper: Archive older transactions for a single customer beyond keepCount (keepCount=0 archives all for a fresh ledger)
  const archiveCustomerExcessStatements = async (customerId: string, keepCount: number): Promise<number> => {
    if (!userId || keepCount < 0) return 0;

    // Gather all known active transactions for this customer across memory, local cache, and Firestore
    const txMap = new Map<string, Transaction>();

    // 1. From in-memory states
    transactions.forEach(t => {
      if (t.customerId === customerId && !archivedTxIdsRef.current.has(t.id)) {
        txMap.set(t.id, t);
      }
    });
    if (customerId === activeCustomerId) {
      allCustomerTxs.forEach(t => {
        if (t.customerId === customerId && !archivedTxIdsRef.current.has(t.id)) {
          txMap.set(t.id, t);
        }
      });
    }

    // 2. From localStorage caches
    try {
      const cachedCust = localStorage.getItem(`easy_due_txs_${userId}_${customerId}`);
      if (cachedCust) {
        JSON.parse(cachedCust).forEach((t: any) => {
          if (t && t.id && !archivedTxIdsRef.current.has(t.id)) {
            txMap.set(t.id, {
              ...t,
              date: parseTxDate(t.date),
              createdAt: parseTxDate(t.createdAt)
            });
          }
        });
      }
      const cachedAll = localStorage.getItem(`easy_due_transactions_${userId}`);
      if (cachedAll) {
        JSON.parse(cachedAll).forEach((t: any) => {
          if (t && t.id && t.customerId === customerId && !archivedTxIdsRef.current.has(t.id)) {
            txMap.set(t.id, {
              ...t,
              date: parseTxDate(t.date),
              createdAt: parseTxDate(t.createdAt)
            });
          }
        });
      }
    } catch {}

    // 3. From Firestore if online cloud user
    if (userId !== 'local-guest-session' && !isOfflineFallback) {
      try {
        const txRef = collection(db, 'users', userId, 'transactions');
        const q = query(txRef, where('customerId', '==', customerId));
        const snap = await getDocs(q);
        snap.forEach(d => {
          if (archivedTxIdsRef.current.has(d.id)) return;
          const data = d.data();
          if ((data as any).isArchived) return;
          txMap.set(d.id, {
            ...data,
            id: d.id,
            date: parseTxDate(data.date),
            createdAt: parseTxDate(data.createdAt)
          } as Transaction);
        });
      } catch (err) {
        console.warn("Firestore getDocs in archiveCustomerExcessStatements fallback to cache:", err);
      }
    }

    const custTxs = Array.from(txMap.values()).sort(
      (a, b) => parseTxDate(b.date).getTime() - parseTxDate(a.date).getTime()
    );

    if (custTxs.length <= keepCount) {
      try {
        localStorage.setItem(`easy_due_txs_${userId}_${customerId}`, JSON.stringify(custTxs));
      } catch {}
      if (customerId === activeCustomerId) {
        setAllCustomerTxs(custTxs);
        setActiveCustomerTxCount(custTxs.length);
      }
      return 0;
    }

    const kept = custTxs.slice(0, keepCount);
    const nowIso = new Date().toISOString();
    const toArchive = custTxs.slice(keepCount).map(tx => ({
      ...tx,
      date: parseTxDate(tx.date),
      createdAt: parseTxDate(tx.createdAt || tx.date),
      archivedAt: nowIso
    })) as Transaction[];

    const archiveIds = new Set(toArchive.map(t => t.id));
    archiveIds.forEach(id => archivedTxIdsRef.current.add(id));
    try {
      localStorage.setItem(
        `easy_due_archived_ids_${userId}`,
        JSON.stringify(Array.from(archivedTxIdsRef.current))
      );
      localStorage.setItem(`easy_due_txs_${userId}_${customerId}`, JSON.stringify(kept));
    } catch {}

    // Update local state & cache immediately
    setTransactions(prev => {
      const rem = prev.filter(t => !archiveIds.has(t.id));
      saveLocalTransactions(rem);
      return rem;
    });

    setArchivedStatements(prev => {
      const existingFiltered = prev.filter(a => !archiveIds.has(a.id));
      const merged = [...toArchive, ...existingFiltered].sort(
        (a, b) => parseTxDate(b.date).getTime() - parseTxDate(a.date).getTime()
      );
      saveLocalArchivedStatements(merged);
      return merged;
    });

    if (customerId === activeCustomerId) {
      setAllCustomerTxs(kept);
      setActiveCustomerTxCount(kept.length);
      setCustomerTxLimit(5);
      setCustomerTransactions(kept.slice(0, 5));
    }

    if (userId === 'local-guest-session' || isOfflineFallback) {
      return toArchive.length;
    }

    // Step 1: Delete excess transactions from active 'transactions' collection in isolated batches
    try {
      for (let i = 0; i < toArchive.length; i += 350) {
        const chunk = toArchive.slice(i, i + 350);
        const deleteBatch = writeBatch(db);
        chunk.forEach(tx => {
          const activeDocRef = doc(db, 'users', userId, 'transactions', tx.id);
          deleteBatch.delete(activeDocRef);
        });
        const userDocRef = doc(db, 'users', userId);
        deleteBatch.set(userDocRef, {
          transactionsCount: increment(-chunk.length),
          updatedAt: serverTimestamp()
        }, { merge: true });
        await deleteBatch.commit();
      }
    } catch (err) {
      console.warn("Could not delete archived transactions from remote active collection (kept hidden locally):", err);
    }

    // Step 2: Store archived transactions in 'archived_transactions' collection in isolated batches
    try {
      for (let i = 0; i < toArchive.length; i += 350) {
        const chunk = toArchive.slice(i, i + 350);
        const archBatch = writeBatch(db);
        chunk.forEach(tx => {
          const archDocRef = doc(db, 'users', userId, 'archived_transactions', tx.id);
          const cleanDoc: Record<string, any> = {
            id: tx.id,
            userId,
            customerId: tx.customerId,
            customerName: tx.customerName || 'Customer',
            type: tx.type,
            amount: Number(tx.amount) || 0,
            description: tx.description || '',
            date: parseTxDate(tx.date),
            createdAt: parseTxDate(tx.createdAt || tx.date),
            archivedAt: serverTimestamp()
          };
          if (tx.isEdited) cleanDoc.isEdited = true;
          archBatch.set(archDocRef, cleanDoc);
        });
        await archBatch.commit();
      }
    } catch (err) {
      console.warn("Could not sync archived transactions to remote subcollection (saved in local archive):", err);
    }

    return toArchive.length;
  };

  // Update Auto-Merge / Archive Statements setting and trim excess statements across all profiles with progress reporting
  const updateStatementAutoMerge = async (
    enabled: boolean,
    keepCount: number = 15,
    onProgress?: (progress: {
      percent: number;
      current: number;
      total: number;
      customerName?: string;
      archivedSoFar: number;
      message: string;
    }) => void
  ): Promise<number> => {
    if (!userId) return 0;
    const validKeep = Math.max(1, Math.min(500, Number(keepCount) || 15));

    const updatedSettings: UserSettings = settings
      ? {
          ...settings,
          autoMergeStatements: enabled,
          statementKeepCount: validKeep,
          updatedAt: new Date()
        }
      : {
          uid: userId,
          email: auth.currentUser?.email || 'guest@challantrack.local',
          theme: 'dark',
          dailyReminderTime: '09:00',
          autoMergeStatements: enabled,
          statementKeepCount: validKeep,
          createdAt: new Date(),
          updatedAt: new Date()
        };

    settingsRef.current = updatedSettings;
    setSettings(updatedSettings);
    saveLocalSettings(updatedSettings);

    if (userId !== 'local-guest-session' && !isOfflineFallback) {
      const userDocRef = doc(db, 'users', userId);
      try {
        await setDoc(userDocRef, {
          autoMergeStatements: enabled,
          statementKeepCount: validKeep,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.warn("Firestore updateStatementAutoMerge failed, saved locally:", err);
      }
    }

    let totalArchivedNow = 0;
    if (enabled) {
      const totalProfiles = customers.length;
      if (totalProfiles === 0) {
        onProgress?.({
          percent: 100,
          current: 0,
          total: 0,
          archivedSoFar: 0,
          message: 'Completing setup...'
        });
        await new Promise(r => setTimeout(r, 250));
      } else {
        for (let idx = 0; idx < totalProfiles; idx++) {
          const c = customers[idx];
          const pct = Math.max(8, Math.round(((idx + 1) / totalProfiles) * 95));
          onProgress?.({
            percent: pct,
            current: idx + 1,
            total: totalProfiles,
            customerName: c.name,
            archivedSoFar: totalArchivedNow,
            message: `${c.name} (${idx + 1}/${totalProfiles})`
          });
          const count = await archiveCustomerExcessStatements(c.id, validKeep);
          totalArchivedNow += count;
          await new Promise(r => setTimeout(r, 25));
        }
        onProgress?.({
          percent: 100,
          current: totalProfiles,
          total: totalProfiles,
          archivedSoFar: totalArchivedNow,
          message: 'Completed!'
        });
        await new Promise(r => setTimeout(r, 150));
      }
    }
    return totalArchivedNow;
  };

  const exportArchivedStatements = async (customerId?: string) => {
    if (!userId) return [];
    const map = new Map<string, any>();

    // Include local archived statements first
    archivedStatements.forEach((item: any) => {
      if (!item?.id) return;
      if (customerId && item.customerId !== customerId) return;
      map.set(item.id, {
        id: item.id,
        customerId: item.customerId,
        customerName: item.customerName || 'Customer',
        type: item.type,
        amount: item.amount,
        description: item.description || '',
        date: parseTxDate(item.date).toISOString(),
        archivedAt: item.archivedAt ? parseTxDate(item.archivedAt).toISOString() : parseTxDate(item.date).toISOString()
      });
    });

    if (userId !== 'local-guest-session' && !isOfflineFallback) {
      try {
        const archRef = collection(db, 'users', userId, 'archived_transactions');
        const snap = await getDocs(archRef);
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (customerId && data.customerId !== customerId) return;
          map.set(docSnap.id, {
            id: docSnap.id,
            customerId: data.customerId,
            customerName: data.customerName || 'Customer',
            type: data.type,
            amount: data.amount,
            description: data.description || '',
            date: parseTxDate(data.date).toISOString(),
            archivedAt: data.archivedAt ? parseTxDate(data.archivedAt).toISOString() : new Date().toISOString()
          });
        });
      } catch (err) {
        console.warn("Using local archive cache for export:", err);
      }
    }

    const list = Array.from(map.values());
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  };

 // Create new customer
 const createCustomer = async (
   name: string,
   phone: string,
   options?: { accountType?: 'standard' | 'credit_card'; billingDay?: number }
 ) => {
 if (!userId) return null;
 
 const trimmedName = name.trim();
 // Case-insensitive duplicate name check
 const isDuplicate = customers.some(c => c.name.toLowerCase() === trimmedName.toLowerCase());
 if (isDuplicate) {
 throw new Error('DUPLICATE_NAME');
 }

 const customId = doc(collection(db, 'temp')).id;
 const acctType = options?.accountType || 'standard';
 const validBillingDay =
   acctType === 'credit_card'
     ? Math.min(31, Math.max(1, Math.round(options?.billingDay || 15)))
     : undefined;

 const newCustomer: Customer = {
 id: customId,
 userId,
 name: trimmedName,
 phone: cleanBangladeshiPhone(phone),
 outstandingDue: 0,
 createdAt: new Date(),
 updatedAt: new Date(),
 accountType: acctType,
 ...(validBillingDay !== undefined ? { billingDay: validBillingDay } : {})
 };

 const updatedList = [newCustomer, ...customers];
 setCustomers(updatedList);
 saveLocalCustomers(updatedList);

 if (userId === 'local-guest-session' || isOfflineFallback) {
 return customId;
 }

 const customersRef = collection(db, 'users', userId, 'customers');
 const newDocRef = doc(customersRef, customId);
 try {
 await setDoc(newDocRef, {
 ...newCustomer,
 createdAt: serverTimestamp(),
 updatedAt: serverTimestamp()
 });
 return customId;
 } catch (err) {
 console.warn("Firestore createCustomer failed, saved locally:", err);
 return customId;
 }
 };

 // Record a new transaction (due or payment) and update customer balance
  // Helper to adjust monthly summary documents atomically inside a batch
  const adjustMonthlySummary = (
    batch: any, 
    uid: string, 
    oldTx: Transaction | null, 
    newTx: Transaction | null
  ) => {
    const getTxMonthKey = (tx: Transaction) => {
      const d = parseTxDate(tx.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const targetMonth = newTx ? getTxMonthKey(newTx) : (oldTx ? getTxMonthKey(oldTx) : null);
    if (!targetMonth) return;

    const summaryRef = doc(db, 'users', uid, 'monthly_summaries', targetMonth);

    // Calculate changes
    let diffDues = 0;
    let diffPayments = 0;
    let diffCount = 0;

    if (oldTx) {
      diffCount--;
      if (oldTx.type === 'due') diffDues -= oldTx.amount;
      else diffPayments -= oldTx.amount;
    }
    if (newTx) {
      diffCount++;
      if (newTx.type === 'due') diffDues += newTx.amount;
      else diffPayments += newTx.amount;
    }

    const updates: any = {
      dues: increment(diffDues),
      payments: increment(diffPayments),
      count: increment(diffCount),
      updatedAt: serverTimestamp()
    };

    if (newTx) {
      updates[`customerPayments.${newTx.customerId}.name`] = newTx.customerName;
      updates[`customerPayments.${newTx.customerId}.total`] = increment(newTx.type === 'payment' ? newTx.amount : 0);
    }
    if (oldTx) {
      updates[`customerPayments.${oldTx.customerId}.total`] = increment(oldTx.type === 'payment' ? -oldTx.amount : 0);
    }

    batch.set(summaryRef, updates, { merge: true });
  };

  // Helper to adjust daily summary documents atomically inside a batch (Option A: Quickbook Sync)
  const adjustDailySummary = (
    batch: any, 
    uid: string, 
    oldTx: Transaction | null, 
    newTx: Transaction | null
  ) => {
    const getTxDayKey = (tx: Transaction) => {
      const d = parseTxDate(tx.date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const targetDay = newTx ? getTxDayKey(newTx) : (oldTx ? getTxDayKey(oldTx) : null);
    if (!targetDay) return;

    const summaryRef = doc(db, 'users', uid, 'daily_summaries', targetDay);

    let diffDues = 0;
    let diffPayments = 0;
    let diffCount = 0;

    if (oldTx) {
      diffCount--;
      if (oldTx.type === 'due') diffDues -= oldTx.amount;
      else diffPayments -= oldTx.amount;
    }
    if (newTx) {
      diffCount++;
      if (newTx.type === 'due') diffDues += newTx.amount;
      else diffPayments += newTx.amount;
    }

    const updates: any = {
      id: targetDay,
      dateStr: targetDay,
      dues: increment(diffDues),
      payments: increment(diffPayments),
      count: increment(diffCount),
      updatedAt: serverTimestamp()
    };

    batch.set(summaryRef, updates, { merge: true });
  };

  const rebuildMonthlySummaries = async (uid: string) => {
    if (!uid || uid === 'local-guest-session') return;
    if ((window as any).isRebuildingSummaries) return;
    (window as any).isRebuildingSummaries = true;
    console.log("Rebuilding monthly summaries for user:", uid);
    
    try {
      const txRef = collection(db, 'users', uid, 'transactions');
      const qSnap = await getDocs(txRef);
      
      const summaries: Record<string, any> = {};
      let totalCount = 0;
      
      qSnap.forEach(docSnap => {
        const tx = docSnap.data() as Transaction;
        tx.id = docSnap.id;
        const d = parseTxDate(tx.date);
        
        totalCount++;
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        
        if (!summaries[monthKey]) {
          summaries[monthKey] = {
            dues: 0,
            payments: 0,
            count: 0,
            customerPayments: {}
          };
        }
        
        const summary = summaries[monthKey];
        summary.count++;
        if (tx.type === 'due') {
          summary.dues += tx.amount;
        } else {
          summary.payments += tx.amount;
          if (!summary.customerPayments[tx.customerId]) {
            summary.customerPayments[tx.customerId] = {
              name: tx.customerName || 'Unknown',
              total: 0
            };
          }
          summary.customerPayments[tx.customerId].total += tx.amount;
        }
      });

      const batch = writeBatch(db);
      
      // Update User Settings count
      const userDocRef = doc(db, 'users', uid);
      batch.set(userDocRef, {
        transactionsCount: totalCount,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Write each summary (overwrite to clear deleted client payments completely)
      Object.keys(summaries).forEach(monthKey => {
        const summaryRef = doc(db, 'users', uid, 'monthly_summaries', monthKey);
        batch.set(summaryRef, {
          ...summaries[monthKey],
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
      
      // Update local settings count
      if (settings) {
        const newSettings = { ...settings, transactionsCount: totalCount };
        setSettings(newSettings);
        saveLocalSettings(newSettings);
      }
    } catch (e) {
      console.warn("Failed to rebuild monthly summaries:", e);
    } finally {
      (window as any).isRebuildingSummaries = false;
    }
  };

  const addTransaction = async (
   customerId: string, 
   type: 'due' | 'payment', 
   amount: number, 
   description: string = '', 
   date: Date = new Date(),
   fallbackCustomerInfo?: { name: string; phone: string; accountType?: 'standard' | 'credit_card'; billingDay?: number }
 ) => {
   if (!userId) return;

   // Accidental Time-Based Double-Click prevention
   const now = Date.now();
   if (lastSubmitRef.current) {
     const { timestamp, customerId: prevCustId, type: prevType, amount: prevAmount } = lastSubmitRef.current;
     if (
       now - timestamp < 1000 &&
       prevCustId === customerId &&
       prevType === type &&
       prevAmount === amount
     ) {
       console.warn("Blocked duplicate transaction submission within 1 second.");
       return;
     }
   }
   lastSubmitRef.current = { timestamp: now, customerId, type, amount };
 
 let customer = customers.find(c => c.id === customerId);
 let customerName = customer?.name || fallbackCustomerInfo?.name;
 if (!customerName) throw new Error('Customer not found');

 const customTxId = doc(collection(db, 'temp')).id;
 const diff = type === 'due' ? amount : -amount;

 const newTx: Transaction = {
 id: customTxId,
 userId,
 customerId,
 customerName: customerName,
 type,
 amount,
 description: description.trim(),
 date,
 createdAt: new Date()
 };

 const updatedTxs = [newTx, ...transactions];
 
 let found = false;
 let updatedCustomers = customers.map(c => {
 if (c.id === customerId) {
 found = true;
 return { ...c, outstandingDue: c.outstandingDue + diff, updatedAt: new Date() };
 }
 return c;
 });

 // If customer was newly created and not yet in the stale customers state list, add them inline
 if (!found && fallbackCustomerInfo) {
 const acctType = fallbackCustomerInfo.accountType || 'standard';
 const validBillingDay =
   acctType === 'credit_card'
     ? Math.min(31, Math.max(1, Math.round(fallbackCustomerInfo.billingDay || 15)))
     : undefined;
 const newCustomer: Customer = {
 id: customerId,
 userId,
 name: fallbackCustomerInfo.name.trim(),
 phone: fallbackCustomerInfo.phone.trim(),
 outstandingDue: diff,
 createdAt: new Date(),
 updatedAt: new Date(),
 accountType: acctType,
 ...(validBillingDay !== undefined ? { billingDay: validBillingDay } : {})
 };
 updatedCustomers = [newCustomer, ...updatedCustomers];
 }

 setTransactions(updatedTxs);
 setCustomers(updatedCustomers);
 saveLocalTransactions(updatedTxs);
 saveLocalCustomers(updatedCustomers);

 if (customerId === activeCustomerId) {
   setAllCustomerTxs(prev => [newTx, ...prev.filter(t => t.id !== newTx.id)]);
   setActiveCustomerTxCount(prev => prev + 1);
 }

 if (selectedDailyDate && parseTxDate(date).toDateString() === selectedDailyDate.toDateString()) {
   setArchiveTransactions(prev => [newTx, ...prev.filter(t => t.id !== newTx.id)]);
 }

 adjustLocalMonthlySummaries(null, newTx);

 if (settings) {
   const newSettings = {
     ...settings,
     transactionsCount: (settings.transactionsCount || 0) + 1
   };
   setSettings(newSettings);
   saveLocalSettings(newSettings);
 }

 if (userId === 'local-guest-session' || isOfflineFallback) {
   if (settings?.autoMergeStatements) {
     await archiveCustomerExcessStatements(customerId, settings.statementKeepCount || 15);
   }
   return;
 }

 const txRef = collection(db, 'users', userId, 'transactions');
 const newTxDoc = doc(txRef, customTxId);
 const customerDocRef = doc(db, 'users', userId, 'customers', customerId);

 const batch = writeBatch(db);
 batch.set(newTxDoc, {
 ...newTx,
 date,
 createdAt: serverTimestamp()
 });
 
 // In Firestore, if this customer was just created, updateDoc or setDoc is safe since we did await setDoc earlier
 batch.update(customerDocRef, {
 outstandingDue: increment(diff),
 updatedAt: serverTimestamp()
 });

 adjustMonthlySummary(batch, userId, null, newTx);
 adjustDailySummary(batch, userId, null, newTx);

 const userDocRef = doc(db, 'users', userId);
 batch.update(userDocRef, {
 transactionsCount: increment(1),
 updatedAt: serverTimestamp()
 });

 try {
 await batch.commit();
 if (settings?.autoMergeStatements) {
   await archiveCustomerExcessStatements(customerId, settings.statementKeepCount || 15);
 }
 } catch (err) {
 console.warn("Firestore addTransaction failed, saved locally:", err);
 }
 };

 // Add a reminder for customer or EMI installment
 const addReminder = async (
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
 ) => {
 if (!userId) return;
 const customer = customers.find(c => c.id === customerId);
 const resolvedName = extra?.customerName || customer?.name || 'EMI Account';
 const reminderType = extra?.type || 'customer';

 // Prevent duplicate active reminders for the same person or same EMI
 const duplicateReminders = reminders.filter(r => {
   if (!r.active) return false;
   if (reminderType === 'emi') {
     if (r.type !== 'emi') return false;
     if (extra?.goalId && r.goalId === extra.goalId) return true;
     if (resolvedName && r.customerName && r.customerName.trim().toLowerCase() === resolvedName.trim().toLowerCase()) return true;
     return false;
   } else {
     if (r.type === 'emi') return false;
     return customerId && r.customerId === customerId;
   }
 });

 const customRemId = doc(collection(db, 'temp')).id;
 const newReminder: Reminder = {
 id: customRemId,
 userId,
 customerId: customerId || extra?.goalId || '',
 customerName: resolvedName,
 notes: notes.trim(),
 dueDate,
 active: true,
 createdAt: new Date(),
 type: reminderType,
 goalId: extra?.goalId,
 emiDayOfMonth: extra?.emiDayOfMonth,
 installmentAmount: extra?.installmentAmount
 };

 const filteredReminders = reminders.filter(r => !duplicateReminders.some(d => d.id === r.id));
 const updatedReminders = [newReminder, ...filteredReminders];
 setReminders(updatedReminders);
 saveLocalReminders(updatedReminders);

 if (userId === 'local-guest-session' || isOfflineFallback) {
 return;
 }

 // Delete duplicates from Firestore asynchronously
 for (const dup of duplicateReminders) {
   try {
     deleteDoc(doc(db, 'users', userId, 'reminders', dup.id));
   } catch (err) {
     console.warn("Failed to remove duplicate reminder from Firestore:", err);
   }
 }

 const remindersRef = collection(db, 'users', userId, 'reminders');
 const newReminderRef = doc(remindersRef, customRemId);
 const firestoreReminder: any = {
 id: customRemId,
 userId,
 customerId: customerId || extra?.goalId || '',
 customerName: resolvedName,
 notes: notes.trim(),
 dueDate,
 active: true,
 createdAt: serverTimestamp(),
 type: reminderType
 };
 if (extra?.goalId) firestoreReminder.goalId = extra.goalId;
 if (extra?.emiDayOfMonth !== undefined) firestoreReminder.emiDayOfMonth = Number(extra.emiDayOfMonth);
 if (extra?.installmentAmount !== undefined && !isNaN(Number(extra.installmentAmount))) {
 firestoreReminder.installmentAmount = Number(extra.installmentAmount);
 }

 try {
 await setDoc(newReminderRef, firestoreReminder);
 } catch (err) {
 console.warn("Firestore addReminder failed, saved locally:", err);
 }
 };

 // Toggle/Edit a Reminder status
 const toggleReminder = async (reminderId: string, active: boolean) => {
 if (!userId) return;
 const updatedReminders = reminders.map(r => r.id === reminderId ? { ...r, active } : r);
 setReminders(updatedReminders);
 saveLocalReminders(updatedReminders);

 if (userId === 'local-guest-session' || isOfflineFallback) {
 return;
 }

 const reminderRef = doc(db, 'users', userId, 'reminders', reminderId);
 try {
 await updateDoc(reminderRef, { active });
 } catch (err) {
 console.warn("Firestore toggleReminder failed, saved locally:", err);
 }
 };

 // Delete a Reminder
 const deleteReminder = async (reminderId: string) => {
 if (!userId) return;
 const updatedReminders = reminders.filter(r => r.id !== reminderId);
 setReminders(updatedReminders);
 saveLocalReminders(updatedReminders);

 if (userId === 'local-guest-session' || isOfflineFallback) {
 return;
 }

 const reminderRef = doc(db, 'users', userId, 'reminders', reminderId);
 try {
 await deleteDoc(reminderRef);
 } catch (err) {
 console.warn("Firestore deleteReminder failed, saved locally:", err);
 }
 };

  // Delete a customer (soft delete to Trash)
  const deleteCustomer = async (customerId: string) => {
    if (!userId) return;
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const deletedCustomer = { ...customer, isDeleted: true, deletedAt: new Date() };

    const updatedCustomers = customers.filter(c => c.id !== customerId);
    const updatedTrash = [deletedCustomer, ...trashCustomers];

    setCustomers(updatedCustomers);
    setTrashCustomers(updatedTrash);
    saveLocalCustomers([...updatedCustomers, ...updatedTrash]);

    if (userId === 'local-guest-session' || isOfflineFallback) {
      return;
    }

    const customerDocRef = doc(db, 'users', userId, 'customers', customerId);
    try {
      await updateDoc(customerDocRef, {
        isDeleted: true,
        deletedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn("Firestore soft deleteCustomer failed, saved locally:", err);
    }
  };

  // Restore a customer from Trash
  const restoreCustomer = async (customerId: string) => {
    if (!userId) return;
    const customer = trashCustomers.find(c => c.id === customerId);
    if (!customer) return;

    const restoredCustomer = { ...customer, isDeleted: false, deletedAt: null };

    const updatedTrash = trashCustomers.filter(c => c.id !== customerId);
    const updatedCustomers = [restoredCustomer, ...customers];

    setCustomers(updatedCustomers);
    setTrashCustomers(updatedTrash);
    saveLocalCustomers([...updatedCustomers, ...updatedTrash]);

    if (userId === 'local-guest-session' || isOfflineFallback) {
      return;
    }

    const customerDocRef = doc(db, 'users', userId, 'customers', customerId);
    try {
      await updateDoc(customerDocRef, {
        isDeleted: false,
        deletedAt: null
      });
    } catch (err) {
      console.warn("Firestore restoreCustomer failed, saved locally:", err);
    }
  };

  // Permanently delete a customer, their transactions, and reminders
  const permanentlyDeleteCustomer = async (customerId: string) => {
    if (!userId) return;

    const updatedTrash = trashCustomers.filter(c => c.id !== customerId);
    const updatedCustomers = customers.filter(c => c.id !== customerId);

    setCustomers(updatedCustomers);
    setTrashCustomers(updatedTrash);
    saveLocalCustomers([...updatedCustomers, ...updatedTrash]);

    const updatedTxs = transactions.filter(t => t.customerId !== customerId);
    const updatedReminders = reminders.filter(r => r.type === 'emi' || r.customerId !== customerId);
    setTransactions(updatedTxs);
    setReminders(updatedReminders);
    saveLocalTransactions(updatedTxs);
    saveLocalReminders(updatedReminders);

    if (userId === 'local-guest-session' || isOfflineFallback) {
      return;
    }

    const customerDocRef = doc(db, 'users', userId, 'customers', customerId);
    let relatedTxs = transactions.filter(t => t.customerId === customerId);
    try {
      const qTx = query(collection(db, 'users', userId, 'transactions'), where('customerId', '==', customerId));
      const snap = await getDocs(qTx);
      const fetched: Transaction[] = [];
      snap.forEach(d => fetched.push({ ...d.data(), id: d.id } as Transaction));
      if (fetched.length > 0) relatedTxs = fetched;
    } catch (e) {
      console.warn("Could not query remote transactions for deletion, using cached list:", e);
    }

    let relatedReminders = reminders.filter(r => r.type !== 'emi' && r.customerId === customerId);
    try {
      const qRem = query(collection(db, 'users', userId, 'reminders'), where('customerId', '==', customerId));
      const snapRem = await getDocs(qRem);
      const fetchedRem: Reminder[] = [];
      snapRem.forEach(d => fetchedRem.push({ ...d.data(), id: d.id } as Reminder));
      if (fetchedRem.length > 0) relatedReminders = fetchedRem;
    } catch (e) {
      console.warn("Could not query remote reminders for deletion, using cached list:", e);
    }

    const batch = writeBatch(db);
    batch.delete(customerDocRef);
    relatedTxs.forEach(tx => {
      batch.delete(doc(db, 'users', userId, 'transactions', tx.id));
      adjustMonthlySummary(batch, userId, tx, null);
      adjustDailySummary(batch, userId, tx, null);
    });
    relatedReminders.forEach(rem => {
      batch.delete(doc(db, 'users', userId, 'reminders', rem.id));
    });

    try {
      await batch.commit();
    } catch (err) {
      console.warn("Firestore permanentlyDeleteCustomer failed, saved locally:", err);
    }
  };

  // Empty the entire Trash
  const emptyTrash = async () => {
    if (!userId) return;

    const idsToDelete = trashCustomers.map(c => c.id);

    setTrashCustomers([]);
    saveLocalCustomers(customers);

    const updatedTxs = transactions.filter(t => !idsToDelete.includes(t.customerId));
    const updatedReminders = reminders.filter(r => r.type === 'emi' || !idsToDelete.includes(r.customerId));
    setTransactions(updatedTxs);
    setReminders(updatedReminders);
    saveLocalTransactions(updatedTxs);
    saveLocalReminders(updatedReminders);

    if (userId === 'local-guest-session' || isOfflineFallback) {
      return;
    }

    try {
      for (const customerId of idsToDelete) {
        const customerDocRef = doc(db, 'users', userId, 'customers', customerId);
        let relatedTxs = transactions.filter(t => t.customerId === customerId);
        try {
          const qTx = query(collection(db, 'users', userId, 'transactions'), where('customerId', '==', customerId));
          const snap = await getDocs(qTx);
          const fetched: Transaction[] = [];
          snap.forEach(d => fetched.push({ ...d.data(), id: d.id } as Transaction));
          if (fetched.length > 0) relatedTxs = fetched;
        } catch (e) {
          console.warn("Could not query remote transactions for deletion, using cached list:", e);
        }

        let relatedReminders = reminders.filter(r => r.type !== 'emi' && r.customerId === customerId);
        try {
          const qRem = query(collection(db, 'users', userId, 'reminders'), where('customerId', '==', customerId));
          const snapRem = await getDocs(qRem);
          const fetchedRem: Reminder[] = [];
          snapRem.forEach(d => fetchedRem.push({ ...d.data(), id: d.id } as Reminder));
          if (fetchedRem.length > 0) relatedReminders = fetchedRem;
        } catch (e) {
          console.warn("Could not query remote reminders for deletion, using cached list:", e);
        }

        const batch = writeBatch(db);
        batch.delete(customerDocRef);
        relatedTxs.forEach(tx => {
          batch.delete(doc(db, 'users', userId, 'transactions', tx.id));
          adjustMonthlySummary(batch, userId, tx, null);
          adjustDailySummary(batch, userId, tx, null);
        });
        relatedReminders.forEach(rem => {
          batch.delete(doc(db, 'users', userId, 'reminders', rem.id));
        });
        await batch.commit();
      }
    } catch (err) {
      console.warn("Firestore emptyTrash failed, saved locally:", err);
    }
  };

  const updateCustomerDetails = async (
    customerId: string,
    name: string,
    phone: string,
    options?: { accountType?: 'standard' | 'credit_card'; billingDay?: number }
  ) => {
    if (!userId) return;
    const trimmedName = name.trim();
    const trimmedPhone = cleanBangladeshiPhone(phone);

    // Check for duplicate name excluding the customer being updated
    const isDuplicate = customers.some(c => c.id !== customerId && c.name.toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicate) {
      throw new Error('DUPLICATE_NAME');
    }

    const updatedList = customers.map(c => {
      if (c.id !== customerId) return c;
      const nextAcctType = options?.accountType ?? c.accountType ?? 'standard';
      const nextBillingDay =
        nextAcctType === 'credit_card'
          ? Math.min(31, Math.max(1, Math.round(options?.billingDay ?? c.billingDay ?? 15)))
          : undefined;
      return {
        ...c,
        name: trimmedName,
        phone: trimmedPhone,
        accountType: nextAcctType,
        billingDay: nextBillingDay,
        updatedAt: new Date()
      };
    });
    setCustomers(updatedList);
    saveLocalCustomers(updatedList);

    if (userId === 'local-guest-session' || isOfflineFallback) {
      return;
    }

    const targetCust = updatedList.find(c => c.id === customerId);
    const customerDocRef = doc(db, 'users', userId, 'customers', customerId);
    try {
      const firestoreUpdates: Record<string, any> = {
        name: trimmedName,
        phone: trimmedPhone,
        accountType: targetCust?.accountType || 'standard',
        updatedAt: serverTimestamp()
      };
      if (targetCust?.accountType === 'credit_card' && targetCust.billingDay) {
        firestoreUpdates.billingDay = targetCust.billingDay;
      }
      await updateDoc(customerDocRef, firestoreUpdates);
    } catch (err) {
      console.warn("Firestore updateCustomerDetails failed, saved locally:", err);
    }
  };

  // Edit a transaction
  const editTransaction = async (
    transactionId: string,
    newType: 'due' | 'payment',
    newAmount: number,
    newDescription: string
  ) => {
    if (!userId) return;

    let tx = customerTransactions.find(t => t.id === transactionId) ||
             allCustomerTxs.find(t => t.id === transactionId) ||
             archiveTransactions.find(t => t.id === transactionId) ||
             transactions.find(t => t.id === transactionId);

    if (!tx) {
      try {
        const stored = localStorage.getItem(`easy_due_transactions_${userId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          tx = parsed.find((t: any) => t.id === transactionId);
        }
      } catch (e) {
        console.warn(e);
      }
    }
    if (!tx) return;

    const diffOld = tx.type === 'due' ? -tx.amount : tx.amount; // reverse old effect
    const diffNew = newType === 'due' ? newAmount : -newAmount; // apply new effect
    const netDiff = diffOld + diffNew;

    const updatedCustomers = customers.map(c => 
      c.id === tx.customerId 
        ? { ...c, outstandingDue: c.outstandingDue + netDiff, updatedAt: new Date() }
        : c
    );

    setCustomers(updatedCustomers);
    saveLocalCustomers(updatedCustomers);

    const editedTimestamp = new Date();
    const previousAuditEntry: TransactionAuditEntry = {
      amount: tx.amount,
      date: tx.date instanceof Date ? tx.date.toISOString() : (tx.date || new Date().toISOString()),
      description: tx.description || '',
      editedAt: (tx.editedAt instanceof Date ? tx.editedAt.toISOString() : tx.editedAt) || (tx.createdAt instanceof Date ? tx.createdAt.toISOString() : tx.createdAt) || new Date().toISOString()
    };
    const currentAuditHistory: TransactionAuditEntry[] = Array.isArray(tx.auditHistory) ? tx.auditHistory : [];
    const newAuditHistory: TransactionAuditEntry[] = [previousAuditEntry, ...currentAuditHistory].slice(0, 5);

    const updatedTx: Transaction = {
      ...tx,
      type: newType,
      amount: newAmount,
      description: newDescription.trim(),
      isEdited: true,
      editedAt: editedTimestamp,
      auditHistory: newAuditHistory
    };

    // Update local cache in localStorage
    try {
      const stored = localStorage.getItem(`easy_due_transactions_${userId}`);
      if (stored) {
        const parsed = JSON.parse(stored).map((t: any) => {
          if (t.id === transactionId) {
            return updatedTx;
          }
          return t;
        });
        localStorage.setItem(`easy_due_transactions_${userId}`, JSON.stringify(parsed));
      }
      const custCacheKey = `easy_due_txs_${userId}_${tx.customerId}`;
      const storedCust = localStorage.getItem(custCacheKey);
      if (storedCust) {
        const parsedCust = JSON.parse(storedCust).map((t: any) => {
          if (t.id === transactionId) {
            return updatedTx;
          }
          return t;
        });
        localStorage.setItem(custCacheKey, JSON.stringify(parsedCust));
      }
    } catch (e) {
      console.warn("Failed to update edited tx in local cache:", e);
    }

    // Update local states optimistically
    setCustomerTransactions(prev => prev.map(t => t.id === transactionId ? updatedTx : t));
    setAllCustomerTxs(prev => prev.map(t => t.id === transactionId ? updatedTx : t));
    setArchiveTransactions(prev => prev.map(t => t.id === transactionId ? updatedTx : t));
    setTransactions(prev => prev.map(t => t.id === transactionId ? updatedTx : t));

    adjustLocalMonthlySummaries(tx, updatedTx);

    if (userId === 'local-guest-session' || isOfflineFallback) return;

    const batch = writeBatch(db);
    batch.update(doc(db, 'users', userId, 'transactions', transactionId), {
      type: newType,
      amount: newAmount,
      description: newDescription.trim(),
      isEdited: true,
      editedAt: serverTimestamp(),
      auditHistory: newAuditHistory
    });
    batch.update(doc(db, 'users', userId, 'customers', tx.customerId), {
      outstandingDue: increment(netDiff),
      updatedAt: serverTimestamp()
    });

    adjustMonthlySummary(batch, userId, tx, updatedTx);
    adjustDailySummary(batch, userId, tx, updatedTx);

    try {
      await batch.commit();
    } catch (err) {
      console.warn("Firestore editTransaction failed, saved locally:", err);
    }
  };

  // Delete a transaction
  const deleteTransaction = async (transactionId: string) => {
    if (!userId) return;

    let tx = customerTransactions.find(t => t.id === transactionId) ||
             allCustomerTxs.find(t => t.id === transactionId) ||
             archiveTransactions.find(t => t.id === transactionId) ||
             transactions.find(t => t.id === transactionId);

    if (!tx) {
      try {
        const stored = localStorage.getItem(`easy_due_transactions_${userId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          tx = parsed.find((t: any) => t.id === transactionId);
        }
      } catch (e) {
        console.warn(e);
      }
    }
    if (!tx) return;

    const diff = tx.type === 'due' ? -tx.amount : tx.amount;

    const updatedCustomers = customers.map(c => 
      c.id === tx.customerId 
        ? { ...c, outstandingDue: c.outstandingDue + diff, updatedAt: new Date() }
        : c
    );

    setCustomers(updatedCustomers);
    saveLocalCustomers(updatedCustomers);

    // Delete from localStorage cache
    try {
      const stored = localStorage.getItem(`easy_due_transactions_${userId}`);
      if (stored) {
        const parsed = JSON.parse(stored).filter((t: any) => t.id !== transactionId);
        localStorage.setItem(`easy_due_transactions_${userId}`, JSON.stringify(parsed));
      }
    } catch (e) {
      console.warn("Failed to delete transaction from local cache:", e);
    }

    // Update memory states optimistically
    setCustomerTransactions(prev => prev.filter(t => t.id !== transactionId));
    setAllCustomerTxs(prev => prev.filter(t => t.id !== transactionId));
    setArchiveTransactions(prev => prev.filter(t => t.id !== transactionId));
    setTransactions(prev => prev.filter(t => t.id !== transactionId));

    adjustLocalMonthlySummaries(tx, null);

    setActiveCustomerTxCount(prev => Math.max(0, prev - 1));
    // Update settings count locally
    if (settings) {
      const newSettings = {
        ...settings,
        transactionsCount: Math.max(0, (settings.transactionsCount || 0) - 1)
      };
      setSettings(newSettings);
      saveLocalSettings(newSettings);
    }

    if (userId === 'local-guest-session' || isOfflineFallback) return;

    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', userId, 'transactions', transactionId));

    // Decrement total transactions count in settings
    const userDocRef = doc(db, 'users', userId);
    batch.update(userDocRef, {
      transactionsCount: increment(-1),
      updatedAt: serverTimestamp()
    });

    adjustMonthlySummary(batch, userId, tx, null);
    adjustDailySummary(batch, userId, tx, null);
    batch.update(doc(db, 'users', userId, 'customers', tx.customerId), {
      outstandingDue: increment(diff),
      updatedAt: serverTimestamp()
    });

    try {
      await batch.commit();
    } catch (err) {
      console.warn("Firestore deleteTransaction failed, saved locally:", err);
    }
  };

  const importLedgerData = async (
    backupData: any,
    choice: 'merge' | 'clear' | 'skip',
    onProgress?: (progress: ImportProgress) => void
  ) => {
    if (!userId) return;

    const isLocal = userId === 'local-guest-session' || isOfflineFallback;
    const isBn = (typeof localStorage !== 'undefined' ? localStorage.getItem('lang') : 'bn') !== 'en';

    // Validate structure
    if (!backupData || !Array.isArray(backupData.customers) || !Array.isArray(backupData.ledgerTransactions)) {
      throw new Error('INVALID_BACKUP_FILE');
    }

    onProgress?.({
      stage: 'parsing',
      percent: 5,
      message: isBn ? 'ব্যাকআপ ফাইল বিশ্লেষণ করা হচ্ছে...' : 'Parsing backup file...'
    });
    await new Promise(r => setTimeout(r, 40));

    // List of Firestore operations to commit
    const operations: { ref: any; data: any; type: 'set' | 'update' | 'delete' }[] = [];

    // Local copies of states we'll update
    // Deleted customers in trash must remain in trash and never be recovered into active customers
    let newCustomers: Customer[] = [...customers];
    let newTrash: Customer[] = [...trashCustomers];
    let newTransactions: Transaction[] = [...transactions];
    let newReminders: Reminder[] = [...reminders];
    let newGoals: SavingGoal[] = [...goals];

    // Build map of trashed customers (existing in trash + any marked deleted in backup)
    const trashCustomerMap = new Map<string, Customer>();
    for (const tc of newTrash) {
      if (tc.name) {
        trashCustomerMap.set(tc.name.trim().toLowerCase(), tc);
      }
    }

    const incomingTrashList: any[] = [
      ...(Array.isArray(backupData.trashCustomers) ? backupData.trashCustomers : []),
      ...(Array.isArray(backupData.customers) ? backupData.customers.filter((c: any) => c && c.isDeleted) : [])
    ];

    for (const btc of incomingTrashList) {
      if (!btc || !btc.name) continue;
      const key = btc.name.trim().toLowerCase();
      if (!trashCustomerMap.has(key)) {
        // Check if this customer is currently in active customers; if so, move them to trash
        const existingActiveIdx = newCustomers.findIndex(c => c.name.trim().toLowerCase() === key);
        if (existingActiveIdx >= 0) {
          const activeCust = newCustomers[existingActiveIdx];
          newCustomers.splice(existingActiveIdx, 1);
          const trashedObj: Customer = {
            ...activeCust,
            isDeleted: true,
            deletedAt: btc.deletedAt ? new Date(btc.deletedAt) : new Date()
          };
          newTrash.push(trashedObj);
          trashCustomerMap.set(key, trashedObj);
          if (!isLocal) {
            operations.push({
              ref: doc(db, 'users', userId, 'customers', trashedObj.id),
              data: { isDeleted: true, deletedAt: trashedObj.deletedAt },
              type: 'update'
            });
          }
        } else {
          const customTrashId = doc(collection(db, 'temp')).id;
          const cDate = btc.createdAt ? new Date(btc.createdAt) : new Date();
          const dDate = btc.deletedAt ? new Date(btc.deletedAt) : new Date();
          const acctType: 'standard' | 'credit_card' = btc.accountType === 'credit_card' ? 'credit_card' : 'standard';
          const validBillingDay =
            acctType === 'credit_card'
              ? Math.min(31, Math.max(1, Math.round(Number(btc.billingDay) || 15)))
              : btc.billingDay !== undefined
              ? Number(btc.billingDay)
              : undefined;
          const trashedObj: Customer = {
            id: customTrashId,
            userId,
            name: btc.name.trim(),
            phone: (btc.phone || '').trim(),
            outstandingDue: Number(btc.outstandingDue) || 0,
            createdAt: cDate,
            updatedAt: new Date(),
            isDeleted: true,
            deletedAt: dDate,
            accountType: acctType,
            ...(validBillingDay !== undefined ? { billingDay: validBillingDay } : {})
          };
          newTrash.push(trashedObj);
          trashCustomerMap.set(key, trashedObj);
          if (!isLocal) {
            const firestoreTrashData: any = {
              id: customTrashId,
              userId,
              name: trashedObj.name,
              phone: trashedObj.phone,
              outstandingDue: trashedObj.outstandingDue,
              createdAt: cDate,
              updatedAt: new Date(),
              isDeleted: true,
              deletedAt: dDate,
              accountType: acctType
            };
            if (validBillingDay !== undefined) {
              firestoreTrashData.billingDay = validBillingDay;
            }
            operations.push({
              ref: doc(db, 'users', userId, 'customers', customTrashId),
              data: firestoreTrashData,
              type: 'set'
            });
          }
        }
      }
    }

    if (choice === 'clear') {
      // Clear Firestore references for existing active customers, transactions, reminders, and goals
      // Note: trashCustomers are preserved in trash so deleted customers stay in trash and are not recovered
      if (!isLocal) {
        for (const c of customers) {
          if (!trashCustomerMap.has(c.name.trim().toLowerCase())) {
            operations.push({
              ref: doc(db, 'users', userId, 'customers', c.id),
              data: null,
              type: 'delete'
            });
          }
        }
        try {
          const allRemoteTxSnap = await getDocs(collection(db, 'users', userId, 'transactions'));
          allRemoteTxSnap.forEach(d => {
            operations.push({
              ref: doc(db, 'users', userId, 'transactions', d.id),
              data: null,
              type: 'delete'
            });
          });
        } catch (e) {
          for (const tx of transactions) {
            operations.push({
              ref: doc(db, 'users', userId, 'transactions', tx.id),
              data: null,
              type: 'delete'
            });
          }
        }
        for (const r of reminders) {
          operations.push({
            ref: doc(db, 'users', userId, 'reminders', r.id),
            data: null,
            type: 'delete'
          });
        }
        for (const g of goals) {
          operations.push({
            ref: doc(db, 'users', userId, 'goals', g.id),
            data: null,
            type: 'delete'
          });
        }
      }

      // Reset active local variables while keeping newTrash intact
      newCustomers = [];
      newTransactions = [];
      newReminders = [];
      newGoals = [];

      // Create new active customers from backup (skipping any customer that is in trash)
      const customerMap = new Map<string, Customer>(); // name lowercased -> Customer object
      
      for (const bc of backupData.customers) {
        if (!bc.name || bc.isDeleted) continue;
        const key = bc.name.trim().toLowerCase();
        // Deleted customers must stay in trash and not be recovered
        if (trashCustomerMap.has(key)) continue;

        const customId = doc(collection(db, 'temp')).id;
        const cDate = bc.createdAt ? new Date(bc.createdAt) : new Date();
        const acctType: 'standard' | 'credit_card' = bc.accountType === 'credit_card' ? 'credit_card' : 'standard';
        const validBillingDay =
          acctType === 'credit_card'
            ? Math.min(31, Math.max(1, Math.round(Number(bc.billingDay) || 15)))
            : bc.billingDay !== undefined
            ? Number(bc.billingDay)
            : undefined;

        const customerObj: Customer = {
          id: customId,
          userId,
          name: bc.name.trim(),
          phone: (bc.phone || '').trim(),
          outstandingDue: Number(bc.outstandingDue) || 0,
          createdAt: cDate,
          updatedAt: new Date(),
          accountType: acctType,
          ...(validBillingDay !== undefined ? { billingDay: validBillingDay } : {})
        };
        customerMap.set(key, customerObj);
        newCustomers.push(customerObj);

        if (!isLocal) {
          const firestoreCustData: any = {
            id: customId,
            userId,
            name: bc.name.trim(),
            phone: (bc.phone || '').trim(),
            outstandingDue: Number(bc.outstandingDue) || 0,
            createdAt: cDate,
            updatedAt: new Date(),
            accountType: acctType
          };
          if (validBillingDay !== undefined) {
            firestoreCustData.billingDay = validBillingDay;
          }
          operations.push({
            ref: doc(db, 'users', userId, 'customers', customId),
            data: firestoreCustData,
            type: 'set'
          });
        }
      }

      // Create transactions from backup (skip transactions for trashed customers so they are not recovered)
      for (const bt of backupData.ledgerTransactions) {
        const cName = bt.customer || (bt as any).customerName; if (!cName) continue;
        const customerNameLower = cName.trim().toLowerCase();
        if (trashCustomerMap.has(customerNameLower)) continue;

        let matchedCustomer = customerMap.get(customerNameLower);
        
        if (!matchedCustomer) {
          const customId = doc(collection(db, 'temp')).id;
          const customerObj: Customer = {
            id: customId,
            userId,
            name: cName.trim(),
            phone: '',
            outstandingDue: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            accountType: 'standard'
          };
          customerMap.set(customerNameLower, customerObj);
          newCustomers.push(customerObj);
          matchedCustomer = customerObj;

          if (!isLocal) {
            operations.push({
              ref: doc(db, 'users', userId, 'customers', customId),
              data: {
                id: customId,
                userId,
                name: cName.trim(),
                phone: '',
                outstandingDue: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
                accountType: 'standard'
              },
              type: 'set'
            });
          }
        }

        const customTxId = doc(collection(db, 'temp')).id;
        const txDate = bt.date ? new Date(bt.date) : new Date();
        const txCreatedAt = bt.createdAt ? new Date(bt.createdAt) : txDate;
        const txObj: Transaction = {
          id: customTxId,
          userId,
          customerId: matchedCustomer.id,
          customerName: matchedCustomer.name,
          type: bt.type,
          amount: Number(bt.amount) || 0,
          description: (bt.description || '').trim(),
          date: txDate,
          createdAt: txCreatedAt,
          ...(bt.isEdited ? { isEdited: true } : {}),
          ...(bt.editedAt ? { editedAt: new Date(bt.editedAt) } : {}),
          ...(bt.promisedDate ? { promisedDate: bt.promisedDate } : {}),
          ...(Array.isArray(bt.auditHistory) ? { auditHistory: bt.auditHistory } : {})
        };
        newTransactions.push(txObj);

        if (!isLocal) {
          const firestoreTxData: any = {
            id: customTxId,
            userId,
            customerId: matchedCustomer.id,
            customerName: matchedCustomer.name,
            type: bt.type,
            amount: Number(bt.amount) || 0,
            description: (bt.description || '').trim(),
            date: txDate,
            createdAt: txCreatedAt
          };
          if (bt.isEdited) firestoreTxData.isEdited = true;
          if (bt.editedAt) firestoreTxData.editedAt = new Date(bt.editedAt);
          if (bt.promisedDate) firestoreTxData.promisedDate = bt.promisedDate;
          if (Array.isArray(bt.auditHistory)) firestoreTxData.auditHistory = bt.auditHistory;

          operations.push({
            ref: doc(db, 'users', userId, 'transactions', customTxId),
            data: firestoreTxData,
            type: 'set'
          });
        }
      }

      // Reconciliation for 'clear': Verify every customer's transactions sum matches their authoritative outstandingDue
      for (const [, cust] of customerMap.entries()) {
        const custTxs = newTransactions.filter(t => t.customerId === cust.id);
        const txSum = custTxs.reduce((sum, t) => sum + (t.type === 'due' ? t.amount : -t.amount), 0);
        const targetDue = cust.outstandingDue || 0;
        const diff = Math.round((targetDue - txSum) * 100) / 100;

        if (Math.abs(diff) >= 0.01) {
          const customTxId = doc(collection(db, 'temp')).id;
          let earliestMs = cust.createdAt ? new Date(cust.createdAt).getTime() : Date.now();
          if (custTxs.length > 0) {
            const minTxMs = Math.min(...custTxs.map(t => new Date(t.date).getTime()));
            earliestMs = Math.min(earliestMs, minTxMs);
          }
          const adjDate = new Date(earliestMs - 1000); // 1 second earlier
          const adjType: 'due' | 'payment' = diff > 0 ? 'due' : 'payment';
          const adjAmount = Math.abs(diff);

          const adjTx: Transaction = {
            id: customTxId,
            userId,
            customerId: cust.id,
            customerName: cust.name,
            type: adjType,
            amount: adjAmount,
            description: 'Initial Balance Adjustment',
            date: adjDate,
            createdAt: adjDate
          };
          newTransactions.push(adjTx);

          if (!isLocal) {
            operations.push({
              ref: doc(db, 'users', userId, 'transactions', customTxId),
              data: {
                id: customTxId,
                userId,
                customerId: cust.id,
                customerName: cust.name,
                type: adjType,
                amount: adjAmount,
                description: 'Initial Balance Adjustment',
                date: adjDate,
                createdAt: adjDate
              },
              type: 'set'
            });
          }
        }
      }
    } else {
      // choice === 'merge' or 'skip'
      // 1. Process customers
      const customerMap = new Map<string, Customer>();
      for (const c of newCustomers) {
        customerMap.set(c.name.trim().toLowerCase(), c);
      }

      const newlyAddedCustomerIds = new Set<string>();

      for (const bc of backupData.customers) {
        if (!bc.name || bc.isDeleted) continue;
        const key = bc.name.trim().toLowerCase();
        // Deleted customers must stay in trash and not be recovered
        if (trashCustomerMap.has(key)) continue;

        const existing = customerMap.get(key);
        const acctType: 'standard' | 'credit_card' = bc.accountType === 'credit_card' ? 'credit_card' : (bc.accountType || 'standard');
        const validBillingDay =
          acctType === 'credit_card'
            ? Math.min(31, Math.max(1, Math.round(Number(bc.billingDay) || 15)))
            : bc.billingDay !== undefined
            ? Number(bc.billingDay)
            : undefined;

        if (existing) {
          if (choice === 'merge') {
            const backupPhone = (bc.phone || '').trim();
            const updatePayload: any = {};
            let hasCustChanges = false;

            if (backupPhone && existing.phone !== backupPhone) {
              existing.phone = backupPhone;
              updatePayload.phone = backupPhone;
              hasCustChanges = true;
            }
            if (bc.accountType && existing.accountType !== acctType) {
              existing.accountType = acctType;
              updatePayload.accountType = acctType;
              hasCustChanges = true;
            }
            if (validBillingDay !== undefined && existing.billingDay !== validBillingDay) {
              existing.billingDay = validBillingDay;
              updatePayload.billingDay = validBillingDay;
              hasCustChanges = true;
            }

            if (hasCustChanges) {
              existing.updatedAt = new Date();
              updatePayload.updatedAt = existing.updatedAt;
              if (!isLocal) {
                operations.push({
                  ref: doc(db, 'users', userId, 'customers', existing.id),
                  data: updatePayload,
                  type: 'update'
                });
              }
            }
          }
        } else {
          // Brand new customer from backup: retain master balance & credit card config
          const customId = doc(collection(db, 'temp')).id;
          const cDate = bc.createdAt ? new Date(bc.createdAt) : new Date();
          const customerObj: Customer = {
            id: customId,
            userId,
            name: bc.name.trim(),
            phone: (bc.phone || '').trim(),
            outstandingDue: Number(bc.outstandingDue) || 0,
            createdAt: cDate,
            updatedAt: new Date(),
            accountType: acctType,
            ...(validBillingDay !== undefined ? { billingDay: validBillingDay } : {})
          };
          customerMap.set(key, customerObj);
          newCustomers.push(customerObj);
          newlyAddedCustomerIds.add(customId);

          if (!isLocal) {
            const firestoreCustData: any = {
              id: customId,
              userId,
              name: bc.name.trim(),
              phone: (bc.phone || '').trim(),
              outstandingDue: Number(bc.outstandingDue) || 0,
              createdAt: cDate,
              updatedAt: new Date(),
              accountType: acctType
            };
            if (validBillingDay !== undefined) {
              firestoreCustData.billingDay = validBillingDay;
            }
            operations.push({
              ref: doc(db, 'users', userId, 'customers', customId),
              data: firestoreCustData,
              type: 'set'
            });
          }
        }
      }

      // Pre-build O(1) duplicate lookup index
      const existingTxSet = new Set<string>();
      for (const tx of newTransactions) {
        const txDateMs = tx.date ? new Date(tx.date).getTime() : 0;
        const roundedSec = Math.floor(txDateMs / 2000);
        existingTxSet.add(`${tx.customerId}|${tx.type}|${tx.amount}|${(tx.description || '').trim().toLowerCase()}|${roundedSec}`);
      }

      // 2. Process transactions (skipping any customer currently in trash so they are not recovered)
      for (const bt of backupData.ledgerTransactions) {
        const cName = bt.customer || (bt as any).customerName; if (!cName) continue;
        const key = cName.trim().toLowerCase();
        if (trashCustomerMap.has(key)) continue;

        let matchedCustomer = customerMap.get(key);

        if (!matchedCustomer) {
          const customId = doc(collection(db, 'temp')).id;
          const customerObj: Customer = {
            id: customId,
            userId,
            name: cName.trim(),
            phone: '',
            outstandingDue: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            accountType: 'standard'
          };
          customerMap.set(key, customerObj);
          newCustomers.push(customerObj);
          matchedCustomer = customerObj;
          newlyAddedCustomerIds.add(customId);

          if (!isLocal) {
            operations.push({
              ref: doc(db, 'users', userId, 'customers', customId),
              data: {
                id: customId,
                userId,
                name: cName.trim(),
                phone: '',
                outstandingDue: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
                accountType: 'standard'
              },
              type: 'set'
            });
          }
        }

        const btDateMs = bt.date ? new Date(bt.date).getTime() : 0;
        const roundedSec = Math.floor(btDateMs / 2000);
        const txKey = `${matchedCustomer.id}|${bt.type}|${bt.amount}|${(bt.description || '').trim().toLowerCase()}|${roundedSec}`;

        if (!existingTxSet.has(txKey)) {
          existingTxSet.add(txKey);
          const customTxId = doc(collection(db, 'temp')).id;
          const txDate = bt.date ? new Date(bt.date) : new Date();
          const txCreatedAt = bt.createdAt ? new Date(bt.createdAt) : txDate;
          const txObj: Transaction = {
            id: customTxId,
            userId,
            customerId: matchedCustomer.id,
            customerName: matchedCustomer.name,
            type: bt.type,
            amount: Number(bt.amount) || 0,
            description: (bt.description || '').trim(),
            date: txDate,
            createdAt: txCreatedAt,
            ...(bt.isEdited ? { isEdited: true } : {}),
            ...(bt.editedAt ? { editedAt: new Date(bt.editedAt) } : {}),
            ...(bt.promisedDate ? { promisedDate: bt.promisedDate } : {}),
            ...(Array.isArray(bt.auditHistory) ? { auditHistory: bt.auditHistory } : {})
          };
          newTransactions.push(txObj);

          if (!isLocal) {
            const firestoreTxData: any = {
              id: customTxId,
              userId,
              customerId: matchedCustomer.id,
              customerName: matchedCustomer.name,
              type: bt.type,
              amount: Number(bt.amount) || 0,
              description: (bt.description || '').trim(),
              date: txDate,
              createdAt: txCreatedAt
            };
            if (bt.isEdited) firestoreTxData.isEdited = true;
            if (bt.editedAt) firestoreTxData.editedAt = new Date(bt.editedAt);
            if (bt.promisedDate) firestoreTxData.promisedDate = bt.promisedDate;
            if (Array.isArray(bt.auditHistory)) firestoreTxData.auditHistory = bt.auditHistory;

            operations.push({
              ref: doc(db, 'users', userId, 'transactions', customTxId),
              data: firestoreTxData,
              type: 'set'
            });
          }

          if (!newlyAddedCustomerIds.has(matchedCustomer.id)) {
            const diff = bt.type === 'due' ? bt.amount : -bt.amount;
            matchedCustomer.outstandingDue += diff;
            matchedCustomer.updatedAt = new Date();
          }
        }
      }

      // For newly added customers in merge/skip: verify ledger matches authoritative outstandingDue
      for (const custId of newlyAddedCustomerIds) {
        const cust = newCustomers.find(c => c.id === custId);
        if (!cust) continue;
        const custTxs = newTransactions.filter(t => t.customerId === cust.id);
        const txSum = custTxs.reduce((sum, t) => sum + (t.type === 'due' ? t.amount : -t.amount), 0);
        const targetDue = cust.outstandingDue || 0;
        const diff = Math.round((targetDue - txSum) * 100) / 100;

        if (Math.abs(diff) >= 0.01) {
          const customTxId = doc(collection(db, 'temp')).id;
          let earliestMs = cust.createdAt ? new Date(cust.createdAt).getTime() : Date.now();
          if (custTxs.length > 0) {
            const minTxMs = Math.min(...custTxs.map(t => new Date(t.date).getTime()));
            earliestMs = Math.min(earliestMs, minTxMs);
          }
          const adjDate = new Date(earliestMs - 1000);
          const adjType: 'due' | 'payment' = diff > 0 ? 'due' : 'payment';
          const adjAmount = Math.abs(diff);

          const adjTx: Transaction = {
            id: customTxId,
            userId,
            customerId: cust.id,
            customerName: cust.name,
            type: adjType,
            amount: adjAmount,
            description: 'Initial Balance Adjustment',
            date: adjDate,
            createdAt: adjDate
          };
          newTransactions.push(adjTx);

          if (!isLocal) {
            operations.push({
              ref: doc(db, 'users', userId, 'transactions', customTxId),
              data: {
                id: customTxId,
                userId,
                customerId: cust.id,
                customerName: cust.name,
                type: adjType,
                amount: adjAmount,
                description: 'Initial Balance Adjustment',
                date: adjDate,
                createdAt: adjDate
              },
              type: 'set'
            });
          }
        }
      }

      // Sync customer balance updates to Firestore for existing customers
      if (!isLocal) {
        for (const c of newCustomers) {
          const opIndex = operations.findIndex(op => op.type === 'set' && op.ref.id === c.id);
          if (opIndex >= 0) {
            operations[opIndex].data.outstandingDue = c.outstandingDue;
            operations[opIndex].data.updatedAt = c.updatedAt;
          } else {
            const original = customers.find(orig => orig.id === c.id);
            if (original && (original.outstandingDue !== c.outstandingDue || original.phone !== c.phone)) {
              operations.push({
                ref: doc(db, 'users', userId, 'customers', c.id),
                data: { 
                  outstandingDue: c.outstandingDue, 
                  phone: c.phone, 
                  updatedAt: c.updatedAt 
                },
                type: 'update'
              });
            }
          }
        }
      }
    }

    // 3. Process Goals from backup (for all choices, including Flexible Savings & EMI)
    if (Array.isArray(backupData.goals)) {
      const existingGoalMap = new Map<string, SavingGoal>();
      for (const g of newGoals) {
        existingGoalMap.set(g.title.trim().toLowerCase(), g);
      }

      for (const bg of backupData.goals) {
        if (!bg.title) continue;
        const goalTitleKey = bg.title.trim().toLowerCase();
        const existingGoal = existingGoalMap.get(goalTitleKey);

        let matchedCustId = bg.customerId;
        let matchedCustName = bg.customerName;
        if (bg.customerName) {
          const matchedCust = newCustomers.find(c => c.name.toLowerCase() === bg.customerName.toLowerCase());
          if (matchedCust) {
            matchedCustId = matchedCust.id;
            matchedCustName = matchedCust.name;
          }
        }

        const isOpenEndedGoal = Boolean(
          bg.isOpenEnded ||
          (bg.frequency === 'flexible' && (bg.type || 'savings') === 'savings' && (!bg.targetAmount || Number(bg.targetAmount) === 0))
        );

        const normalizedContribs: GoalContribution[] = Array.isArray(bg.contributions)
          ? bg.contributions.map((c: any) => ({
              id: c.id || doc(collection(db, 'temp')).id,
              amount: Number(c.amount) || 0,
              date: c.date || new Date().toISOString(),
              ...(c.note ? { note: String(c.note) } : {}),
              type: c.type === 'withdrawal' ? 'withdrawal' : 'deposit'
            }))
          : [];

        if (choice === 'clear' || !existingGoal) {
          const customGoalId = doc(collection(db, 'temp')).id;
          const goalDate = bg.createdAt ? new Date(bg.createdAt) : new Date();
          const goalUpdatedDate = bg.updatedAt ? new Date(bg.updatedAt) : new Date();
          const goalObj: SavingGoal = {
            id: customGoalId,
            userId,
            title: bg.title.trim(),
            targetAmount: Number(bg.targetAmount) || 0,
            savedAmount: Number(bg.savedAmount) || 0,
            frequency: bg.frequency || (isOpenEndedGoal ? 'flexible' : 'monthly'),
            installmentAmount: bg.installmentAmount ? Number(bg.installmentAmount) : undefined,
            type: bg.type || 'savings',
            isOpenEnded: isOpenEndedGoal,
            status: bg.status || 'active',
            customerId: matchedCustId || undefined,
            customerName: matchedCustName || undefined,
            notes: bg.notes?.trim() || undefined,
            principalAmount: bg.principalAmount ? Number(bg.principalAmount) : undefined,
            interestRate: bg.interestRate !== undefined ? Number(bg.interestRate) : undefined,
            interestAmount: bg.interestAmount !== undefined ? Number(bg.interestAmount) : undefined,
            tenure: bg.tenure ? Number(bg.tenure) : undefined,
            createdAt: goalDate,
            updatedAt: goalUpdatedDate,
            contributions: normalizedContribs
          };
          newGoals.push(goalObj);
          existingGoalMap.set(goalTitleKey, goalObj);

          if (!isLocal) {
            const firestoreGoalData: any = {
              id: customGoalId,
              userId,
              title: goalObj.title,
              targetAmount: goalObj.targetAmount,
              savedAmount: goalObj.savedAmount,
              frequency: goalObj.frequency,
              type: goalObj.type,
              isOpenEnded: isOpenEndedGoal,
              status: goalObj.status,
              createdAt: goalDate,
              updatedAt: goalUpdatedDate,
              contributions: normalizedContribs
            };
            if (goalObj.installmentAmount !== undefined) firestoreGoalData.installmentAmount = goalObj.installmentAmount;
            if (goalObj.customerId) firestoreGoalData.customerId = goalObj.customerId;
            if (goalObj.customerName) firestoreGoalData.customerName = goalObj.customerName;
            if (goalObj.notes) firestoreGoalData.notes = goalObj.notes;
            if (goalObj.principalAmount !== undefined) firestoreGoalData.principalAmount = goalObj.principalAmount;
            if (goalObj.interestRate !== undefined) firestoreGoalData.interestRate = goalObj.interestRate;
            if (goalObj.interestAmount !== undefined) firestoreGoalData.interestAmount = goalObj.interestAmount;
            if (goalObj.tenure !== undefined) firestoreGoalData.tenure = goalObj.tenure;

            operations.push({
              ref: doc(db, 'users', userId, 'goals', customGoalId),
              data: firestoreGoalData,
              type: 'set'
            });
          }
        } else if (choice === 'merge' && existingGoal) {
          const backupSaved = Number(bg.savedAmount) || 0;
          const shouldUpdateGoal =
            normalizedContribs.length > (existingGoal.contributions?.length || 0) ||
            (isOpenEndedGoal && backupSaved !== (existingGoal.savedAmount || 0)) ||
            (!isOpenEndedGoal && backupSaved > (existingGoal.savedAmount || 0)) ||
            Boolean(existingGoal.isOpenEnded) !== isOpenEndedGoal;

          if (shouldUpdateGoal) {
            existingGoal.isOpenEnded = isOpenEndedGoal;
            if (normalizedContribs.length >= (existingGoal.contributions?.length || 0)) {
              existingGoal.contributions = normalizedContribs;
              existingGoal.savedAmount = isOpenEndedGoal
                ? backupSaved
                : Math.max(existingGoal.savedAmount || 0, backupSaved);
            } else {
              existingGoal.savedAmount = Math.max(existingGoal.savedAmount || 0, backupSaved);
            }
            existingGoal.status = bg.status || existingGoal.status;
            existingGoal.updatedAt = new Date();

            if (!isLocal) {
              operations.push({
                ref: doc(db, 'users', userId, 'goals', existingGoal.id),
                data: {
                  isOpenEnded: existingGoal.isOpenEnded,
                  savedAmount: existingGoal.savedAmount,
                  contributions: existingGoal.contributions,
                  status: existingGoal.status,
                  updatedAt: new Date()
                },
                type: 'update'
              });
            }
          }
        }
      }
    }

    // 3b. Process Reminders from backup (Customer & EMI reminders)
    if (Array.isArray(backupData.reminders)) {
      for (const br of backupData.reminders) {
        const remType: 'customer' | 'emi' = br.type === 'emi' ? 'emi' : 'customer';
        const remCustName = (br.customerName || '').trim();
        if (remType === 'customer' && remCustName && trashCustomerMap.has(remCustName.toLowerCase())) {
          continue;
        }
        let matchedCustId = br.customerId || '';
        let matchedGoalId = br.goalId;

        if (remCustName) {
          const foundCust = newCustomers.find(c => c.name.toLowerCase() === remCustName.toLowerCase());
          if (foundCust) matchedCustId = foundCust.id;
        }
        if (remType === 'emi') {
          const goalTitleToMatch = (br.goalTitle || remCustName).toLowerCase();
          const foundGoal = newGoals.find(g => g.title.toLowerCase() === goalTitleToMatch);
          if (foundGoal) {
            matchedGoalId = foundGoal.id;
            if (!matchedCustId) matchedCustId = foundGoal.id;
          }
        }

        const alreadyExists = newReminders.some(r =>
          r.type === remType &&
          r.customerName?.toLowerCase() === remCustName.toLowerCase() &&
          (remType === 'emi' ? r.emiDayOfMonth === br.emiDayOfMonth : true)
        );

        if (choice === 'clear' || !alreadyExists) {
          const customRemId = doc(collection(db, 'temp')).id;
          const remDueDate = br.dueDate ? new Date(br.dueDate) : new Date();
          const remCreatedAt = br.createdAt ? new Date(br.createdAt) : new Date();
          const remObj: Reminder = {
            id: customRemId,
            userId,
            customerId: matchedCustId,
            customerName: remCustName || 'Reminder',
            notes: (br.notes || '').trim(),
            dueDate: remDueDate,
            active: br.active !== undefined ? Boolean(br.active) : true,
            createdAt: remCreatedAt,
            type: remType,
            ...(matchedGoalId ? { goalId: matchedGoalId } : {}),
            ...(br.emiDayOfMonth !== undefined ? { emiDayOfMonth: Number(br.emiDayOfMonth) } : {}),
            ...(br.installmentAmount !== undefined ? { installmentAmount: Number(br.installmentAmount) } : {})
          };
          newReminders.push(remObj);

          if (!isLocal) {
            const firestoreRemData: any = {
              id: customRemId,
              userId,
              customerId: remObj.customerId,
              customerName: remObj.customerName,
              notes: remObj.notes,
              dueDate: remDueDate,
              active: remObj.active,
              createdAt: remCreatedAt,
              type: remType
            };
            if (matchedGoalId) firestoreRemData.goalId = matchedGoalId;
            if (br.emiDayOfMonth !== undefined) firestoreRemData.emiDayOfMonth = Number(br.emiDayOfMonth);
            if (br.installmentAmount !== undefined) firestoreRemData.installmentAmount = Number(br.installmentAmount);

            operations.push({
              ref: doc(db, 'users', userId, 'reminders', customRemId),
              data: firestoreRemData,
              type: 'set'
            });
          }
        }
      }
    }

    // 4. Execute Firestore batch commits with live progress and thread yielding
    if (!isLocal && operations.length > 0) {
      const chunkArray = <T>(arr: T[], size: number): T[][] => {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
          chunks.push(arr.slice(i, i + size));
        }
        return chunks;
      };

      const chunks = chunkArray(operations, 400);
      let batchIdx = 0;
      for (const chunk of chunks) {
        batchIdx++;
        const percent = 10 + Math.round((batchIdx / chunks.length) * 75);
        onProgress?.({
          stage: 'saving',
          percent,
          currentBatch: batchIdx,
          totalBatches: chunks.length,
          processedCount: Math.min(operations.length, batchIdx * 400),
          totalCount: operations.length,
          message: isBn
            ? 'ক্লাউড সার্ভারে ডাটা সংরক্ষণ হচ্ছে...'
            : 'Saving data to cloud server...'
        });

        const batch = writeBatch(db);
        for (const op of chunk) {
          if (op.type === 'set') {
            batch.set(op.ref, op.data);
          } else if (op.type === 'update') {
            batch.update(op.ref, op.data);
          } else if (op.type === 'delete') {
            batch.delete(op.ref);
          }
        }
        await batch.commit();
        await new Promise(r => setTimeout(r, 25));
      }
    }

    // Update local state
    setCustomers(newCustomers.filter(c => !c.isDeleted));
    setTrashCustomers(newTrash);
    setTransactions(newTransactions);
    setReminders(newReminders);
    setGoals(newGoals);

    // Save to local storage
    saveLocalCustomers([...newCustomers, ...newTrash]);
    saveLocalTransactions(newTransactions);
    saveLocalReminders(newReminders);
    saveLocalGoals(newGoals);

    // Restore and retain pinned customers from backup (excluding trashed customers)
    try {
      const importedPinned = new Set<string>();
      if (Array.isArray(backupData.pinnedCustomerNames)) {
        backupData.pinnedCustomerNames.forEach((n: any) => {
          if (typeof n === 'string' && !trashCustomerMap.has(n.trim().toLowerCase())) {
            importedPinned.add(n);
          }
        });
      }
      if (Array.isArray(backupData.customers)) {
        backupData.customers.forEach((c: any) => {
          if (c.isPinned && c.name && !c.isDeleted && !trashCustomerMap.has(c.name.trim().toLowerCase())) {
            importedPinned.add(c.name);
          }
        });
      }
      if (importedPinned.size > 0) {
        let existingPinned: string[] = [];
        try {
          const stored = localStorage.getItem('pinned_customers_names');
          if (stored) existingPinned = JSON.parse(stored);
        } catch {}
        const mergedPinned = (choice === 'clear'
          ? Array.from(importedPinned)
          : Array.from(new Set([...existingPinned, ...Array.from(importedPinned)])))
          .filter(n => !trashCustomerMap.has(String(n).trim().toLowerCase()));
        localStorage.setItem('pinned_customers_names', JSON.stringify(mergedPinned));
        window.dispatchEvent(new Event('storage'));
      }
    } catch (e) {
      console.warn("Failed to restore pinned customers from backup:", e);
    }

    try {
      if (backupData.preferences?.searchBanglaInEnglish !== undefined) {
        localStorage.setItem('search_bangla_in_english', String(backupData.preferences.searchBanglaInEnglish));
        window.dispatchEvent(new CustomEvent('phonetic-search-toggle', { detail: { enabled: Boolean(backupData.preferences.searchBanglaInEnglish) } }));
      }
    } catch (e) {
      // ignore
    }

    if (settings) {
      const newSettings = {
        ...settings,
        transactionsCount: newTransactions.length
      };
      setSettings(newSettings);
      saveLocalSettings(newSettings);
    }

    setTransactions(newTransactions);
    setCustomerTransactions([]);
    setAllCustomerTxs([]);
    setArchiveTransactions([]);

    if (!isLocal) {
      onProgress?.({
        stage: 'summaries',
        percent: 90,
        message: isBn ? 'মাসিক সারাংশ ও এনালিটিক্স তৈরি হচ্ছে...' : 'Rebuilding monthly analytics...'
      });
      await rebuildMonthlySummaries(userId);
    }

    onProgress?.({
      stage: 'done',
      percent: 100,
      message: isBn ? 'ইম্পোর্ট সফলভাবে সম্পন্ন হয়েছে!' : 'Data imported successfully!'
    });
  };

  // Note: Automated full-database scans on startup were decommissioned to protect Firebase read limits.
  // Rebuilding summaries is available on-demand via SettingsManager ("Rebuild & Repair") and during data imports.

  // 5. Automatic cleanup of trashed items older than 14 days
  useEffect(() => {
    if (!userId || loading || trashCustomers.length === 0) return;

    const now = new Date().getTime();
    const fourteenDaysInMs = 14 * 24 * 60 * 60 * 1000;
    
    const expiredCustomers = trashCustomers.filter(c => {
      if (!c.deletedAt) return false;
      const deletedTime = new Date(c.deletedAt).getTime();
      return (now - deletedTime) > fourteenDaysInMs;
    });

    if (expiredCustomers.length > 0) {
      expiredCustomers.forEach(c => {
        permanentlyDeleteCustomer(c.id);
      });
    }
  }, [userId, loading, trashCustomers]);

  // Goal CRUD actions
  const createGoal = async (
    title: string,
    targetAmount: number,
    frequency: 'daily' | 'weekly' | 'monthly' | 'flexible',
    installmentAmount?: number,
    type: 'savings' | 'deposit' = 'savings',
    customerId?: string,
    customerName?: string,
    notes?: string,
    principalAmount?: number,
    interestRate?: number,
    interestAmount?: number,
    tenure?: number,
    isOpenEnded?: boolean
  ) => {
    if (!userId) return null;
    const customGoalId = doc(collection(db, 'temp')).id;
    const newGoal: SavingGoal = {
      id: customGoalId,
      userId,
      title: title.trim(),
      targetAmount: Number(targetAmount) || 0,
      savedAmount: 0,
      frequency,
      installmentAmount: installmentAmount && installmentAmount > 0 ? Number(installmentAmount) : undefined,
      type,
      isOpenEnded: Boolean(isOpenEnded),
      customerId: customerId || undefined,
      customerName: customerName || undefined,
      notes: notes?.trim() || undefined,
      principalAmount: principalAmount ? Number(principalAmount) : undefined,
      interestRate: interestRate !== undefined ? Number(interestRate) : undefined,
      interestAmount: interestAmount !== undefined ? Number(interestAmount) : undefined,
      tenure: tenure ? Number(tenure) : undefined,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      contributions: []
    };

    const updatedGoals = [newGoal, ...goals];
    setGoals(updatedGoals);
    saveLocalGoals(updatedGoals);

    if (userId === 'local-guest-session' || isOfflineFallback) {
      return customGoalId;
    }

    const goalDocRef = doc(db, 'users', userId, 'goals', customGoalId);
    const firestoreGoal: any = {
      id: customGoalId,
      userId,
      title: title.trim(),
      targetAmount: Number(targetAmount) || 0,
      savedAmount: 0,
      frequency,
      type,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      contributions: []
    };
    if (isOpenEnded) firestoreGoal.isOpenEnded = true;
    if (installmentAmount && installmentAmount > 0) firestoreGoal.installmentAmount = Number(installmentAmount);
    if (customerId) firestoreGoal.customerId = customerId;
    if (customerName) firestoreGoal.customerName = customerName;
    if (notes) firestoreGoal.notes = notes.trim();
    if (principalAmount) firestoreGoal.principalAmount = Number(principalAmount);
    if (interestRate !== undefined) firestoreGoal.interestRate = Number(interestRate);
    if (interestAmount !== undefined) firestoreGoal.interestAmount = Number(interestAmount);
    if (tenure) firestoreGoal.tenure = Number(tenure);

    try {
      await setDoc(goalDocRef, firestoreGoal);
      return customGoalId;
    } catch (err) {
      console.warn("Firestore createGoal failed, saved locally:", err);
      return customGoalId;
    }
  };

  const addGoalContribution = async (
    goalId: string,
    amount: number,
    note: string = '',
    recordAsCustomerTransaction: boolean = false,
    contributionType: 'deposit' | 'withdrawal' = 'deposit'
  ): Promise<SavingGoal | null> => {
    if (!userId || !amount || amount <= 0) return null;

    const goal = goals.find(g => g.id === goalId);
    if (!goal) return null;

    const contributionId = doc(collection(db, 'temp')).id;
    const newContribution: GoalContribution = {
      id: contributionId,
      amount,
      date: new Date().toISOString(),
      note: note.trim(),
      type: contributionType
    };

    const currentContributions = Array.isArray(goal.contributions) ? goal.contributions : [];
    const updatedContributions = [...currentContributions, newContribution];
    
    let newSavedAmount = Number(goal.savedAmount) || 0;
    if (contributionType === 'withdrawal') {
      newSavedAmount = Math.max(0, newSavedAmount - amount);
    } else {
      newSavedAmount = newSavedAmount + amount;
    }

    const isCompleted = (!goal.isOpenEnded && (Number(goal.targetAmount) || 0) > 0)
      ? newSavedAmount >= (Number(goal.targetAmount) || 0)
      : false;
    const newStatus = isCompleted ? ('completed' as const) : (goal.status === 'completed' && !isCompleted ? 'active' : goal.status);

    const updatedGoal: SavingGoal = {
      ...goal,
      savedAmount: newSavedAmount,
      status: newStatus,
      contributions: updatedContributions,
      updatedAt: new Date()
    };

    const updatedGoals = goals.map(g => (g.id === goalId ? updatedGoal : g));

    setGoals(updatedGoals);
    saveLocalGoals(updatedGoals);

    // Handle optional ledger recording (log as payment/due transaction in customer's account)
    if (recordAsCustomerTransaction && goal.customerId) {
      const linkedCust = customers.find(c => c.id === goal.customerId);
      const cName = goal.customerName || linkedCust?.name || 'Customer';
      const cPhone = linkedCust?.phone || '';
      const txDesc = note.trim()
        ? `${note.trim()} (${goal.title})`
        : `${contributionType === 'withdrawal' ? 'Flexible Savings Withdrawal' : 'Flexible Savings Deposit'}: ${goal.title}`;

      // Deposits reduce customer due or represent payment received ('payment')
      // Withdrawals represent funds taken out or cash given ('due')
      const ledgerTxType = contributionType === 'withdrawal' ? 'due' : 'payment';

      await addTransaction(
        goal.customerId,
        ledgerTxType,
        amount,
        txDesc,
        new Date(),
        { name: cName, phone: cPhone }
      );
    }

    if (userId === 'local-guest-session' || isOfflineFallback) {
      return updatedGoal;
    }

    const goalDocRef = doc(db, 'users', userId, 'goals', goalId);
    try {
      await updateDoc(goalDocRef, {
        savedAmount: newSavedAmount,
        status: newStatus,
        contributions: updatedContributions,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn("Firestore addGoalContribution failed, saved locally:", err);
    }

    return updatedGoal;
  };

  const deleteGoal = async (goalId: string) => {
    if (!userId) return;

    const updatedGoals = goals.filter(g => g.id !== goalId);
    setGoals(updatedGoals);
    saveLocalGoals(updatedGoals);

    if (userId === 'local-guest-session' || isOfflineFallback) return;

    const goalDocRef = doc(db, 'users', userId, 'goals', goalId);
    try {
      await deleteDoc(goalDocRef);
    } catch (err) {
      console.warn("Firestore deleteGoal failed, saved locally:", err);
    }
  };

  const updateGoalStatus = async (goalId: string, status: 'active' | 'completed' | 'cancelled') => {
    if (!userId) return;

    const updatedGoals = goals.map(g => 
      g.id === goalId ? { ...g, status, updatedAt: new Date() } : g
    );
    setGoals(updatedGoals);
    saveLocalGoals(updatedGoals);

    if (userId === 'local-guest-session' || isOfflineFallback) return;

    const goalDocRef = doc(db, 'users', userId, 'goals', goalId);
    try {
      await updateDoc(goalDocRef, {
        status,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn("Firestore updateGoalStatus failed, saved locally:", err);
    }
  };

  const updateGoalTitle = async (goalId: string, newTitle: string) => {
    if (!userId || !newTitle.trim()) return;
    const trimmed = newTitle.trim();
    const updatedGoals = goals.map(g => 
      g.id === goalId ? { ...g, title: trimmed, updatedAt: new Date() } : g
    );
    setGoals(updatedGoals);
    saveLocalGoals(updatedGoals);

    if (userId === 'local-guest-session' || isOfflineFallback) return;

    const goalDocRef = doc(db, 'users', userId, 'goals', goalId);
    try {
      await updateDoc(goalDocRef, {
        title: trimmed,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn("Firestore updateGoalTitle failed, saved locally:", err);
    }
  };

  const updateGoalNotes = async (goalId: string, newNotes: string) => {
    if (!userId) return;
    const trimmed = newNotes.trim();
    const updatedGoals = goals.map(g => 
      g.id === goalId ? { ...g, notes: trimmed || undefined, updatedAt: new Date() } : g
    );
    setGoals(updatedGoals);
    saveLocalGoals(updatedGoals);

    if (userId === 'local-guest-session' || isOfflineFallback) return;

    const goalDocRef = doc(db, 'users', userId, 'goals', goalId);
    try {
      await updateDoc(goalDocRef, {
        notes: trimmed,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn("Firestore updateGoalNotes failed, saved locally:", err);
    }
  };

  const editGoalContribution = async (
    goalId: string,
    contributionId: string,
    newAmount: number,
    newNote: string
  ) => {
    if (!userId || newAmount <= 0) return;
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    const currentContribs = goal.contributions || [];
    const targetContrib = currentContribs.find(c => (c.id && c.id === contributionId) || (!c.id && c.date === contributionId));
    if (!targetContrib) return;

    const isWithdrawal = targetContrib.type === 'withdrawal';
    const oldAmt = targetContrib.amount;
    const netDelta = isWithdrawal ? (oldAmt - newAmount) : (newAmount - oldAmt);

    const updatedContribs = currentContribs.map(c => 
      ((c.id && c.id === contributionId) || (!c.id && c.date === contributionId))
        ? { ...c, id: c.id || contributionId, amount: newAmount, note: newNote.trim() }
        : c
    );
    const newSaved = Math.max(0, (goal.savedAmount || 0) + netDelta);
    const isCompleted = (!goal.isOpenEnded && (Number(goal.targetAmount) || 0) > 0)
      ? newSaved >= (Number(goal.targetAmount) || 0)
      : false;
    const newStatus = isCompleted ? ('completed' as const) : (goal.status === 'completed' && !isCompleted ? 'active' : goal.status);

    const updatedGoal: SavingGoal = {
      ...goal,
      savedAmount: newSaved,
      status: newStatus,
      contributions: updatedContribs,
      updatedAt: new Date()
    };

    const updatedGoals = goals.map(g => (g.id === goalId ? updatedGoal : g));
    setGoals(updatedGoals);
    saveLocalGoals(updatedGoals);

    if (userId === 'local-guest-session' || isOfflineFallback) return;

    const goalDocRef = doc(db, 'users', userId, 'goals', goalId);
    try {
      await updateDoc(goalDocRef, {
        savedAmount: newSaved,
        status: newStatus,
        contributions: updatedContribs,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn("Firestore editGoalContribution failed, saved locally:", err);
    }
  };

  const deleteGoalContribution = async (goalId: string, contributionId: string) => {
    if (!userId) return;
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    const currentContribs = goal.contributions || [];
    const targetContrib = currentContribs.find(c => (c.id && c.id === contributionId) || (!c.id && c.date === contributionId));
    if (!targetContrib) return;

    const updatedContribs = currentContribs.filter(c => 
      !((c.id && c.id === contributionId) || (!c.id && c.date === contributionId))
    );
    const isWithdrawal = targetContrib.type === 'withdrawal';
    const newSaved = isWithdrawal
      ? ((goal.savedAmount || 0) + targetContrib.amount)
      : Math.max(0, (goal.savedAmount || 0) - targetContrib.amount);

    const isCompleted = (!goal.isOpenEnded && (Number(goal.targetAmount) || 0) > 0)
      ? newSaved >= (Number(goal.targetAmount) || 0)
      : false;
    const newStatus = isCompleted ? ('completed' as const) : (goal.status === 'completed' && !isCompleted ? 'active' : goal.status);

    const updatedGoal: SavingGoal = {
      ...goal,
      savedAmount: newSaved,
      status: newStatus,
      contributions: updatedContribs,
      updatedAt: new Date()
    };

    const updatedGoals = goals.map(g => (g.id === goalId ? updatedGoal : g));
    setGoals(updatedGoals);
    saveLocalGoals(updatedGoals);

    if (userId === 'local-guest-session' || isOfflineFallback) return;

    const goalDocRef = doc(db, 'users', userId, 'goals', goalId);
    try {
      await updateDoc(goalDocRef, {
        savedAmount: newSaved,
        status: newStatus,
        contributions: updatedContribs,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn("Firestore deleteGoalContribution failed, saved locally:", err);
    }
  };

  const exportBackup = async () => {
    if (!userId) return null;
    let allTxs: Transaction[] = [];
    if (userId === 'local-guest-session' || isOfflineFallback) {
      allTxs = transactions;
    } else {
      try {
        const txRef = collection(db, 'users', userId, 'transactions');
        const q = query(txRef, orderBy('date', 'desc'));
        const querySnap = await getDocs(q);
        querySnap.forEach((docSnap) => {
          const data = docSnap.data();
          allTxs.push({
            ...data,
            id: docSnap.id,
            date: data.date?.toDate ? data.date.toDate().toISOString() : new Date(data.date).toISOString(),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString()),
          } as any);
        });
      } catch (err) {
        console.warn("Failed to fetch transactions for backup:", err);
        allTxs = transactions;
      }
    }

    let pinnedNames: string[] = [];
    try {
      const storedPinned = localStorage.getItem('pinned_customers_names');
      if (storedPinned) pinnedNames = JSON.parse(storedPinned);
    } catch {}

    const trashIds = new Set(trashCustomers.map(tc => tc.id));
    const trashNamesLower = new Set(trashCustomers.map(tc => (tc.name || '').trim().toLowerCase()));
    const activeTxsForBackup = allTxs.filter(t => {
      if (t.customerId && trashIds.has(t.customerId)) return false;
      const tName = (t.customerName || (t as any).customer || '').trim().toLowerCase();
      if (tName && trashNamesLower.has(tName)) return false;
      return true;
    });

    return {
      backupTimestamp: new Date().toISOString(),
      ownerEmail: settings?.email || 'unknown',
      pinnedCustomerNames: pinnedNames.filter(n => !trashNamesLower.has(String(n).trim().toLowerCase())),
      customers: customers.map(c => ({
        name: c.name,
        phone: c.phone,
        outstandingDue: c.outstandingDue,
        accountType: c.accountType || 'standard',
        ...(c.accountType === 'credit_card' || c.billingDay !== undefined
          ? { billingDay: c.accountType === 'credit_card' ? (c.billingDay || 15) : c.billingDay }
          : {}),
        createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : (c.createdAt?.toDate ? c.createdAt.toDate().toISOString() : c.createdAt),
        updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : (c.updatedAt?.toDate ? c.updatedAt.toDate().toISOString() : c.updatedAt),
        isPinned: pinnedNames.includes(c.name) || !!c.isPinned
      })),
      trashCustomers: trashCustomers.map(c => ({
        name: c.name,
        phone: c.phone,
        outstandingDue: c.outstandingDue,
        accountType: c.accountType || 'standard',
        ...(c.accountType === 'credit_card' || c.billingDay !== undefined
          ? { billingDay: c.accountType === 'credit_card' ? (c.billingDay || 15) : c.billingDay }
          : {}),
        isDeleted: true,
        deletedAt: c.deletedAt instanceof Date ? c.deletedAt.toISOString() : ((c.deletedAt as any)?.toDate ? (c.deletedAt as any).toDate().toISOString() : (c.deletedAt || new Date().toISOString())),
        createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : (c.createdAt?.toDate ? c.createdAt.toDate().toISOString() : c.createdAt),
        updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : (c.updatedAt?.toDate ? c.updatedAt.toDate().toISOString() : c.updatedAt)
      })),
      ledgerTransactions: activeTxsForBackup.map(t => ({
        customer: t.customerName,
        customerName: t.customerName,
        type: t.type,
        amount: t.amount,
        description: t.description,
        date: t.date instanceof Date ? t.date.toISOString() : (t.date?.toDate ? t.date.toDate().toISOString() : t.date),
        createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : (t.createdAt?.toDate ? t.createdAt.toDate().toISOString() : t.createdAt),
        ...(t.isEdited ? { isEdited: true } : {}),
        ...(t.editedAt ? { editedAt: t.editedAt instanceof Date ? t.editedAt.toISOString() : (t.editedAt?.toDate ? t.editedAt.toDate().toISOString() : t.editedAt) } : {}),
        ...(t.promisedDate ? { promisedDate: t.promisedDate } : {}),
        ...(Array.isArray(t.auditHistory) && t.auditHistory.length > 0 ? { auditHistory: t.auditHistory } : {})
      })),
      goals: goals.map(g => ({
        id: g.id,
        title: g.title,
        targetAmount: g.targetAmount,
        savedAmount: g.savedAmount,
        frequency: g.frequency,
        installmentAmount: g.installmentAmount,
        type: g.type,
        isOpenEnded: Boolean(g.isOpenEnded),
        status: g.status,
        customerId: g.customerId,
        customerName: g.customerName || (g.customerId ? customers.find(c => c.id === g.customerId)?.name : undefined),
        notes: g.notes,
        principalAmount: g.principalAmount,
        interestRate: g.interestRate,
        interestAmount: g.interestAmount,
        tenure: g.tenure,
        createdAt: g.createdAt instanceof Date ? g.createdAt.toISOString() : (g.createdAt?.toDate ? g.createdAt.toDate().toISOString() : g.createdAt),
        updatedAt: g.updatedAt instanceof Date ? g.updatedAt.toISOString() : (g.updatedAt?.toDate ? g.updatedAt.toDate().toISOString() : g.updatedAt),
        contributions: (g.contributions || []).map(c => ({
          id: c.id,
          amount: c.amount,
          date: c.date,
          note: c.note,
          type: c.type || 'deposit'
        }))
      })),
      reminders: reminders.map(r => ({
        id: r.id,
        customerName: r.customerName,
        notes: r.notes,
        dueDate: r.dueDate instanceof Date ? r.dueDate.toISOString() : (r.dueDate?.toDate ? r.dueDate.toDate().toISOString() : r.dueDate),
        active: r.active,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.createdAt?.toDate ? r.createdAt.toDate().toISOString() : r.createdAt),
        type: r.type || 'customer',
        goalId: r.goalId,
        goalTitle: r.goalId ? goals.find(g => g.id === r.goalId)?.title : undefined,
        emiDayOfMonth: r.emiDayOfMonth,
        installmentAmount: r.installmentAmount
      })),
      preferences: {
        searchBanglaInEnglish: (() => {
          try {
            return localStorage.getItem('search_bangla_in_english') === 'true';
          } catch {
            return false;
          }
        })()
      }
    };
  };

  return {
    customers,
    trashCustomers,
    customerTransactions: customerTransactions.filter(t => customers.some(c => c.id === t.customerId)),
    dailyTransactions: dailyTransactions.filter(t => customers.some(c => c.id === t.customerId)),
    todayTransactions: todayTransactions.filter(t => customers.some(c => c.id === t.customerId)),
    reminders: reminders.filter(r => r.type === 'emi' || Boolean(r.goalId) || customers.some(c => c.id === r.customerId)),
    settings,
    loading,
    isOfflineFallback,
    updateTheme,
    updateSettings,
    createCustomer,
    updateCustomerDetails,
    addTransaction,
    editTransaction,
    deleteTransaction,
    addReminder,
    toggleReminder,
    deleteReminder,
    deleteCustomer,
    restoreCustomer,
    permanentlyDeleteCustomer,
    emptyTrash,
    importLedgerData,
    activeCustomerTxCount,
    hasMoreCustomerTxs: customerTransactions.length < activeCustomerTxCount && activeCustomerTxCount > 5,
    customerTxLimit,
    loadMoreCustomerTransactions: () => setCustomerTxLimit(prev => prev + 10),
    resetCustomerTxLimit: () => setCustomerTxLimit(5),
    monthlySummaries: effectiveMonthlySummaries,
    goals,
    goalsSynced,
    createGoal,
    addGoalContribution,
    deleteGoal,
    updateGoalStatus,
    updateGoalTitle,
    updateGoalNotes,
    editGoalContribution,
    deleteGoalContribution,
    exportBackup,
    rebuildMonthlySummaries: async () => { if (userId) await rebuildMonthlySummaries(userId); },
    archivedStatements,
    updateStatementAutoMerge,
    archiveCustomerExcessStatements,
    exportArchivedStatements
  };
}