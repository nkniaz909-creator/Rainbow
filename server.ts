import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIREBASE_PROJECT_ID = 'nk-bd-acee1';
const ADMIN_EMAIL = (process.env.RAINBOW_ADMIN_EMAIL || 'nkcompany589@gmail.com').toLowerCase();

interface CertCache {
  certs: Record<string, string>;
  expiresAt: number;
}

let certCache: CertCache = { certs: {}, expiresAt: 0 };

async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now < certCache.expiresAt && Object.keys(certCache.certs).length > 0) {
    return certCache.certs;
  }
  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!resp.ok) {
    throw new Error('Failed to fetch Firebase public certificates');
  }
  const cacheControl = resp.headers.get('cache-control') || '';
  const match = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSeconds = match ? Number(match[1]) : 3600;
  const certs = (await resp.json()) as Record<string, string>;
  certCache = {
    certs,
    expiresAt: now + maxAgeSeconds * 1000,
  };
  return certs;
}

interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
}

async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }
  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
    alg?: string;
    kid?: string;
  };
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    email_verified?: boolean;
    phone_number?: string;
  };

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Invalid token algorithm or key ID');
  }
  const certs = await getFirebasePublicCerts();
  const cert = certs[header.kid];
  if (!cert) {
    throw new Error('Unknown signing key');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const signature = Buffer.from(sigB64, 'base64url');
  const isValidSig = verifier.verify(cert, signature);
  if (!isValidSig) {
    throw new Error('Invalid token signature');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.aud !== FIREBASE_PROJECT_ID) {
    throw new Error('Invalid token audience');
  }
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
    throw new Error('Invalid token issuer');
  }
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Missing token subject');
  }
  if (!payload.exp || payload.exp <= nowSec) {
    throw new Error('Token expired');
  }

  return {
    uid: payload.sub,
    email: payload.email,
    email_verified: payload.email_verified,
    phone_number: payload.phone_number,
  };
}

async function checkFirestoreAdminDoc(uid: string, idToken: string): Promise<boolean> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/admins/${encodeURIComponent(uid)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'rainbow-platform', company: 'NK' });
  });

  app.post('/api/admin/verify', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ isAdmin: false, error: 'Missing bearer token' });
      return;
    }
    const token = authHeader.slice(7).trim();
    try {
      const user = await verifyFirebaseIdToken(token);
      const isFounderEmail =
        typeof user.email === 'string' &&
        user.email.toLowerCase() === ADMIN_EMAIL &&
        user.email_verified === true;
      const isDocAdmin = await checkFirestoreAdminDoc(user.uid, token);
      const isAdmin = isFounderEmail || isDocAdmin;

      if (!isAdmin) {
        res.status(403).json({ isAdmin: false, uid: user.uid, error: 'Admin privileges required' });
        return;
      }

      res.json({
        isAdmin: true,
        uid: user.uid,
        email: user.email || null,
      });
    } catch (error) {
      res.status(401).json({
        isAdmin: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Rainbow server listening on port ${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
