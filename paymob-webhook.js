// POST /api/paymob-webhook
// Set this URL as the "Transaction processed callback" in Paymob dashboard:
//   Developers -> Payment Integrations -> your integration -> Transaction processed callback
//   https://yourdomain.vercel.app/api/paymob-webhook
//
// Required environment variables:
//   PAYMOB_HMAC_SECRET          - HMAC secret from Paymob (Settings -> Account Info -> HMAC)
//   SUPABASE_URL                - same as in supabase-config.js
//   SUPABASE_SERVICE_ROLE_KEY   - Project Settings -> API -> service_role key (NOT the anon key)

const crypto = require("crypto");

// Exact field order Paymob requires for the HMAC calculation.
const HMAC_FIELDS = [
  "amount_cents", "created_at", "currency", "error_occured",
  "has_parent_transaction", "id", "integration_id", "is_3d_secure",
  "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
  "is_voided", "order.id", "owner", "pending",
  "source_data.pan", "source_data.sub_type", "source_data.type", "success"
];

function getNested(obj, path) {
  return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

function verifyHmac(obj, receivedHmac, secret) {
  const concatenated = HMAC_FIELDS.map(function (field) {
    const value = getNested(obj, field);
    return value === undefined || value === null ? "" : String(value);
  }).join("");

  const computed = crypto.createHmac("sha512", secret).update(concatenated).digest("hex");
  return computed === receivedHmac;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  try {
    const hmacSecret = process.env.PAYMOB_HMAC_SECRET;
    const receivedHmac = req.query.hmac;
    const transaction = (req.body && req.body.obj) || {};

    if (!hmacSecret || !receivedHmac || !verifyHmac(transaction, receivedHmac, hmacSecret)) {
      res.status(401).send("Invalid HMAC");
      return;
    }

    const merchantOrderId = transaction.order && transaction.order.merchant_order_id;
    const success = transaction.success === true || transaction.success === "true";

    if (merchantOrderId) {
      await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/orders?id=eq.${merchantOrderId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            Prefer: "return=minimal"
          },
          body: JSON.stringify({ status: success ? "confirmed" : "cancelled" })
        }
      );
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("paymob-webhook error:", err);
    res.status(500).send("Webhook error");
  }
};
