// app/api/webhooks/mercadopago/route.ts
import { NextResponse } from 'next/server';
import { updateUserPaymentStatus, updateUserPlan } from '@/services/userService';

export async function POST(request: Request) {
  const body = await request.json();
  const { type, data } = body;

  // 1. Validar se é uma notificação de pagamento
  if (type === "payment") {
    const paymentId = data.id;
    
    // 2. Consultar a API do Mercado Pago para verificar o status real
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
    });
    const paymentData = await response.json();

    if (paymentData.status === "approved") {
       // O 'external_reference' deve ser o UID do usuário que você envia no link de pagamento
       const userUid = paymentData.external_reference;
       
       // 3. Atualizar no seu banco (o que refletirá no seu AdminPage)
       await updateUserPaymentStatus(userUid, "paid");
       await updateUserPlan(userUid, "premium"); // ou baseado no ID do item
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}