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

// --- Helper de Data Seguro (UTC) ---
// Corrige o bug de pular mês (Ex: 31/01 -> 28/02 e não 03/03)
const addMonthsUTC = (dateStr: string, monthsToAdd: number): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // 1. Calcula o mês alvo (sem se preocupar com o dia ainda)
  // O construtor Date.UTC lida automaticamente com virada de ano (ex: mês 13 vira mês 1 do ano seguinte)
  const targetMonthDate = new Date(Date.UTC(year, (month - 1) + monthsToAdd, 1));
  
  // 2. Descobre o último dia deste mês alvo
  // O dia 0 do mês seguinte nos dá o último dia do mês atual
  const lastDayOfTargetMonth = new Date(Date.UTC(targetMonthDate.getUTCFullYear(), targetMonthDate.getUTCMonth() + 1, 0));
  const maxDays = lastDayOfTargetMonth.getUTCDate();

  // 3. Ajusta o dia: Se o dia original (ex: 31) for maior que o máximo do mês (ex: 28), usa o máximo.
  const finalDay = Math.min(day, maxDays);

  // 4. Cria a data final segura
  const finalDate = new Date(Date.UTC(targetMonthDate.getUTCFullYear(), targetMonthDate.getUTCMonth(), finalDay));
  
  return finalDate.toISOString().split('T')[0];
};

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
  // Garante que count seja pelo menos 1 e converte para inteiro
  const count = tx.isInstallment ? Math.max(1, Math.floor(tx.installmentsCount)) : 1;
  
  // Datas base (Strings YYYY-MM-DD)
  const basePurchaseDate = tx.date;
  const baseDueDate = tx.dueDate;

  for (let i = 0; i < count; i++) {
    // Calcula o vencimento futuro usando a função segura
    const currentDueDate = addMonthsUTC(baseDueDate, i);

    const newTx: Omit<Transaction, "id"> = {
      userId: uid,
      description: tx.isInstallment ? `${tx.description} (${i + 1}/${count})` : tx.description,
      amount: tx.amount,
      type: tx.type,
      category: tx.category,
      paymentMethod: tx.paymentMethod,
      status: "pending",
      date: basePurchaseDate, // Data de compra/competência mantém-se a original
      dueDate: currentDueDate, // Vencimento avança mês a mês corretamente
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

export const deleteTransaction = async (uid: string, transactionId: string, deleteGroup: boolean = false) => {
  if (deleteGroup) {
    const txRef = doc(transactionsCol(uid), transactionId);
    const txSnap = await getDoc(txRef);
    
    if (!txSnap.exists()) return;
    const txData = txSnap.data() as Transaction;

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

// --- Cancelar Assinatura (Excluir Futuros) ---
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
  
  if (!updateGroup) {
    await updateDoc(txRef, data);
    return;
  }

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

      // Protege datas e status individuais na edição em lote
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

export const updateUserBalance = async (uid: string, newBalance: number) => {
  const ref = doc(userDoc(uid), "settings", "finance");
  await setDoc(ref, { currentBalance: newBalance }, { merge: true });
};