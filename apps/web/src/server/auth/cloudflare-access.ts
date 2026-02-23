import { Result } from "better-result";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type JWTPayload } from "jose";
import * as z from "zod/mini";

import {
  getRequestFromServerContext,
  getWorkerEnvFromServerContext,
  type WorkerEnv,
} from "../cloudflare/runtime";

export interface CloudflareAccessAdminContext {
  env: WorkerEnv;
  request: Request;
  email: string;
}

interface AccessJwtConfig {
  audience: string;
  teamDomain: string;
}

const accessJwtConfigSchema = z.object({
  CLOUDFLARE_ACCESS_AUD: z.string(),
  CLOUDFLARE_ACCESS_TEAM_DOMAIN: z.string(),
});

const accessJwtPayloadSchema = z.object({
  email: z.optional(z.string()),
});

const accessJwksByTeamDomain = new Map<string, JWTVerifyGetKey>();

function getAccessEmailFromRequest(request: Request): string {
  const directHeader = request.headers.get("cf-access-authenticated-user-email")?.trim();
  if (directHeader) {
    return directHeader.toLowerCase();
  }

  const alternateHeader = request.headers.get("x-auth-request-email")?.trim();
  if (alternateHeader) {
    return alternateHeader.toLowerCase();
  }

  return "";
}

function parseAccessJwtConfig(env: WorkerEnv): Result<AccessJwtConfig, Error> {
  const parsed = accessJwtConfigSchema.safeParse({
    CLOUDFLARE_ACCESS_AUD: env.CLOUDFLARE_ACCESS_AUD?.trim(),
    CLOUDFLARE_ACCESS_TEAM_DOMAIN: env.CLOUDFLARE_ACCESS_TEAM_DOMAIN?.trim(),
  });

  if (!parsed.success) {
    return Result.err(
      new Error(
        "Cloudflare Access JWT verification is not configured. Set CLOUDFLARE_ACCESS_AUD and CLOUDFLARE_ACCESS_TEAM_DOMAIN.",
      ),
    );
  }

  const audience = parsed.data.CLOUDFLARE_ACCESS_AUD.trim();
  if (audience.length === 0) {
    return Result.err(new Error("Cloudflare Access AUD cannot be empty."));
  }

  const teamDomainResult = normalizeTeamDomain(parsed.data.CLOUDFLARE_ACCESS_TEAM_DOMAIN);
  if (Result.isError(teamDomainResult)) {
    return Result.err(teamDomainResult.error);
  }

  return Result.ok({
    audience,
    teamDomain: teamDomainResult.value,
  });
}

function normalizeTeamDomain(value: string): Result<string, Error> {
  const raw = value.trim();
  if (raw.length === 0) {
    return Result.err(new Error("Cloudflare Access team domain cannot be empty."));
  }

  const normalizedInput =
    raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
  const urlResult = Result.try(() => new URL(normalizedInput));
  if (Result.isError(urlResult)) {
    return Result.err(new Error("Invalid Cloudflare Access team domain URL."));
  }

  const hostname = urlResult.value.hostname.toLowerCase();
  if (!hostname.endsWith(".cloudflareaccess.com")) {
    return Result.err(
      new Error("Cloudflare Access team domain must end with .cloudflareaccess.com."),
    );
  }

  return Result.ok(hostname);
}

function getAccessJwks(teamDomain: string): Result<JWTVerifyGetKey, Error> {
  if (accessJwksByTeamDomain.has(teamDomain)) {
    const cached = accessJwksByTeamDomain.get(teamDomain);
    if (cached) {
      return Result.ok(cached);
    }
  }

  const jwksUrlResult = Result.try(() => new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
  if (Result.isError(jwksUrlResult)) {
    return Result.err(new Error("Failed to construct Cloudflare Access JWKS URL."));
  }

  const jwks = createRemoteJWKSet(jwksUrlResult.value);
  accessJwksByTeamDomain.set(teamDomain, jwks);
  return Result.ok(jwks);
}

function getEmailFromVerifiedJwtPayload(payload: JWTPayload): Result<string, Error> {
  const parsed = accessJwtPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return Result.err(new Error("Cloudflare Access JWT payload is invalid."));
  }

  const email = parsed.data.email?.trim().toLowerCase();
  if (!email) {
    return Result.err(new Error("Cloudflare Access JWT does not include an email claim."));
  }

  return Result.ok(email);
}

async function verifyCloudflareAccessJwt(
  request: Request,
  config: AccessJwtConfig,
): Promise<Result<{ email: string }, Error>> {
  const assertion = request.headers.get("cf-access-jwt-assertion")?.trim();
  if (!assertion) {
    return Result.err(new Error("Cloudflare Access JWT assertion header is missing."));
  }

  const jwksResult = getAccessJwks(config.teamDomain);
  if (Result.isError(jwksResult)) {
    return Result.err(jwksResult.error);
  }

  const issuer = `https://${config.teamDomain}`;
  const verificationResult = await Result.tryPromise(() =>
    jwtVerify(assertion, jwksResult.value, {
      audience: config.audience,
      issuer: [issuer, `${issuer}/`],
      algorithms: ["RS256"],
    }),
  );

  if (Result.isError(verificationResult)) {
    return Result.err(new Error("Cloudflare Access JWT validation failed."));
  }

  const payloadEmailResult = getEmailFromVerifiedJwtPayload(verificationResult.value.payload);
  if (Result.isError(payloadEmailResult)) {
    return Result.err(payloadEmailResult.error);
  }

  const headerEmail = getAccessEmailFromRequest(request);
  if (headerEmail && headerEmail !== payloadEmailResult.value) {
    return Result.err(
      new Error("Cloudflare Access identity headers do not match the verified JWT."),
    );
  }

  return Result.ok({
    email: payloadEmailResult.value,
  });
}

export async function requireCloudflareAccessAdmin(
  context: unknown,
): Promise<Result<CloudflareAccessAdminContext, Error>> {
  const envResult = getWorkerEnvFromServerContext(context);
  if (Result.isError(envResult)) {
    return Result.err(envResult.error);
  }

  const requestResult = getRequestFromServerContext(context);
  if (Result.isError(requestResult)) {
    return Result.err(requestResult.error);
  }

  const configResult = parseAccessJwtConfig(envResult.value);
  if (Result.isError(configResult)) {
    return Result.err(configResult.error);
  }

  const verificationResult = await verifyCloudflareAccessJwt(
    requestResult.value,
    configResult.value,
  );
  if (Result.isError(verificationResult)) {
    return Result.err(verificationResult.error);
  }

  return Result.ok({
    env: envResult.value,
    request: requestResult.value,
    email: verificationResult.value.email,
  });
}
