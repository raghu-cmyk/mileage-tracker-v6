#!/usr/bin/env tsx
/**
 * Smoke test for primary POST flows: register, login, create vehicle, create trip.
 * Exits non-zero if any flow returns HTTP 5xx.
 */

import { spawn, type ChildProcess } from 'child_process';
import { rmSync, existsSync } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SMOKE_DB = path.join(ROOT, 'prisma', 'smoke.db');
const PORT = 3456;
const BASE = `http://127.0.0.1:${PORT}`;

interface StepResult {
  name: string;
  status: number;
  ok: boolean;
  body?: unknown;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(maxAttempts = 60): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${BASE}/login`);
      if (res.status < 500) return;
    } catch {
      // server not ready
    }
    await sleep(1000);
  }
  throw new Error('Server did not become ready in time.');
}

async function postJson(
  url: string,
  body: Record<string, unknown>,
  cookie?: string
): Promise<{ status: number; json: unknown; cookie?: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    redirect: 'manual',
  });

  const setCookie = res.headers.get('set-cookie') ?? undefined;
  let json: unknown = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  const nextCookie = setCookie ? setCookie.split(';')[0] : cookie;

  return { status: res.status, json, cookie: nextCookie };
}

async function runSteps(): Promise<StepResult[]> {
  const username = `smoke_${Date.now()}`;
  const password = 'smoke-test-password-123';
  const results: StepResult[] = [];
  let cookie: string | undefined;

  const register = await postJson(`${BASE}/api/auth/register`, { username, password });
  results.push({
    name: 'register',
    status: register.status,
    ok: register.status < 500,
    body: register.json,
  });
  cookie = register.cookie ?? cookie;

  const login = await postJson(`${BASE}/api/auth/login`, { username, password }, cookie);
  results.push({
    name: 'login',
    status: login.status,
    ok: login.status < 500,
    body: login.json,
  });
  cookie = login.cookie ?? cookie;

  const vehicle = await postJson(
    `${BASE}/api/vehicles`,
    { display_name: 'Smoke Test Car', description: 'Smoke test vehicle' },
    cookie
  );
  results.push({
    name: 'create_vehicle',
    status: vehicle.status,
    ok: vehicle.status < 500,
    body: vehicle.json,
  });

  const vehicleId =
    vehicle.json && typeof vehicle.json === 'object' && 'id' in vehicle.json
      ? (vehicle.json as { id: number }).id
      : null;

  const categoriesRes = await fetch(`${BASE}/api/categories`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  let categoryId = 1;
  if (categoriesRes.ok) {
    const categories = (await categoriesRes.json()) as Array<{ id: number; code: string }>;
    const business = categories.find((c) => c.code === 'business');
    if (business) categoryId = business.id;
  }

  const trip = await postJson(
    `${BASE}/api/trips`,
    {
      trip_date: '2026-06-01',
      origin: 'Home Office',
      destination: 'Client Site',
      business_purpose: 'Client meeting',
      miles: '12.5',
      category_id: categoryId,
      vehicle_id: vehicleId,
    },
    cookie
  );
  results.push({
    name: 'create_trip',
    status: trip.status,
    ok: trip.status < 500,
    body: trip.json,
  });

  return results;
}

async function main() {
  if (existsSync(SMOKE_DB)) {
    rmSync(SMOKE_DB);
  }

  const env = {
    ...process.env,
    DATABASE_URL: `file:${SMOKE_DB}`,
    PORT: String(PORT),
    SESSION_SECRET: 'smoke-test-session-secret-min-32-chars',
  };

  console.log('Setting up smoke test database...');
  const { execSync } = await import('child_process');
  execSync('npx prisma db push --skip-generate', { env, stdio: 'inherit', cwd: ROOT });
  execSync('npm run db:seed', { env, stdio: 'inherit', cwd: ROOT });

  console.log(`Starting Next.js on port ${PORT}...`);
  execSync('npm run build', { env, stdio: 'inherit', cwd: ROOT });

  let server: ChildProcess | null = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: ROOT,
    env,
    stdio: 'pipe',
  });

  try {
    await waitForServer();
    console.log('Running POST flow smoke tests...');
    const results = await runSteps();

    let failed = false;
    for (const result of results) {
      const pass = result.ok && result.status >= 200 && result.status < 400;
      console.log(
        `${pass ? 'PASS' : 'FAIL'} ${result.name}: HTTP ${result.status}`,
        result.body ? JSON.stringify(result.body) : ''
      );
      if (!pass) failed = true;
      if (result.status >= 500) failed = true;
    }

    if (failed) {
      console.error('\nSmoke test FAILED');
      process.exit(1);
    }

    console.log('\nSmoke test PASSED');
  } finally {
    if (server) {
      server.kill('SIGTERM');
      await sleep(1000);
      if (!server.killed) server.kill('SIGKILL');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
