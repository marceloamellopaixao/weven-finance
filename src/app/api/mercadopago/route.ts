import { NextResponse } from "next/server";
import { 
  updateUserPaymentStatus, 
  updateUserPlan, 
  updateUserStatus 
} from "@/services/userService";

// Type definitions for Mercado Pago payload
type MercadoPagoEvent = {
  action: string;
  api_version: string;
  data: { id: string };
  date_created: string;
  id: number;
  live_mode: boolean;
  type: string;
  user_id: string;
};

export async function POST(request: Request) {
  try {
    // 1. Validate the signature (Security)
    // Mercado Pago sends a signature in the headers to ensure the request is real
    const xSignature = request.headers.get("x-signature");
    const xRequestId = request.headers.get("x-request-id");

    if (!xSignature || !xRequestId) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dataID = searchParams.get("data.id"); // Sometimes it comes in the URL

    // 2. Parse the body
    const body: MercadoPagoEvent = await request.json();
    const eventType: string = body.type;
    const resourceId: string = body.data?.id || dataID || "";

    // Optional: Full signature validation implementation
    // Ideally, you should split xSignature (ts and v1) and hash it with your secret
    // For simplicity here, we rely on the subsequent API check which is also secure

    // 3. Process only relevant events
    if (eventType === "payment") {
      await handlePayment(resourceId);
    } else if (eventType === "subscription_preapproval") {
      await handleSubscription(resourceId);
    }

    // Always return 200 OK to Mercado Pago, otherwise they will retry indefinitely
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    console.error("Webhook Error:", error);
    // Return 200 even on internal error to stop MP from retrying bad requests
    return NextResponse.json({ error: "Internal Server Error" }, { status: 200 });
  }
}

// --- Handler: Single Payments (or Monthly Installment Payments) ---
async function handlePayment(paymentId: string) {
  if (!paymentId) return;

  try {
    // Fetch updated status directly from Mercado Pago API
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
    });

    if (!res.ok) {
        console.error(`MP API Error: ${res.statusText}`);
        return;
    }

    const paymentData = await res.json();
    
    // IMPORTANT: The 'external_reference' MUST contain the User UID
    // You must send this when creating the preference/link
    const userId = paymentData.external_reference;
    const status = paymentData.status; // approved, pending, rejected
    const additionalInfo = paymentData.additional_info?.items || [];
    
    if (!userId) {
        console.warn(`Payment ${paymentId} has no external_reference (User UID).`);
        return;
    }

    console.log(`Processing payment for User ${userId}: Status ${status}`);

    if (status === "approved") {
      // 1. Activate User
      await updateUserStatus(userId, "active");
      
      // 2. Set Payment Status
      await updateUserPaymentStatus(userId, "paid");

      // 3. Update Plan based on Item ID or Description
      // Assumes your items have IDs like 'plan_premium' or 'plan_pro'
      const purchasedItem = additionalInfo[0];
      if (purchasedItem) {
        if (purchasedItem.id?.includes("pro") || purchasedItem.title?.toLowerCase().includes("pro")) {
            await updateUserPlan(userId, "pro");
        } else if (purchasedItem.id?.includes("premium") || purchasedItem.title?.toLowerCase().includes("premium")) {
            await updateUserPlan(userId, "premium");
        }
      }
    } else if (status === "rejected" || status === "cancelled") {
      // Optional: Logic to warn user
      await updateUserPaymentStatus(userId, "not_paid");
    }

  } catch (error) {
    console.error("Error handling payment:", error);
  }
}

// --- Handler: Subscription Events (Status Changes) ---
async function handleSubscription(preapprovalId: string) {
    if (!preapprovalId) return;

    try {
        const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
            headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
        });

        const subData = await res.json();
        const userId = subData.external_reference;
        const status = subData.status; // authorized, paused, cancelled

        if (!userId) return;

        console.log(`Processing subscription for User ${userId}: Status ${status}`);

        if (status === "authorized") {
             // Subscription active
             await updateUserStatus(userId, "active");
             await updateUserPaymentStatus(userId, "paid");
        } else if (status === "cancelled") {
             // Subscription cancelled
             await updateUserPaymentStatus(userId, "canceled");
             // Depending on your rule, you might block access immediately or wait for cycle end
             // For now, let's just mark payment status
        } else if (status === "paused") {
             await updateUserPaymentStatus(userId, "overdue");
        }

    } catch (error) {
        console.error("Error handling subscription:", error);
    }
}