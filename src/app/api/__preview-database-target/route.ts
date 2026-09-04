import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDatabaseUrl } from '@/shared/server/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 10;

const TARGET_BRANCH = 'prelaunch-env-schema-guardrails';
const TOKEN_ENVIRONMENT_NAME = 'PREVIEW_DATABASE_TARGET_TOKEN';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
}

function equalSecret(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export async function POST(request: Request) {
  if (
    process.env.VERCEL !== '1' ||
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.VERCEL_GIT_COMMIT_REF !== TARGET_BRANCH
  ) {
    return json({ message: 'Not found.' }, 404);
  }

  const token = process.env[TOKEN_ENVIRONMENT_NAME]?.trim() ?? '';
  const suppliedToken = request.headers.get('x-atehna-target-token') ?? '';
  if (token.length < 43 || !equalSecret(suppliedToken, token)) {
    return json({ message: 'Unauthorized.' }, 401);
  }

  const databaseUrl = getDatabaseUrl()?.trim() ?? '';
  const deploymentSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() ?? '';
  if (!databaseUrl || !/^[0-9a-f]{40}$/iu.test(deploymentSha)) {
    return json({ message: 'Target identity is unavailable.' }, 503);
  }

  const targetGuard = createHmac('sha256', token)
    .update(`${deploymentSha}:${databaseUrl}`)
    .digest('hex');

  return json({
    deploymentSha,
    targetGuard
  });
}
