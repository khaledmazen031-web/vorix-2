// POST /api/create-payment
// Body: { amount, method: 'visa' | 'vodafone_cash', name, phone, orderId }
// Returns: { redirectUrl }
//
// Required environment variables (set in Vercel -> Project -> Settings -> Environment Variables):
//   PAYMOB_API_KEY               - Paymob "API Key" (Settings -> Account Info)
//   PAYMOB_INTEGRATION_ID_CARD   - Integration ID for the Online Card integration
//   PAYMOB_INTEGRATION_ID_WALLET - Integration ID for the Mobile Wallet integration
//   PAYMOB_IFRAME_ID             - Iframe ID (Developers -> Payment Integrations -> iFrames)

const PAYMOB_BASE = "https://accept.paymob.com/api";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { amount, method, name, phone, orderId } = req.body || {};

    if (!amount || !method || !name || !phone) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const apiKey = process.env.PAYMOB_API_KEY;
    const integrationId =
      method === "vodafone_cash"
        ? process.env.PAYMOB_INTEGRATION_ID_WALLET
        : process.env.PAYMOB_INTEGRATION_ID_CARD;
    const iframeId = process.env.PAYMOB_IFRAME_ID;

    if (!apiKey || !integrationId) {
      res.status(500).json({ error: "Payment gateway not configured yet" });
      return;
    }

    const amountCents = Math.round(Number(amount) * 100);

    // 1) Auth
    const authRes = await fetch(`${PAYMOB_BASE}/auth/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey })
    });
    const authData = await authRes.json();
    const authToken = authData.token;
    if (!authToken) throw new Error("Paymob auth failed");

    // 2) Create order
    const orderRes = await fetch(`${PAYMOB_BASE}/ecommerce/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_token: authToken,
        delivery_needed: false,
        amount_cents: amountCents,
        currency: "EGP",
        merchant_order_id: orderId || undefined,
        items: []
      })
    });
    const orderData = await orderRes.json();
    if (!orderData.id) throw new Error("Paymob order creation failed");

    // 3) Payment key
    const [firstName, ...rest] = name.split(" ");
    const lastName = rest.join(" ") || firstName;

    const paymentKeyRes = await fetch(`${PAYMOB_BASE}/acceptance/payment_keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_token: authToken,
        amount_cents: amountCents,
        expiration: 3600,
        order_id: orderData.id,
        billing_data: {
          first_name: firstName,
          last_name: lastName,
          email: "customer@vorix.store",
          phone_number: phone,
          apartment: "NA",
          floor: "NA",
          street: "NA",
          building: "NA",
          city: "NA",
          country: "EG",
          state: "NA"
        },
        currency: "EGP",
        integration_id: integrationId
      })
    });
    const paymentKeyData = await paymentKeyRes.json();
    const paymentToken = paymentKeyData.token;
    if (!paymentToken) throw new Error("Paymob payment key creation failed");

    // 4a) Card -> redirect to Paymob's hosted iframe
    if (method === "visa") {
      const redirectUrl = `${PAYMOB_BASE}/acceptance/iframes/${iframeId}?payment_token=${paymentToken}`;
      res.status(200).json({ redirectUrl });
      return;
    }

    // 4b) Vodafone Cash -> wallet pay endpoint, returns an OTP redirect URL
    const walletRes = await fetch(`${PAYMOB_BASE}/acceptance/payments/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: { identifier: phone, subtype: "WALLET" },
        payment_token: paymentToken
      })
    });
    const walletData = await walletRes.json();
    const redirectUrl = walletData.redirect_url || (walletData.iframe_redirection_url) || null;

    if (!redirectUrl) throw new Error("Wallet payment did not return a redirect URL");

    res.status(200).json({ redirectUrl });
  } catch (err) {
    console.error("create-payment error:", err);
    res.status(500).json({ error: err.message || "Payment initialization failed" });
  }
};
