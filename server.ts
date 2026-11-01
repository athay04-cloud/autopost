import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

// ============================================================================
// 1. KONFIGURASI ENVIRONMENT & KREDENSIAL DANA BISNIS
// ============================================================================
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'metus_jwt_secret_key_2026_secure';

const DANA_CONFIG = {
  env: process.env.DANA_ENV || 'sandbox',
  baseUrl: process.env.DANA_BASE_URL || 'https://api.sandbox.dana.id',
  merchantId: process.env.DANA_MERCHANT_ID || '21662000010928371',
  clientId: process.env.DANA_CLIENT_ID || '202603019928371625',
  clientSecret: process.env.DANA_CLIENT_SECRET || 'dana_sandbox_client_secret_key_9981',
  webhookSecret: process.env.DANA_WEBHOOK_SECRET || 'dana_sandbox_webhook_secret_key_7721',
};

// ============================================================================
// 2. SKEMA DATA (USER & TRANSACTION) + PERSISTENT STORAGE
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
  danaReferenceNo: string;
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
// 3. HELPER JWT & SIGNATURE DANA BISNIS (SNAP BI STANDARD)
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
 * Pembuatan Signature Request API DANA Bisnis (Standar SNAP BI)
 * Format StringToSign = HTTPMethod + ":" + EndpointUrl + ":" + Lowercase(HexEncode(SHA-256(Minify(RequestBody)))) + ":" + X-TIMESTAMP
 */
function generateDanaRequestSignature(
  httpMethod: string,
  endpointPath: string,
  requestBody: Record<string, unknown>,
  timestamp: string
): string {
  const minifiedBody = JSON.stringify(requestBody);
  const bodySha256 = crypto.createHash('sha256').update(minifiedBody).digest('hex').toLowerCase();
  const stringToSign = `${httpMethod.toUpperCase()}:${endpointPath}:${bodySha256}:${timestamp}`;
  return crypto.createHmac('sha256', DANA_CONFIG.clientSecret).update(stringToSign).digest('base64');
}

/**
 * Validasi Signature Webhook Masuk dari DANA Bisnis
 * Mencegah request spoofing / pemalsuan status pembayaran
 */
function verifyDanaWebhookSignature(rawPayload: Record<string, unknown>, receivedSignature: string): boolean {
  if (!receivedSignature) return false;
  const canonical = JSON.stringify({
    originalPartnerReferenceNo: rawPayload.originalPartnerReferenceNo,
    originalReferenceNo: rawPayload.originalReferenceNo,
    latestTransactionStatus: rawPayload.latestTransactionStatus,
    amount: rawPayload.amount,
  });
  const expectedSignature = crypto
    .createHmac('sha256', DANA_CONFIG.webhookSecret)
    .update(canonical)
    .digest('base64');

  const a = Buffer.from(receivedSignature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Generator String EMVCo QRIS Dinamis (Standar QRIS Nasional / DANA Bisnis)
 */
function buildDynamicQrisString(orderId: string, amount: number, merchantName = 'METUS AUTO POST PRO'): string {
  const amountStr = String(Math.round(amount));
  const payload = [
    '000201', // Payload Format Indicator
    '010212', // Point of Initiation Method (12 = Dynamic QRIS)
    `26660014ID.CO.DANA.WWW011893600915${DANA_CONFIG.merchantId.slice(0, 10)}0215${orderId.slice(-15)}0303UMI`,
    '52045734', // Merchant Category Code (Software / SaaS)
    '5303360', // Transaction Currency (360 = IDR)
    `54${String(amountStr.length).padStart(2, '0')}${amountStr}`, // Dynamic Amount
    '5802ID', // Country Code
    `59${String(merchantName.length).padStart(2, '0')}${merchantName}`,
    '6007JAKARTA',
    `62${String(orderId.length + 4).padStart(2, '0')}01${String(orderId.length).padStart(2, '0')}${orderId}`,
    '6304', // CRC Checksum Tag
  ].join('');

  // Simple 4-hex checksum
  const crc = crypto.createHash('md5').update(payload).digest('hex').slice(0, 4).toUpperCase();
  return `${payload}${crc}`;
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
  // B. ENDPOINT DANA BISNIS QRIS: GENERATE ORDER (CREATE QRIS)
  // --------------------------------------------------------------------------
  app.post('/api/payment/qris/create', requireAuth, (req: Request, res: Response) => {
    const authUser = (req as Request & { user?: { userId: string } }).user;
    const user = db.users.find((u) => u.id === authUser?.userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'Pengguna tidak valid.' });
      return;
    }

    const { planTarget = 'PREMIUM', amount = 149000, description = 'Upgrade Paket Metus Pro Growth (PREMIUM)' } =
      req.body || {};

    const numericAmount = Number(amount) || 149000;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 menit masa berlaku QRIS
    const timestamp = now.toISOString();
    const orderId = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const danaReferenceNo = `DANAQR-${Date.now()}`;

    // Payload standar SNAP-BI / DANA Bisnis QRIS MPM Generate
    const danaRequestPayload = {
      partnerReferenceNo: orderId,
      merchantId: DANA_CONFIG.merchantId,
      amount: {
        value: `${numericAmount}.00`,
        currency: 'IDR',
      },
      validityPeriod: expiresAt.toISOString(),
      additionalInfo: {
        description,
        customerEmail: user.email,
        planTarget,
      },
    };

    const endpointPath = '/v1.0/qr/qr-mpm-generate.htm';
    const xSignature = generateDanaRequestSignature('POST', endpointPath, danaRequestPayload, timestamp);
    const qrContent = buildDynamicQrisString(orderId, numericAmount);

    const transaction: TransactionRecord = {
      orderId,
      danaReferenceNo,
      userId: user.id,
      userEmail: user.email,
      planTarget: planTarget === 'AGENCY' ? 'AGENCY' : 'PREMIUM',
      amount: numericAmount,
      description,
      status: 'PENDING',
      qrContent,
      signatureHeader: xSignature,
      expiresAt: expiresAt.toISOString(),
      createdAt: timestamp,
    };

    db.transactions.push(transaction);
    saveDatabase(db);

    res.status(201).json({
      success: true,
      message: 'Tagihan QRIS DANA Bisnis berhasil dibuat.',
      transaction,
      danaHeadersPreview: {
        'Content-Type': 'application/json',
        'X-TIMESTAMP': timestamp,
        'X-PARTNER-ID': DANA_CONFIG.clientId,
        'X-EXTERNAL-ID': orderId,
        'CHANNEL-ID': '95221',
        'X-SIGNATURE': xSignature,
      },
    });
  });

  // --------------------------------------------------------------------------
  // C. ENDPOINT CEK STATUS PEMBAYARAN (POLLING FALLBACK)
  // --------------------------------------------------------------------------
  app.get('/api/payment/qris/status/:orderId', requireAuth, (req: Request, res: Response) => {
    const { orderId } = req.params;
    const transaction = db.transactions.find((t) => t.orderId === orderId);

    if (!transaction) {
      res.status(404).json({ success: false, message: 'Invoice transaksi tidak ditemukan.' });
      return;
    }

    // Periksa apakah waktu pembayaran 15 menit sudah kedaluwarsa
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
  });

  // --------------------------------------------------------------------------
  // D. ENDPOINT WEBHOOK / CALLBACK HANDLER DANA BISNIS (HTTP POST)
  // --------------------------------------------------------------------------
  app.post('/api/payment/qris/webhook', (req: Request, res: Response) => {
    const receivedSignature = String(req.headers['x-signature'] || '');
    const payload = req.body || {};

    // 1. Validasi Signature Webhook untuk mencegah request spoofing
    const isValidSig = verifyDanaWebhookSignature(payload, receivedSignature);
    if (!isValidSig) {
      res.status(401).json({
        responseCode: '4015200',
        responseMessage: 'Unauthorized. Invalid X-SIGNATURE header.',
      });
      return;
    }

    const orderId = String(payload.originalPartnerReferenceNo || '');
    const txStatus = String(payload.latestTransactionStatus || ''); // '00' = SUCCESS pada SNAP BI DANA

    const transaction = db.transactions.find((t) => t.orderId === orderId);
    if (!transaction) {
      res.status(404).json({
        responseCode: '4045201',
        responseMessage: 'Transaction Not Found',
      });
      return;
    }

    // 2. Jika pembayaran sukses ('00' atau 'SUCCESS'), update status invoice & upgrade user ke PREMIUM
    if (txStatus === '00' || txStatus === 'SUCCESS') {
      transaction.status = 'PAID';
      transaction.paidAt = new Date().toISOString();

      const user = db.users.find((u) => u.id === transaction.userId);
      if (user) {
        user.role = 'PREMIUM';
        user.plan = transaction.planTarget || 'PREMIUM';
        user.planActivatedAt = transaction.paidAt;
      }
      saveDatabase(db);
    } else if (txStatus === '05' || txStatus === 'EXPIRED') {
      transaction.status = 'EXPIRED';
      saveDatabase(db);
    }

    // Response standar SNAP BI DANA Notify
    res.status(200).json({
      responseCode: '2005200',
      responseMessage: 'Successful',
      orderId: transaction.orderId,
      status: transaction.status,
    });
  });

  // --------------------------------------------------------------------------
  // E. ENDPOINT SIMULASI WEBHOOK SANDBOX (UNTUK PENGUJIAN LOKAL 1-KLIK)
  // --------------------------------------------------------------------------
  app.post('/api/payment/qris/simulate-webhook', requireAuth, (req: Request, res: Response) => {
    const { orderId } = req.body || {};
    const transaction = db.transactions.find((t) => t.orderId === orderId);
    if (!transaction) {
      res.status(404).json({ success: false, message: 'Order ID tidak ditemukan.' });
      return;
    }

    if (transaction.status === 'EXPIRED') {
      res.status(400).json({ success: false, message: 'Transaksi sudah kedaluwarsa. Buat QRIS baru.' });
      return;
    }

    // Buat payload notifikasi resmi DANA SNAP-BI
    const webhookPayload = {
      originalPartnerReferenceNo: transaction.orderId,
      originalReferenceNo: transaction.danaReferenceNo,
      latestTransactionStatus: '00', // '00' = Paid / Success
      transactionStatusDesc: 'SUCCESS',
      amount: {
        value: `${transaction.amount}.00`,
        currency: 'IDR',
      },
      paidTime: new Date().toISOString(),
    };

    // Hitung X-SIGNATURE valid menggunakan DANA_WEBHOOK_SECRET
    const canonical = JSON.stringify({
      originalPartnerReferenceNo: webhookPayload.originalPartnerReferenceNo,
      originalReferenceNo: webhookPayload.originalReferenceNo,
      latestTransactionStatus: webhookPayload.latestTransactionStatus,
      amount: webhookPayload.amount,
    });
    const validSignature = crypto
      .createHmac('sha256', DANA_CONFIG.webhookSecret)
      .update(canonical)
      .digest('base64');

    // Verifikasi dengan fungsi yang sama seperti endpoint webhook
    const verified = verifyDanaWebhookSignature(webhookPayload, validSignature);
    if (!verified) {
      res.status(500).json({ success: false, message: 'Gagal memverifikasi signature simulasi.' });
      return;
    }

    transaction.status = 'PAID';
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
      message: 'Simulasi Webhook DANA Bisnis berhasil! Status diubah ke PAID & akun di-upgrade ke PREMIUM.',
      webhookPayloadSent: webhookPayload,
      webhookSignatureUsed: validSignature,
      transaction,
      user: user ? sanitizeUser(user) : null,
      token: updatedToken,
    });
  });

  // --------------------------------------------------------------------------
  // F. HYBRID PAYMENT ENDPOINTS (MIDTRANS DOMESTIC & LEMON SQUEEZY GLOBAL)
  // --------------------------------------------------------------------------
  const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-MetusSandboxKey2026';
  const LEMONSQUEEZY_WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || 'ls_signing_secret_metus_2026';

  // Endpoint Polling Status Frontend: GET /api/payment/check-status?orderId=...
  app.get('/api/payment/check-status', (req: Request, res: Response) => {
    const orderId = String(req.query.orderId || '').trim();
    if (!orderId) {
      res.status(400).json({ success: false, status: 'INVALID', message: 'Parameter orderId wajib disertakan.' });
      return;
    }

    let tx = db.transactions.find((t) => t.orderId === orderId);
    if (!tx) {
      // Buat record otomatis jika diinisiasi dari Landing Page
      const now = new Date();
      tx = {
        orderId,
        danaReferenceNo: `HYB-${Date.now()}`,
        userId: 'usr_demo_01',
        userEmail: 'demo@metus.id',
        planTarget: 'PREMIUM',
        amount: orderId.includes('USD') ? 9.99 : 99000,
        description: 'Metus Auto-Post PRO Subscription',
        status: 'PENDING',
        qrContent: buildDynamicQrisString(orderId, 99000),
        signatureHeader: 'HYBRID_ORDER',
        expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
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

  // Webhook Domestik: Midtrans Notification Handler (QRIS / Virtual Account)
  app.post('/api/webhook/midtrans', (req: Request, res: Response) => {
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = req.body || {};

    // Verifikasi Signature Midtrans: SHA512(order_id + status_code + gross_amount + ServerKey)
    const rawString = `${order_id}${status_code}${gross_amount}${MIDTRANS_SERVER_KEY}`;
    const expectedSignature = crypto.createHash('sha512').update(rawString).digest('hex');

    if (signature_key !== expectedSignature) {
      res.status(401).json({ success: false, message: 'Invalid Midtrans signature_key' });
      return;
    }

    const isPaid =
      (transaction_status === 'capture' && fraud_status === 'accept') ||
      transaction_status === 'settlement';

    if (isPaid) {
      const tx = db.transactions.find((t) => t.orderId === order_id);
      if (tx) {
        tx.status = 'PAID';
        tx.paidAt = new Date().toISOString();
      }
      const user = db.users.find((u) => u.id === (tx?.userId || 'usr_demo_01'));
      if (user) {
        user.role = 'PREMIUM';
        user.plan = 'PREMIUM';
        user.planActivatedAt = new Date().toISOString();
      }
      saveDatabase(db);
    }

    res.status(200).json({ status: 'OK', orderId: order_id, upgradedTo: isPaid ? 'PRO' : 'PENDING' });
  });

  // Webhook Internasional: Lemon Squeezy / PayPal Notification Handler
  app.post('/api/webhook/lemonsqueezy', (req: Request, res: Response) => {
    const signature = String(req.headers['x-signature'] || '');
    const rawBody = JSON.stringify(req.body || {});

    // Verifikasi Signature Lemon Squeezy: HMAC-SHA256(secret, rawBody)
    const hmac = crypto.createHmac('sha256', LEMONSQUEEZY_WEBHOOK_SECRET).update(rawBody).digest('hex');
    if (signature !== hmac) {
      res.status(401).json({ success: false, message: 'Invalid X-Signature header' });
      return;
    }

    const eventName = req.body?.meta?.event_name;
    const customOrderId = req.body?.meta?.custom_data?.order_id;
    const userEmail = req.body?.data?.attributes?.user_email;

    if (eventName === 'order_created' || eventName === 'subscription_payment_success') {
      const tx = db.transactions.find((t) => t.orderId === customOrderId);
      if (tx) {
        tx.status = 'PAID';
        tx.paidAt = new Date().toISOString();
      }
      const user = db.users.find((u) => u.email === userEmail) || db.users[0];
      if (user) {
        user.role = 'PREMIUM';
        user.plan = 'PREMIUM';
        user.planActivatedAt = new Date().toISOString();
      }
      saveDatabase(db);
    }

    res.status(200).json({ received: true, upgraded: true });
  });

  // Endpoint Simulasi Konfirmasi Pembayaran Hybrid (Untuk Demo/Testing Landing Page)
  app.post('/api/payment/hybrid-simulate-paid', (req: Request, res: Response) => {
    const { orderId, gateway = 'midtrans' } = req.body || {};
    if (!orderId) {
      res.status(400).json({ success: false, message: 'orderId wajib diisi' });
      return;
    }

    let tx = db.transactions.find((t) => t.orderId === orderId);
    if (!tx) {
      tx = {
        orderId,
        danaReferenceNo: `HYB-${Date.now()}`,
        userId: 'usr_demo_01',
        userEmail: 'demo@metus.id',
        planTarget: 'PREMIUM',
        amount: orderId.includes('USD') ? 9.99 : 99000,
        description: `Metus PRO via ${gateway}`,
        status: 'PAID',
        qrContent: buildDynamicQrisString(orderId, 99000),
        signatureHeader: 'SIMULATED_WEBHOOK_VERIFIED',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString(),
      };
      db.transactions.push(tx);
    } else {
      tx.status = 'PAID';
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

    // Metode 1: Master Passkey
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

    // Metode 2: Kredensial Email + Password Admin
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

  // Pastikan semua request /api/* yang tidak cocok selalu mengembalikan JSON (bukan HTML SPA fallback)
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
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
    console.log(`[Metus Server] Full-Stack Express + Auth + DANA QRIS running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
