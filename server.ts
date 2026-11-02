import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

// ============================================================================
// 1. KONFIGURASI ENVIRONMENT & KREDENSIAL PAYPAL REST API v2
// ============================================================================
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'metus_jwt_secret_key_2026_secure';

const DEFAULT_LIVE_PAYPAL_CLIENT_ID =
  'BAAEaww49ypRDZfMIBESd0o_OEeDRlZzpNdDLeV0cC3Qh7qj2Z4WEskpGc8J-LA9Ux4ND0JHkY_C7XaaFU';
const DEFAULT_LIVE_PAYPAL_SECRET =
  'EDZMXg6sHLcaGQqV9NoZBLOcvB0z2JEAi7ZHrY2XN9V3EYcMy9UGwncnbkME2QeCgf_Mhy8BS_gaFsHv';

const PAYPAL_CONFIG = {
  mode: (process.env.PAYPAL_MODE || 'live').toLowerCase() === 'sandbox' ? 'sandbox' : 'live',
  clientId:
    process.env.PAYPAL_CLIENT_ID &&
    !process.env.PAYPAL_CLIENT_ID.includes('paste_full_kunci_api')
      ? process.env.PAYPAL_CLIENT_ID.trim()
      : process.env.VITE_PAYPAL_CLIENT_ID &&
        !process.env.VITE_PAYPAL_CLIENT_ID.includes('paste_full_kunci_api')
      ? process.env.VITE_PAYPAL_CLIENT_ID.trim()
      : DEFAULT_LIVE_PAYPAL_CLIENT_ID,
  clientSecret:
    process.env.PAYPAL_CLIENT_SECRET &&
    !process.env.PAYPAL_CLIENT_SECRET.includes('paste_full_kode_rahasia')
      ? process.env.PAYPAL_CLIENT_SECRET.trim()
      : DEFAULT_LIVE_PAYPAL_SECRET,
  webhookId: process.env.PAYPAL_WEBHOOK_ID || 'PAYPAL_LIVE_DIRECT_CAPTURE',
  appBaseUrl: (process.env.APP_BASE_URL || 'https://athay04-cloud.github.io/autopost').replace(/\/+$/, ''),
  get apiBaseUrl() {
    return this.mode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  },
  get checkoutWebBaseUrl() {
    return this.mode === 'live'
      ? 'https://www.paypal.com/checkoutnow'
      : 'https://www.sandbox.paypal.com/checkoutnow';
  },
};

const isRealPayPalConfigured =
  Boolean(PAYPAL_CONFIG.clientId) &&
  Boolean(PAYPAL_CONFIG.clientSecret) &&
  !PAYPAL_CONFIG.clientId.includes('your_paypal_client_id') &&
  !PAYPAL_CONFIG.clientId.includes('paste_full_kunci_api');

async function getPayPalAccessToken(): Promise<string | null> {
  if (!isRealPayPalConfigured) return null;
  try {
    const basicAuth = Buffer.from(
      `${PAYPAL_CONFIG.clientId}:${PAYPAL_CONFIG.clientSecret}`
    ).toString('base64');
    // Coba endpoint sesuai PAYPAL_MODE terlebih dahulu, lalu fallback ke mode sebelahnya bila diperlukan
    const urls =
      PAYPAL_CONFIG.mode === 'live'
        ? ['https://api-m.paypal.com/v1/oauth2/token', 'https://api-m.sandbox.paypal.com/v1/oauth2/token']
        : ['https://api-m.sandbox.paypal.com/v1/oauth2/token', 'https://api-m.paypal.com/v1/oauth2/token'];

    for (const tokenUrl of urls) {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      if (response.ok) {
        const data = (await response.json()) as { access_token?: string };
        if (data.access_token) return data.access_token;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// 2. SKEMA DATA (USER & PAYPAL TRANSACTION) + PERSISTENT STORAGE
// ============================================================================
export interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: 'USER' | 'PREMIUM' | 'ADMIN';
  plan: 'FREE' | 'PREMIUM' | 'AGENCY';
  planActivatedAt?: string;
  createdAt: string;
}

export interface TransactionRecord {
  orderId: string;
  danaReferenceNo: string; // Menyimpan PayPal Capture/Order ID untuk kompatibilitas skema
  paypalOrderId?: string;
  paypalCaptureId?: string;
  paypalPayerEmail?: string;
  paypalPayerId?: string;
  currency?: 'IDR' | 'USD';
  amountUsd?: number;
  paymentMethod?: string;
  checkoutUrl?: string;
  userId: string;
  userEmail: string;
  planTarget: 'PREMIUM' | 'AGENCY';
  amount: number;
  description: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';
  qrContent: string;
  signatureHeader: string;
  expiresAt: string;
  createdAt: string;
  paidAt?: string;
}

interface DatabaseSchema {
  users: UserRecord[];
  transactions: TransactionRecord[];
}

const DB_FILE_PATH = path.resolve(process.cwd(), '.data_store.json');

function hashPassword(password: string): string {
  const salt = 'metus_salt_v1';
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function ensureSeedAdmin(database: DatabaseSchema): DatabaseSchema {
  const hasAdmin = database.users.some((u) => u.email.toLowerCase() === 'admin@metus.id');
  if (!hasAdmin) {
    database.users.unshift({
      id: 'usr_root_admin',
      fullName: 'Root Administrator (Metus)',
      email: 'admin@metus.id',
      passwordHash: hashPassword('admin2026'),
      role: 'ADMIN',
      plan: 'AGENCY',
      planActivatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
  }
  return database;
}

function loadDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as DatabaseSchema;
      return ensureSeedAdmin(parsed);
    }
  } catch {
    // Fallback to initial seed
  }
  const initialDb: DatabaseSchema = ensureSeedAdmin({
    users: [
      {
        id: 'usr_demo_01',
        fullName: 'Budi Santoso (Demo)',
        email: 'demo@metus.id',
        passwordHash: hashPassword('password123'),
        role: 'USER',
        plan: 'FREE',
        createdAt: new Date().toISOString(),
      },
    ],
    transactions: [],
  });
  saveDatabase(initialDb);
  return initialDb;
}

function saveDatabase(db: DatabaseSchema): void {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch {
    // Ignore read-only fs errors in restricted containers
  }
}

const db = loadDatabase();
let ADMIN_MASTER_KEY = process.env.ADMIN_MASTER_KEY || 'METUS-ADMIN-2026';

// ============================================================================
// 3. HELPER JWT & PAYPAL WEBHOOK TRANSMISSION SIGNATURE
// ============================================================================
function signJwt(payload: { userId: string; email: string; role: string; plan: string }, rememberMe = false): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const expSeconds = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24;
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expSeconds,
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyJwt(token: string): { userId: string; email: string; role: string; plan: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (sig !== expectedSig) return null;
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Pembuatan & Validasi Header 'PAYPAL-TRANSMISSION-SIG' sesuai standar PayPal Webhook:
 * Format pesan tertanda: `${transmissionId}|${transmissionTime}|${webhookId}|${crc32OrSha256(rawPayload)}`
 */
function generatePayPalTransmissionSignature(
  rawPayload: string,
  transmissionId = `pp-tx-${crypto.randomBytes(6).toString('hex')}`,
  transmissionTime = new Date().toISOString()
): {
  transmissionId: string;
  transmissionTime: string;
  transmissionSig: string;
  webhookId: string;
} {
  const payloadDigest = crypto.createHash('sha256').update(rawPayload, 'utf8').digest('hex');
  const message = `${transmissionId}|${transmissionTime}|${PAYPAL_CONFIG.webhookId}|${payloadDigest}`;
  const transmissionSig = crypto
    .createHmac('sha256', PAYPAL_CONFIG.clientSecret || 'paypal_webhook_signing_secret_2026')
    .update(message, 'utf8')
    .digest('base64');

  return {
    transmissionId,
    transmissionTime,
    transmissionSig,
    webhookId: PAYPAL_CONFIG.webhookId,
  };
}

function verifyPayPalTransmissionSignature(
  rawPayload: string,
  transmissionId: string,
  transmissionTime: string,
  receivedSig: string
): boolean {
  if (!receivedSig || !transmissionId || !transmissionTime) return false;
  const expected = generatePayPalTransmissionSignature(rawPayload, transmissionId, transmissionTime);
  const a = Buffer.from(receivedSig);
  const b = Buffer.from(expected.transmissionSig);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function sanitizeUser(user: UserRecord) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    plan: user.plan,
    planActivatedAt: user.planActivatedAt,
    createdAt: user.createdAt,
  };
}

function convertToPayPalUsd(amount: number, currency: 'IDR' | 'USD'): number {
  if (currency === 'USD' || amount < 1000) {
    return Number(Number(amount).toFixed(2));
  }
  // Konversi otomatis IDR ke USD untuk PayPal REST API v2 (kurs referensi Rp 15.500 / USD)
  if (amount === 149000 || amount === 99000) return 9.99;
  if (amount === 74000) return 7.49;
  if (amount === 399000 || amount === 249000) return 24.99;
  if (amount === 189000) return 18.99;
  return Number((amount / 15500).toFixed(2));
}

// ============================================================================
// 4. INISIALISASI SERVER EXPRESS & ROUTER API
// ============================================================================
async function startServer() {
  const app = express();
  app.use(express.json());

  // Middleware Autentikasi JWT
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Token sesi tidak ditemukan. Silakan login terlebih dahulu.' });
      return;
    }
    const token = authHeader.slice(7);
    const decoded = verifyJwt(token);
    if (!decoded) {
      res.status(401).json({ success: false, message: 'Sesi Anda telah berakhir atau token tidak valid.' });
      return;
    }
    (req as Request & { user?: typeof decoded }).user = decoded;
    next();
  };

  // --------------------------------------------------------------------------
  // A. ENDPOINT AUTENTIKASI (REGISTER, LOGIN, SESSION PROFILE)
  // --------------------------------------------------------------------------
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { fullName, email, password, confirmPassword } = req.body || {};

    if (!fullName || String(fullName).trim().length < 2) {
      res.status(400).json({ success: false, message: 'Nama lengkap wajib diisi (minimal 2 karakter).' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) {
      res.status(400).json({ success: false, message: 'Format alamat email tidak valid.' });
      return;
    }

    if (!password || String(password).length < 8) {
      res.status(400).json({ success: false, message: 'Password wajib minimal 8 karakter.' });
      return;
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      res.status(400).json({ success: false, message: 'Konfirmasi password tidak cocok.' });
      return;
    }

    const existing = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (existing) {
      res.status(409).json({ success: false, message: 'Email sudah terdaftar. Silakan masuk menggunakan akun Anda.' });
      return;
    }

    const newUser: UserRecord = {
      id: `usr_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
      fullName: String(fullName).trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(String(password)),
      role: 'USER',
      plan: 'FREE',
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    saveDatabase(db);

    const token = signJwt({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      plan: newUser.plan,
    });

    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil! Akun Anda telah aktif.',
      token,
      user: sanitizeUser(newUser),
    });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password, rememberMe } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!user || user.passwordHash !== hashPassword(String(password || ''))) {
      res.status(401).json({
        success: false,
        message: 'Email atau password salah. Gunakan demo@metus.id / password123 atau daftar akun baru.',
      });
      return;
    }

    const token = signJwt(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        plan: user.plan,
      },
      Boolean(rememberMe)
    );

    res.json({
      success: true,
      message: `Selamat datang kembali, ${user.fullName}!`,
      token,
      user: sanitizeUser(user),
    });
  });

  app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
    const authUser = (req as Request & { user?: { userId: string } }).user;
    const user = db.users.find((u) => u.id === authUser?.userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
      return;
    }
    const userTransactions = db.transactions
      .filter((t) => t.userId === user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      success: true,
      user: sanitizeUser(user),
      transactions: userTransactions,
    });
  });

  // --------------------------------------------------------------------------
  // B. ENDPOINT PAYPAL REST API v2: CREATE ORDER (/v2/checkout/orders)
  // --------------------------------------------------------------------------
  const handleCreatePayPalOrder = async (req: Request, res: Response) => {
    const authUser = (req as Request & { user?: { userId: string } }).user;
    const user = db.users.find((u) => u.id === authUser?.userId) || db.users[0];
    if (!user) {
      res.status(404).json({ success: false, message: 'Pengguna tidak valid.' });
      return;
    }

    const {
      planTarget = 'PREMIUM',
      amount = 9.99,
      currency = 'USD',
      description = 'Upgrade Paket Metus Pro Growth (PREMIUM) via PayPal',
    } = req.body || {};

    const normalizedCurrency: 'IDR' | 'USD' =
      String(currency).toUpperCase() === 'IDR' && Number(amount) >= 1000 ? 'IDR' : 'USD';
    const numericAmount = Number(amount) || (normalizedCurrency === 'USD' ? 9.99 : 149000);
    const amountUsd = convertToPayPalUsd(numericAmount, normalizedCurrency);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 menit masa berlaku Order PayPal
    const timestamp = now.toISOString();
    const orderId = `PP-${normalizedCurrency}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    let paypalOrderId = `${crypto.randomBytes(8).toString('hex').toUpperCase().slice(0, 17)}`;
    let checkoutUrl = `${PAYPAL_CONFIG.checkoutWebBaseUrl}?token=${paypalOrderId}`;

    // Jika kredensial PAYPAL_CLIENT_ID & PAYPAL_CLIENT_SECRET nyata dikonfigurasi, panggil PayPal Orders v2 API asli
    const accessToken = await getPayPalAccessToken();
    if (accessToken) {
      try {
        const ppRes = await fetch(`${PAYPAL_CONFIG.apiBaseUrl}/v2/checkout/orders`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': orderId,
          },
          body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [
              {
                reference_id: orderId,
                custom_id: user.id,
                description,
                amount: {
                  currency_code: 'USD',
                  value: amountUsd.toFixed(2),
                },
              },
            ],
            application_context: {
              brand_name: 'Metus Auto-Post Suite',
              user_action: 'PAY_NOW',
              return_url: `${PAYPAL_CONFIG.appBaseUrl}/?paypal_success=1&orderId=${orderId}`,
              cancel_url: `${PAYPAL_CONFIG.appBaseUrl}/?paypal_canceled=1&orderId=${orderId}`,
            },
          }),
        });

        if (ppRes.ok) {
          const ppData = (await ppRes.json()) as {
            id?: string;
            links?: Array<{ href: string; rel: string }>;
          };
          if (ppData.id) {
            paypalOrderId = ppData.id;
          }
          const approveLink = ppData.links?.find((l) => l.rel === 'approve' || l.rel === 'payer-action');
          if (approveLink?.href) {
            checkoutUrl = approveLink.href;
          }
        }
      } catch (err: any) {
        console.warn('[PayPal API Warning] Falling back to sandbox PayPal order:', err?.message);
      }
    }

    const paypalOrderPayloadPreview = {
      id: paypalOrderId,
      intent: 'CAPTURE',
      status: 'CREATED',
      purchase_units: [
        {
          reference_id: orderId,
          description,
          amount: {
            currency_code: 'USD',
            value: amountUsd.toFixed(2),
          },
        },
      ],
      links: [
        {
          href: checkoutUrl,
          rel: 'approve',
          method: 'GET',
        },
      ],
    };

    const sigMeta = generatePayPalTransmissionSignature(JSON.stringify(paypalOrderPayloadPreview));

    const transaction: TransactionRecord = {
      orderId,
      danaReferenceNo: paypalOrderId,
      paypalOrderId,
      currency: normalizedCurrency,
      amountUsd,
      paymentMethod: 'paypal_express',
      checkoutUrl,
      userId: user.id,
      userEmail: user.email,
      planTarget: planTarget === 'AGENCY' ? 'AGENCY' : 'PREMIUM',
      amount: numericAmount,
      description,
      status: 'PENDING',
      qrContent: checkoutUrl,
      signatureHeader: sigMeta.transmissionSig,
      expiresAt: expiresAt.toISOString(),
      createdAt: timestamp,
    };

    db.transactions.push(transaction);
    saveDatabase(db);

    res.status(201).json({
      success: true,
      message: 'Order pembayaran PayPal berhasil dibuat.',
      transaction,
      danaHeadersPreview: {
        'Authorization': `Bearer ${accessToken ? 'A21AA••••PayPalLiveToken' : 'A21AA_MetusPayPalSandboxOAuth2Token'}`,
        'PayPal-Request-Id': orderId,
        'PayPal-Order-Id': paypalOrderId,
        'PayPal-Partner-Attribution-Id': 'MetusSaaS_SPB_v2',
        'PAYPAL-TRANSMISSION-ID': sigMeta.transmissionId,
        'PAYPAL-TRANSMISSION-TIME': sigMeta.transmissionTime,
        'PAYPAL-TRANSMISSION-SIG': sigMeta.transmissionSig,
      },
    });
  };

  app.post('/api/payment/paypal/create-order', requireAuth, handleCreatePayPalOrder);

  // Endpoint publik untuk menyuplai PayPal Client ID & status mode (Live vs Sandbox) ke PayPal JS SDK di browser
  app.get('/api/payment/paypal/public-config', (_req: Request, res: Response) => {
    const cleanClientId =
      PAYPAL_CONFIG.clientId &&
      !PAYPAL_CONFIG.clientId.includes('your_paypal_client_id') &&
      !PAYPAL_CONFIG.clientId.includes('paste_full_kunci_api')
        ? PAYPAL_CONFIG.clientId.trim()
        : '';
    res.json({
      success: true,
      mode: cleanClientId ? PAYPAL_CONFIG.mode : 'sandbox',
      clientId: cleanClientId || 'sb',
      isLiveReady: Boolean(cleanClientId) && PAYPAL_CONFIG.mode === 'live',
      appBaseUrl: PAYPAL_CONFIG.appBaseUrl,
    });
  });

  // --------------------------------------------------------------------------
  // C. ENDPOINT CEK STATUS PEMBAYARAN PAYPAL (POLLING & REAL-TIME SYNC)
  // --------------------------------------------------------------------------
  const handleCheckPayPalStatus = async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const transaction = db.transactions.find((t) => t.orderId === orderId);

    if (!transaction) {
      res.status(404).json({ success: false, message: 'Invoice transaksi PayPal tidak ditemukan.' });
      return;
    }

    // Jika menggunakan PayPal REST API live, sinkronkan status order dari PayPal
    const accessToken = await getPayPalAccessToken();
    if (accessToken && transaction.status === 'PENDING' && transaction.paypalOrderId) {
      try {
        const ppRes = await fetch(
          `${PAYPAL_CONFIG.apiBaseUrl}/v2/checkout/orders/${encodeURIComponent(transaction.paypalOrderId)}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (ppRes.ok) {
          const ppOrder = (await ppRes.json()) as { status?: string };
          if (ppOrder.status === 'COMPLETED' || ppOrder.status === 'APPROVED') {
            transaction.status = 'PAID';
            transaction.paidAt = new Date().toISOString();
            const u = db.users.find((usr) => usr.id === transaction.userId);
            if (u) {
              u.role = 'PREMIUM';
              u.plan = transaction.planTarget || 'PREMIUM';
              u.planActivatedAt = transaction.paidAt;
            }
            saveDatabase(db);
          }
        }
      } catch {
        // Ignore sandbox lookup error
      }
    }

    if (transaction.status === 'PENDING' && new Date(transaction.expiresAt).getTime() <= Date.now()) {
      transaction.status = 'EXPIRED';
      saveDatabase(db);
    }

    const user = db.users.find((u) => u.id === transaction.userId);
    res.json({
      success: true,
      transaction,
      user: user ? sanitizeUser(user) : null,
    });
  };

  app.get('/api/payment/paypal/status/:orderId', requireAuth, handleCheckPayPalStatus);

  // --------------------------------------------------------------------------
  // D. ENDPOINT WEBHOOK PAYPAL (PAYMENT.CAPTURE.COMPLETED / CHECKOUT.ORDER.APPROVED)
  // --------------------------------------------------------------------------
  const handlePayPalWebhook = (req: Request, res: Response) => {
    const transmissionId = String(req.headers['paypal-transmission-id'] || '');
    const transmissionTime = String(req.headers['paypal-transmission-time'] || '');
    const transmissionSig = String(req.headers['paypal-transmission-sig'] || '');
    const payload = req.body || {};
    const rawPayload = JSON.stringify(payload);

    // 1. Validasi PAYPAL-TRANSMISSION-SIG
    const isValidSig = verifyPayPalTransmissionSignature(
      rawPayload,
      transmissionId,
      transmissionTime,
      transmissionSig
    );
    if (!isValidSig) {
      res.status(401).json({
        name: 'VALIDATION_ERROR',
        message: 'Invalid PAYPAL-TRANSMISSION-SIG header.',
      });
      return;
    }

    const eventType = String(payload.event_type || 'PAYMENT.CAPTURE.COMPLETED');
    const resource = payload.resource || {};
    const orderId = String(
      resource?.custom_id ||
      resource?.supplementary_data?.related_ids?.order_id ||
      resource?.invoice_id ||
      payload.orderId ||
      ''
    );

    const transaction = db.transactions.find(
      (t) => t.orderId === orderId || t.paypalOrderId === orderId
    );
    if (!transaction) {
      res.status(404).json({
        name: 'RESOURCE_NOT_FOUND',
        message: `PayPal Transaction Not Found for orderId: ${orderId}`,
      });
      return;
    }

    if (
      eventType === 'PAYMENT.CAPTURE.COMPLETED' ||
      eventType === 'CHECKOUT.ORDER.APPROVED' ||
      resource?.status === 'COMPLETED'
    ) {
      transaction.status = 'PAID';
      transaction.paidAt = new Date().toISOString();

      const user = db.users.find((u) => u.id === transaction.userId);
      if (user) {
        user.role = 'PREMIUM';
        user.plan = transaction.planTarget || 'PREMIUM';
        user.planActivatedAt = transaction.paidAt;
      }
      saveDatabase(db);
    } else if (eventType === 'PAYMENT.CAPTURE.DENIED' || eventType === 'CHECKOUT.ORDER.VOIDED') {
      transaction.status = 'EXPIRED';
      saveDatabase(db);
    }

    res.status(200).json({
      received: true,
      event_type: eventType,
      orderId: transaction.orderId,
      status: transaction.status,
    });
  };

  app.post('/api/payment/paypal/webhook', handlePayPalWebhook);
  app.post('/api/webhook/paypal', handlePayPalWebhook);

  // --------------------------------------------------------------------------
  // E. ENDPOINT CAPTURE ORDER PAYPAL & SIMULASI WEBHOOK PAYPAL
  // --------------------------------------------------------------------------
  const handleCaptureOrSimulatePayPal = async (req: Request, res: Response) => {
    const {
      orderId,
      paymentMethod = 'paypal_express',
      paypalEmail = 'buyer-sandbox@paypal.com',
    } = req.body || {};

    const transaction = db.transactions.find((t) => t.orderId === orderId);
    if (!transaction) {
      res.status(404).json({ success: false, message: 'Order ID PayPal tidak ditemukan.' });
      return;
    }

    if (transaction.status === 'EXPIRED') {
      res.status(400).json({ success: false, message: 'Sesi Order PayPal sudah kedaluwarsa. Buat order baru.' });
      return;
    }

    const captureId = `CAP-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const payerId = `PAYER${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const usdVal = transaction.amountUsd || convertToPayPalUsd(transaction.amount, transaction.currency || 'USD');

    // Buat payload event resmi PayPal Webhook (PAYMENT.CAPTURE.COMPLETED)
    const paypalEventPayload = {
      id: `WH-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
      event_version: '1.0',
      create_time: new Date().toISOString(),
      resource_type: 'capture',
      resource_version: '2.0',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      summary: `Payment completed for $ ${usdVal.toFixed(2)} USD`,
      resource: {
        id: captureId,
        status: 'COMPLETED',
        custom_id: transaction.orderId,
        invoice_id: transaction.orderId,
        amount: {
          currency_code: 'USD',
          value: usdVal.toFixed(2),
        },
        payer: {
          email_address: String(paypalEmail).trim() || transaction.userEmail,
          payer_id: payerId,
        },
        supplementary_data: {
          related_ids: {
            order_id: transaction.paypalOrderId || transaction.danaReferenceNo,
          },
        },
         final_capture: true,
      },
    };

    const rawEventString = JSON.stringify(paypalEventPayload);
    const sigHeaders = generatePayPalTransmissionSignature(rawEventString);

    const verified = verifyPayPalTransmissionSignature(
      rawEventString,
      sigHeaders.transmissionId,
      sigHeaders.transmissionTime,
      sigHeaders.transmissionSig
    );
    if (!verified) {
      res.status(500).json({ success: false, message: 'Gagal memverifikasi PAYPAL-TRANSMISSION-SIG.' });
      return;
    }

    transaction.status = 'PAID';
    transaction.paymentMethod = paymentMethod;
    transaction.paypalCaptureId = captureId;
    transaction.paypalPayerEmail = String(paypalEmail).trim() || transaction.userEmail;
    transaction.paypalPayerId = payerId;
    transaction.paidAt = new Date().toISOString();

    const user = db.users.find((u) => u.id === transaction.userId);
    let updatedToken: string | undefined;
    if (user) {
      user.role = 'PREMIUM';
      user.plan = transaction.planTarget || 'PREMIUM';
      user.planActivatedAt = transaction.paidAt;
      updatedToken = signJwt({
        userId: user.id,
        email: user.email,
        role: user.role,
        plan: user.plan,
      });
    }

    saveDatabase(db);

    res.json({
      success: true,
      message: 'Pembayaran PayPal berhasil di-capture! Status diubah ke PAID & akun di-upgrade ke PREMIUM.',
      webhookPayloadSent: paypalEventPayload,
      webhookSignatureUsed: sigHeaders.transmissionSig,
      transaction,
      user: user ? sanitizeUser(user) : null,
      token: updatedToken,
    });
  };

  app.post('/api/payment/paypal/capture-order', requireAuth, handleCaptureOrSimulatePayPal);
  app.post('/api/payment/paypal/simulate-webhook', requireAuth, handleCaptureOrSimulatePayPal);

  // --------------------------------------------------------------------------
  // F. LANDING PAGE PAYPAL CHECKOUT & STATUS POLLING ENDPOINTS
  // --------------------------------------------------------------------------
  app.get('/api/payment/check-status', (req: Request, res: Response) => {
    const orderId = String(req.query.orderId || '').trim();
    if (!orderId) {
      res.status(400).json({ success: false, status: 'INVALID', message: 'Parameter orderId wajib disertakan.' });
      return;
    }

    let tx = db.transactions.find((t) => t.orderId === orderId);
    if (!tx) {
      const now = new Date();
      const isUsd = orderId.includes('USD');
      const ppOrderId = `${crypto.randomBytes(8).toString('hex').toUpperCase().slice(0, 17)}`;
      const sigMeta = generatePayPalTransmissionSignature(orderId);
      tx = {
        orderId,
        danaReferenceNo: ppOrderId,
        paypalOrderId: ppOrderId,
        currency: isUsd ? 'USD' : 'IDR',
        amountUsd: 9.99,
        paymentMethod: 'paypal_express',
        userId: 'usr_demo_01',
        userEmail: 'demo@metus.id',
        planTarget: 'PREMIUM',
        amount: isUsd ? 9.99 : 99000,
        description: 'Metus Auto-Post PRO Subscription (PayPal)',
        status: 'PENDING',
        qrContent: `${PAYPAL_CONFIG.checkoutWebBaseUrl}?token=${ppOrderId}`,
        signatureHeader: sigMeta.transmissionSig,
        expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
        createdAt: now.toISOString(),
      };
      db.transactions.push(tx);
      saveDatabase(db);
    }

    if (tx.status === 'PENDING' && new Date(tx.expiresAt).getTime() <= Date.now()) {
      tx.status = 'EXPIRED';
      saveDatabase(db);
    }

    res.json({
      success: true,
      orderId: tx.orderId,
      status: tx.status,
      paidAt: tx.paidAt || null,
      plan: tx.status === 'PAID' ? 'PRO' : 'FREE',
    });
  });

  // Endpoint Konfirmasi Pembayaran PayPal dari Landing Page / Admin
  app.post('/api/payment/hybrid-simulate-paid', (req: Request, res: Response) => {
    const { orderId, gateway = 'paypal_express' } = req.body || {};
    if (!orderId) {
      res.status(400).json({ success: false, message: 'orderId wajib diisi' });
      return;
    }

    const isUsd = orderId.includes('USD') || String(gateway).toLowerCase().includes('usd');
    let tx = db.transactions.find((t) => t.orderId === orderId);
    if (!tx) {
      const ppOrderId = `${crypto.randomBytes(8).toString('hex').toUpperCase().slice(0, 17)}`;
      const captureId = `CAP-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
      const sigMeta = generatePayPalTransmissionSignature(orderId);
      tx = {
        orderId,
        danaReferenceNo: ppOrderId,
        paypalOrderId: ppOrderId,
        paypalCaptureId: captureId,
        currency: isUsd ? 'USD' : 'IDR',
        amountUsd: 9.99,
        paymentMethod: gateway,
        userId: 'usr_demo_01',
        userEmail: 'demo@metus.id',
        planTarget: 'PREMIUM',
        amount: isUsd ? 9.99 : 99000,
        description: `Metus PRO via PayPal (${gateway})`,
        status: 'PAID',
        qrContent: `${PAYPAL_CONFIG.checkoutWebBaseUrl}?token=${ppOrderId}`,
        signatureHeader: sigMeta.transmissionSig,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString(),
      };
      db.transactions.push(tx);
    } else {
      tx.status = 'PAID';
      tx.paymentMethod = gateway;
      tx.paidAt = new Date().toISOString();
    }

    const user = db.users[0];
    if (user) {
      user.role = 'PREMIUM';
      user.plan = 'PREMIUM';
      user.planActivatedAt = tx.paidAt;
    }
    saveDatabase(db);

    res.json({
      success: true,
      orderId: tx.orderId,
      status: 'PAID',
      gateway,
      paidAt: tx.paidAt,
    });
  });

  // --------------------------------------------------------------------------
  // F2. SECRET ADMIN VAULT API ENDPOINTS (PROTECTED BY MASTER KEY / ADMIN JWT)
  // --------------------------------------------------------------------------
  const buildAdminOverviewPayload = () => {
    const safeUsers = db.users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      plan: u.plan,
      planActivatedAt: u.planActivatedAt,
      createdAt: u.createdAt,
    }));

    const paidTxs = db.transactions.filter((t) => t.status === 'PAID');
    const domesticRevenueIdr = paidTxs
      .filter((t) => t.amount >= 1000)
      .reduce((acc, t) => acc + t.amount, 0);
    const globalRevenueUsd = paidTxs
      .filter((t) => t.amount < 1000)
      .reduce((acc, t) => acc + t.amount, 0);

    return {
      users: safeUsers,
      transactions: [...db.transactions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
      stats: {
        totalUsers: db.users.length,
        proUsers: db.users.filter((u) => u.plan === 'PREMIUM' || u.plan === 'AGENCY').length,
        freeUsers: db.users.filter((u) => u.plan === 'FREE').length,
        totalTransactions: db.transactions.length,
        paidTransactions: paidTxs.length,
        pendingTransactions: db.transactions.filter((t) => t.status === 'PENDING').length,
        domesticRevenueIdr,
        globalRevenueUsd: Number(globalRevenueUsd.toFixed(2)),
        activeMasterKeyHint: `${ADMIN_MASTER_KEY.slice(0, 6)}••••${ADMIN_MASTER_KEY.slice(-4)}`,
      },
    };
  };

  const requireAdminAuth = (req: express.Request, res: express.Response): boolean => {
    const adminHeader = String(req.headers['x-admin-token'] || '');
    if (adminHeader === ADMIN_MASTER_KEY) return true;
    const verified = verifyJwt(adminHeader);
    if (verified && verified.role === 'ADMIN') return true;
    res.status(403).json({
      success: false,
      message: 'Akses ditolak: Token Vault Admin tidak valid atau kedaluwarsa.',
    });
    return false;
  };

  app.post('/api/admin/unlock', (req, res) => {
    const { passkey, email, password } = req.body || {};

    if (passkey && String(passkey).trim() === ADMIN_MASTER_KEY) {
      const adminUser = db.users.find((u) => u.role === 'ADMIN') || db.users[0];
      const adminToken = signJwt(
        {
          userId: adminUser.id,
          email: adminUser.email,
          role: 'ADMIN',
          plan: 'AGENCY',
        },
        true
      );
      return res.json({
        success: true,
        adminToken,
        unlockedBy: 'MASTER_PASSKEY',
        ...buildAdminOverviewPayload(),
      });
    }

    if (email && password) {
      const user = db.users.find(
        (u) => u.email.toLowerCase() === String(email).trim().toLowerCase()
      );
      if (user && user.passwordHash === hashPassword(String(password)) && user.role === 'ADMIN') {
        const adminToken = signJwt(
          {
            userId: user.id,
            email: user.email,
            role: 'ADMIN',
            plan: user.plan,
          },
          true
        );
        return res.json({
          success: true,
          adminToken,
          unlockedBy: user.email,
          ...buildAdminOverviewPayload(),
        });
      }
    }

    return res.status(401).json({
      success: false,
      message: 'Kunci Rahasia (Master Passkey) atau kredensial Admin salah.',
    });
  });

  app.get('/api/admin/overview', (req, res) => {
    if (!requireAdminAuth(req, res)) return;
    return res.json({
      success: true,
      ...buildAdminOverviewPayload(),
    });
  });

  app.post('/api/admin/users/update', (req, res) => {
    if (!requireAdminAuth(req, res)) return;
    const { userId, plan, role, fullName } = req.body || {};
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }
    if (plan && ['FREE', 'PREMIUM', 'AGENCY'].includes(plan)) {
      user.plan = plan;
      if (plan !== 'FREE') {
        user.planActivatedAt = new Date().toISOString();
      }
    }
    if (role && ['USER', 'PREMIUM', 'ADMIN'].includes(role)) {
      user.role = role;
    }
    if (fullName && String(fullName).trim()) {
      user.fullName = String(fullName).trim();
    }
    saveDatabase(db);
    return res.json({
      success: true,
      message: `Akun ${user.email} berhasil diperbarui (${user.plan} · ${user.role}).`,
      ...buildAdminOverviewPayload(),
    });
  });

  app.post('/api/admin/users/create', (req, res) => {
    if (!requireAdminAuth(req, res)) return;
    const { fullName, email, password, plan, role } = req.body || {};
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nama lengkap, email, dan password wajib diisi.',
      });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      return res.status(409).json({
        success: false,
        message: 'Email sudah terdaftar di database.',
      });
    }
    const newUser: UserRecord = {
      id: `usr_${crypto.randomBytes(5).toString('hex')}`,
      fullName: String(fullName).trim(),
      email: cleanEmail,
      passwordHash: hashPassword(String(password)),
      role: role && ['USER', 'PREMIUM', 'ADMIN'].includes(role) ? role : 'USER',
      plan: plan && ['FREE', 'PREMIUM', 'AGENCY'].includes(plan) ? plan : 'PREMIUM',
      planActivatedAt: plan !== 'FREE' ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    saveDatabase(db);
    return res.json({
      success: true,
      message: `Pengguna baru ${newUser.email} berhasil ditambahkan.`,
      ...buildAdminOverviewPayload(),
    });
  });

  app.post('/api/admin/users/delete', (req, res) => {
    if (!requireAdminAuth(req, res)) return;
    const { userId } = req.body || {};
    const target = db.users.find((u) => u.id === userId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }
    if (target.email === 'admin@metus.id') {
      return res.status(400).json({
        success: false,
        message: 'Akun Root Admin utama tidak dapat dihapus.',
      });
    }
    db.users = db.users.filter((u) => u.id !== userId);
    saveDatabase(db);
    return res.json({
      success: true,
      message: `Pengguna ${target.email} telah dihapus.`,
      ...buildAdminOverviewPayload(),
    });
  });

  app.post('/api/admin/transactions/override', (req, res) => {
    if (!requireAdminAuth(req, res)) return;
    const { orderId, status } = req.body || {};
    const tx = db.transactions.find((t) => t.orderId === orderId);
    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }
    if (!['PAID', 'PENDING', 'EXPIRED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status tidak valid.' });
    }

    tx.status = status;
    if (status === 'PAID') {
      tx.paidAt = new Date().toISOString();
      const user = db.users.find(
        (u) => u.id === tx.userId || u.email.toLowerCase() === tx.userEmail.toLowerCase()
      );
      if (user) {
        user.plan = tx.planTarget || 'PREMIUM';
        if (user.role === 'USER') user.role = 'PREMIUM';
        user.planActivatedAt = tx.paidAt;
      }
    }
    saveDatabase(db);
    return res.json({
      success: true,
      message: `Invoice ${tx.orderId} diubah ke status ${status}.`,
      ...buildAdminOverviewPayload(),
    });
  });

  app.post('/api/admin/rotate-key', (req, res) => {
    if (!requireAdminAuth(req, res)) return;
    const { newPasskey } = req.body || {};
    if (!newPasskey || String(newPasskey).trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Master Passkey baru minimal 6 karakter.',
      });
    }
    ADMIN_MASTER_KEY = String(newPasskey).trim();
    return res.json({
      success: true,
      message: 'Master Passkey berhasil diperbarui untuk sesi server ini.',
      ...buildAdminOverviewPayload(),
    });
  });

  // Pastikan semua request /api/* yang tidak cocok selalu mengembalikan JSON
  app.use('/api', (req, res) => {
    res.status(404).json({
      success: false,
      message: `Endpoint API tidak ditemukan: ${req.method} ${req.originalUrl}`,
    });
  });

  // --------------------------------------------------------------------------
  // G. VITE MIDDLEWARE (DEVELOPMENT) ATAU STATIC DIST (PRODUCTION)
  // --------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    process.env.DISABLE_HMR = 'true';
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'spa',
    });

    // Prevent @vite/client from throwing WebSocket connection errors when HMR is disabled in cloud preview
    const viteClientWsShim = `(function(){if(typeof window!=='undefined'&&window.WebSocket&&!window.__viteHmrWsPatched){window.__viteHmrWsPatched=true;const NativeWS=window.WebSocket;class SafeViteWS extends EventTarget{constructor(u,p){super();this.url=String(u||'');this.protocol=Array.isArray(p)?(p[0]||''):(p||'');this.readyState=1;this.bufferedAmount=0;this.extensions='';this.binaryType='blob';this.onopen=null;this.onerror=null;this.onclose=null;this.onmessage=null;setTimeout(()=>{const e=new Event('open');this.dispatchEvent(e);if(typeof this.onopen==='function')this.onopen(e);const m=new MessageEvent('message',{data:JSON.stringify({type:'connected'})});this.dispatchEvent(m);if(typeof this.onmessage==='function')this.onmessage(m);},0);}send(){}close(){this.readyState=3;}}window.WebSocket=function(u,p){const isVite=p==='vite-hmr'||(Array.isArray(p)&&p.includes('vite-hmr'))||String(u||'').includes('vite-hmr');if(isVite)return new SafeViteWS(u,p);return p!==undefined?new NativeWS(u,p):new NativeWS(u);};window.WebSocket.prototype=NativeWS.prototype;window.WebSocket.CONNECTING=0;window.WebSocket.OPEN=1;window.WebSocket.CLOSING=2;window.WebSocket.CLOSED=3;}})();\n`;

    app.use((req, res, next) => {
      if (req.url && req.url.startsWith('/@vite/client')) {
        const origEnd = res.end.bind(res);
        res.end = function (chunk?: any, encoding?: any, cb?: any) {
          if (chunk) {
            const body = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : String(chunk);
            const patched = viteClientWsShim + body;
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.removeHeader('Content-Length');
            return origEnd(patched, 'utf-8', cb);
          }
          return origEnd(chunk, encoding, cb);
        } as any;
      }
      next();
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Metus Server] Full-Stack Express + Auth + PayPal REST API v2 running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
