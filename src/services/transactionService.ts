import { 
  addDoc, 
  serverTimestamp, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  where, 
  getDocs, 
  writeBatch,
  Timestamp 
} from "firebase/firestore";
import { transactionsCol, userDoc } from "./firebase/collections";
import { db } from "./firebase/client"; 
import { Transaction, UserSettings, CreateTransactionDTO } from "@/types/transaction";
import { encryptData, decryptData } from "@/lib/crypto";

// --- Helper de Data Seguro (UTC) ---
const addMonthsUTC = (dateStr: string, monthsToAdd: number): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const targetMonthDate = new Date(Date.UTC(year, (month - 1) + monthsToAdd, 1));
  const lastDayOfTargetMonth = new Date(Date.UTC(targetMonthDate.getUTCFullYear(), targetMonthDate.getUTCMonth() + 1, 0));
  const maxDays = lastDayOfTargetMonth.getUTCDate();
  const finalDay = Math.min(day, maxDays);
  const finalDate = new Date(Date.UTC(targetMonthDate.getUTCFullYear(), targetMonthDate.getUTCMonth(), finalDay));
  return finalDate.toISOString().split('T')[0];
};

// --- Transações ---

export const subscribeToTransactions = (uid: string, callback: (data: Transaction[]) => void) => {
  const q = query(transactionsCol(uid), orderBy("date", "desc"));
  
  return onSnapshot(q, async (snapshot) => {
    const transactionsPromises = snapshot.docs.map(async (doc) => {
      const data = doc.data();
      const decryptedDesc = data.isEncrypted ? await decryptData(data.description, uid) : data.description;
      const decryptedAmount = data.isEncrypted ? await decryptData(data.amount, uid) : data.amount;

      return {
        id: doc.id,
        ...data,
        description: decryptedDesc,
        amount: Number(decryptedAmount),
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
      } as Transaction;
    });

    const transactions = await Promise.all(transactionsPromises);
    callback(transactions);
  });
};

export const addTransaction = async (uid: string, tx: CreateTransactionDTO) => {
  const batchPromises = [];
  const groupId = crypto.randomUUID();
  const count = tx.isInstallment ? Math.max(1, Math.floor(tx.installmentsCount)) : 1;
  
  const basePurchaseDate = tx.date;
  const baseDueDate = tx.dueDate;

  const encryptedDesc = await encryptData(tx.description, uid);
  const encryptedAmount = await encryptData(tx.amount, uid);

  for (let i = 0; i < count; i++) {
    const currentDueDate = addMonthsUTC(baseDueDate, i);

    const newTx: Record<string, unknown> = {
      userId: uid,
      description: encryptedDesc,
      amount: encryptedAmount,
      type: tx.type,
      category: tx.category,
      paymentMethod: tx.paymentMethod,
      status: "pending",
      date: basePurchaseDate,
      dueDate: currentDueDate,
      createdAt: serverTimestamp(),
      isEncrypted: true,
      
      ...(tx.isInstallment && {
        groupId,
        installmentCurrent: i + 1,
        installmentTotal: count,
      })
    };
    
    if (tx.isInstallment) {
        const descWithInstallment = `${tx.description} (${i + 1}/${count})`;
        newTx.description = await encryptData(descWithInstallment, uid);
    }

    batchPromises.push(addDoc(transactionsCol(uid), newTx));
  }

  await Promise.all(batchPromises);
};

export const deleteTransaction = async (uid: string, transactionId: string, deleteGroup: boolean = false) => {
  if (deleteGroup) {
    const txRef = doc(transactionsCol(uid), transactionId);
    const txSnap = await getDoc(txRef);
    
    if (!txSnap.exists()) return;
    const txData = txSnap.data();

    if (txData.groupId) {
      const q = query(transactionsCol(uid), where("groupId", "==", txData.groupId));
      const querySnapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      querySnapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      
      await batch.commit();
      return; 
    }
  }

  await deleteDoc(doc(transactionsCol(uid), transactionId));
};

export const cancelFutureInstallments = async (uid: string, groupId: string, lastInstallmentDate: string) => {
  const q = query(
    transactionsCol(uid),
    where("groupId", "==", groupId),
    where("dueDate", ">", lastInstallmentDate)
  );

  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) return;

  const batch = writeBatch(db);
  querySnapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
};

export const updateTransaction = async (uid: string, transactionId: string, data: Partial<Transaction>, updateGroup: boolean = false) => {
  const txRef = doc(transactionsCol(uid), transactionId);
  
  const updates: Record<string, unknown> = { ...data };
  if (data.description) updates.description = await encryptData(data.description, uid);
  if (data.amount !== undefined) updates.amount = await encryptData(data.amount, uid);
  if (updates.description || updates.amount !== undefined) updates.isEncrypted = true;

  if (!updateGroup) {
    await updateDoc(txRef, updates);
    return;
  }

  const txSnap = await getDoc(txRef);
  if (!txSnap.exists()) return;
  const currentTx = txSnap.data();

  if (currentTx.groupId) {
    const q = query(transactionsCol(uid), where("groupId", "==", currentTx.groupId));
    const querySnapshot = await getDocs(q);
    
    const batch = writeBatch(db);

    for (const docSnap of querySnapshot.docs) {
      const docData = docSnap.data();
      const isTargetDoc = docSnap.id === transactionId;
      
      const batchUpdates: Record<string, unknown> = { ...updates };

      if (data.description) {
        const cleanDesc = data.description; 
        const descWithSuffix = `${cleanDesc} (${docData.installmentCurrent}/${docData.installmentTotal})`;
        batchUpdates.description = await encryptData(descWithSuffix, uid);
      }

      if (!isTargetDoc) {
        delete batchUpdates.date;
        delete batchUpdates.dueDate;
        delete batchUpdates.status; 
      }

      batch.update(docSnap.ref, batchUpdates);
    }

    await batch.commit();
  } else {
    await updateDoc(txRef, updates);
  }
};

export const toggleTransactionStatus = async (uid: string, transactionId: string, currentStatus: "paid" | "pending") => {
  const newStatus = currentStatus === "paid" ? "pending" : "paid";
  const ref = doc(transactionsCol(uid), transactionId);
  await updateDoc(ref, { status: newStatus });
};

// --- Saldo ---

export const getUserSettings = async (uid: string): Promise<UserSettings> => {
  const ref = doc(userDoc(uid), "settings", "finance");
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as UserSettings;
  return { currentBalance: 0 };
};

export const updateUserBalance = async (uid: string, newBalance: number) => {
  const ref = doc(userDoc(uid), "settings", "finance");
  await setDoc(ref, { currentBalance: newBalance }, { merge: true });
};