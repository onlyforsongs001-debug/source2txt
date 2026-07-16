export interface PayOSPaymentRequest {
  amount: number;
  orderId: string;
  orderInfo: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface PayOSPaymentResponse {
  checkoutUrl: string;
  qrCode: string;
  deeplink: string;
}

export async function createPayOSPayment(request: PayOSPaymentRequest): Promise<PayOSPaymentResponse> {
  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

  if (!clientId || !apiKey || !checksumKey) {
    throw new Error('PayOS credentials not configured');
  }

  const order = {
    amount: request.amount,
    cancelUrl: request.cancelUrl,
    description: request.orderInfo,
    orderCode: request.orderId,
    returnUrl: request.returnUrl,
  };

  const signature = await createSignature(order, checksumKey);

  const response = await fetch('https://api-merchant.payos.vn/v2/transactions/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': clientId,
      'x-api-key': apiKey,
      'x-signature': signature,
    },
    body: JSON.stringify(order),
  });

  const data = await response.json();

  if (data.code !== '00') {
    throw new Error(data.desc || 'Payment creation failed');
  }

  return {
    checkoutUrl: data.data.checkoutUrl,
    qrCode: data.data.qrCode,
    deeplink: data.data.deeplink,
  };
}

async function createSignature(order: any, checksumKey: string): Promise<string> {
  const stringToSign = `${order.amount}|${order.cancelUrl}|${order.orderCode}|${order.returnUrl}|${checksumKey}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(checksumKey);
  const msgData = encoder.encode(stringToSign);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const hex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return hex;
}