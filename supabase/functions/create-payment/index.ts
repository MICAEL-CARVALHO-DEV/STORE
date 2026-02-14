import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "../_shared/cors.ts";

type CreatePaymentRequest = {
  order_id: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Missing Supabase env vars." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ error: "Missing Authorization Bearer token." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid user session." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as CreatePaymentRequest;
    const orderId = String(body?.order_id ?? "").trim();
    if (!orderId) {
      return new Response(JSON.stringify({ error: "order_id is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: order, error: orderError } = await service
      .from("orders")
      .select("id, customer_id, total, currency, payment_method, payment_status, status")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.customer_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Forbidden." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.status !== "pending" || order.payment_status !== "pending") {
      return new Response(JSON.stringify({ error: "Order is not payable." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.payment_method !== "pix") {
      return new Response(JSON.stringify({ error: "Only pix is supported by this function for now." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!MP_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({
          provider: "manual",
          message:
            "Gateway nao configurado. Defina MP_ACCESS_TOKEN nas variaveis do Supabase Functions.",
        }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payerEmail = userData.user.email ?? "cliente@7store.local";
    const amount = Number(order.total ?? 0);

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: `Pedido ${orderId}`,
        payment_method_id: "pix",
        payer: { email: payerEmail },
      }),
    });

    const mpPayload = await mpRes.json().catch(() => ({}));
    if (!mpRes.ok) {
      return new Response(JSON.stringify({ error: "Mercado Pago error.", details: mpPayload }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const providerPaymentId = mpPayload?.id ? String(mpPayload.id) : null;
    const qrCode = mpPayload?.point_of_interaction?.transaction_data?.qr_code ?? null;
    const qrBase64 = mpPayload?.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;

    const updatePayload = {
      provider: "mercadopago",
      provider_payment_id: providerPaymentId,
      method: "pix",
      status: "pending",
      amount,
      raw_response: mpPayload,
    };

    const { data: updatedRows } = await service
      .from("payments")
      .update(updatePayload)
      .eq("order_id", orderId)
      .select("id")
      .limit(1);

    if (!updatedRows || updatedRows.length === 0) {
      await service.from("payments").insert({ order_id: orderId, ...updatePayload });
    }

    return new Response(
      JSON.stringify({
        provider: "mercadopago",
        order_id: orderId,
        payment_id: providerPaymentId,
        qr_code: qrCode,
        qr_code_base64: qrBase64,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error?.message ?? error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
