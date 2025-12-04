import { 
  addDoc, 
  serverTimestamp, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  doc, 
  getDoc, 
  deleteDoc, 
  where, 
  getDocs, 
  writeBatch,
  Timestamp 
} from "firebase/firestore";
import { transactionsCol, userDoc } from "./firebase/collections";
import { db } from "./firebase/client"; 
import { Transaction, UserSettings, CreateTransactionDTO } from "@/types/transaction";

// --- Transações ---

export const subscribeToTransactions = (uid: string, callback: (data: Transaction[]) => void) => {
  const q = query(transactionsCol(uid), orderBy("date", "desc"));
  
  return onSnapshot(q, (snapshot) => {
    const transactions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt.toDate() : doc.data().createdAt,
    })) as Transaction[];
    callback(transactions);
  });
};

export const addTransaction = async (uid: string, tx: CreateTransactionDTO) => {
  const batchPromises = [];
  const groupId = crypto.randomUUID();
  const count = tx.isInstallment ? tx.installmentsCount : 1;
  
  const purchaseDate = new Date(tx.date);
  const firstDueDate = new Date(tx.dueDate);

  for (let i = 0; i < count; i++) {
    const currentDueDate = new Date(firstDueDate);
    currentDueDate.setMonth(firstDueDate.getMonth() + i);

    const newTx: Omit<Transaction, "id"> = {
      userId: uid,
      description: tx.isInstallment ? `${tx.description} (${i + 1}/${count})` : tx.description,
      amount: tx.amount,
      type: tx.type,
      category: tx.category,
      paymentMethod: tx.paymentMethod,
      status: "pending",
      date: purchaseDate.toISOString().split('T')[0],
      dueDate: currentDueDate.toISOString().split('T')[0],
      createdAt: serverTimestamp() as unknown as Timestamp,
      
      ...(tx.isInstallment && {
        groupId,
        installmentCurrent: i + 1,
        installmentTotal: count
      })
    };

    batchPromises.push(addDoc(transactionsCol(uid), newTx));
  }

  await Promise.all(batchPromises);
};

// ATUALIZADO: Suporte a exclusão em grupo
export const deleteTransaction = async (uid: string, transactionId: string, deleteGroup: boolean = false) => {
  if (deleteGroup) {
    // 1. Busca a transação original para pegar o groupId
    const txRef = doc(transactionsCol(uid), transactionId);
    const txSnap = await getDoc(txRef);
    
    if (!txSnap.exists()) return;
    const txData = txSnap.data() as Transaction;

    // 2. Se tem grupo, deleta todas
    if (txData.groupId) {
      const q = query(transactionsCol(uid), where("groupId", "==", txData.groupId));
      const querySnapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      querySnapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      
      await batch.commit();
      return; // Sai da função pois já deletou tudo
    }
  }

  // Default: Deleta apenas a selecionada
  await deleteDoc(doc(transactionsCol(uid), transactionId));
};

export const updateTransaction = async (uid: string, transactionId: string, data: Partial<Transaction>) => {
  const txRef = doc(transactionsCol(uid), transactionId);
  const txSnap = await getDoc(txRef);

  if (!txSnap.exists()) return;

  const currentTx = txSnap.data() as Transaction;

  if (currentTx.groupId) {
    const q = query(transactionsCol(uid), where("groupId", "==", currentTx.groupId));
    const querySnapshot = await getDocs(q);
    
    const batch = writeBatch(db);

    querySnapshot.docs.forEach((docSnap) => {
      const docData = docSnap.data() as Transaction;
      const isTargetDoc = docSnap.id === transactionId;
      const updates: Record<string, unknown> = { ...data };

      if (data.description && typeof data.description === 'string') {
        const cleanDesc = data.description.replace(/\s\(\d+\/\d+\)$/, ""); 
        updates.description = `${cleanDesc} (${docData.installmentCurrent}/${docData.installmentTotal})`;
      }

      if (!isTargetDoc) {
        delete updates.date;
        delete updates.dueDate;
        delete updates.status; 
      }

      batch.update(docSnap.ref, updates);
    });

    await batch.commit();

  } else {
    await updateDoc(txRef, data);
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
