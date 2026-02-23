import { Result } from 'better-result';

import {
  getRequestFromServerContext,
  getWorkerEnvFromServerContext,
  type WorkerEnv,
} from '../cloudflare/runtime';

export interface CloudflareAccessAdminContext {
  env: WorkerEnv;
  request: Request;
  email: string;
}

function parseAdminEmailAllowlist(value: string | undefined): Set<string> {
  const normalized = value
    ?.split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);

  return new Set(normalized ?? []);
}

function getAccessEmailFromRequest(request: Request): string {
  const directHeader = request.headers.get('cf-access-authenticated-user-email')?.trim();
  if (directHeader) {
    return directHeader.toLowerCase();
  }

  const alternateHeader = request.headers.get('x-auth-request-email')?.trim();
  if (alternateHeader) {
    return alternateHeader.toLowerCase();
  }

  return '';
}

export function requireCloudflareAccessAdmin(
  context: unknown
): Result<CloudflareAccessAdminContext, Error> {
  const envResult = getWorkerEnvFromServerContext(context);
  if (Result.isError(envResult)) {
    return Result.err(envResult.error);
  }

  const requestResult = getRequestFromServerContext(context);
  if (Result.isError(requestResult)) {
    return Result.err(requestResult.error);
  }

  const accessEmail = getAccessEmailFromRequest(requestResult.value);
  if (!accessEmail) {
    return Result.err(new Error('Cloudflare Access identity header is missing.'));
  }

  const allowlist = parseAdminEmailAllowlist(envResult.value.CLOUDFLARE_ACCESS_ADMIN_EMAILS);
  if (allowlist.size === 0) {
    return Result.err(new Error('Cloudflare Access admin allowlist is not configured.'));
  }

  if (!allowlist.has(accessEmail)) {
    return Result.err(new Error('Authenticated Cloudflare Access identity is not authorized for admin actions.'));
  }

  return Result.ok({
    env: envResult.value,
    request: requestResult.value,
    email: accessEmail,
  });
}
