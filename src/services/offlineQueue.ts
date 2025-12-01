interface QueueOperation {
  id: string;
  type: "ADD_TRANSACTION" | "UPDATE_INSTALLMENT";
  payload: Record<string, unknown>; // Correção do "any"
  timestamp: number;
}

const QUEUE_KEY = "weven_offline_queue";

export const getQueue = (): QueueOperation[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(QUEUE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const pushOperation = (op: Omit<QueueOperation, "id" | "timestamp">) => {
  const queue = getQueue();
  const newOp: QueueOperation = {
    ...op,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  queue.push(newOp);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const clearQueue = () => {
  localStorage.removeItem(QUEUE_KEY);
};

export const processQueue = async (handler: (op: QueueOperation) => Promise<void>) => {
  const queue = getQueue();
  if (queue.length === 0) return;

  for (const op of queue) {
    try {
      await handler(op);
    } catch (error) {
      console.error("Erro ao processar item da fila offline:", error);
    }
  }
  clearQueue();
};