import {readFile} from 'node:fs/promises';

const DEFAULT_BASE_URL = 'https://screeps.com';
const DEFAULT_MAX_REQUEST_BYTES = 1_048_576;
const DEFAULT_MAX_WS_PAYLOAD_BYTES = 1_048_576;

function parsePositiveInteger(value, fallback, name) {
  const parsed = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function normalizeUrl(value, name) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${name} must use http or https`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must not contain credentials, query, or hash`);
  }
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.toString().replace(/\/$/, '');
}

function normalizeOrigins(values) {
  return [...new Set(values.map((value) => {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error(`Invalid allowed origin: ${value}`);
    }
    return url.origin;
  }))];
}

async function readConfigFile(path, readFileImpl) {
  const raw = await readFileImpl(path, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('SCREEPS_CONFIG_FILE must contain a JSON object');
  }
  return parsed;
}

async function readSecretFile(path, readFileImpl) {
  const value = await readFileImpl(path, 'utf8');
  return String(value).trim();
}

export async function loadConfig({env = process.env, readFileImpl = readFile} = {}) {
  const file = env.SCREEPS_CONFIG_FILE ? await readConfigFile(env.SCREEPS_CONFIG_FILE, readFileImpl) : {};
  const fileValue = (envKey) => {
    const aliases = {
      SCREEPS_BASE_URL: 'baseUrl',
      SCREEPS_USERNAME: 'username',
      SCREEPS_ALLOWED_ORIGINS: 'allowedOrigins',
      SCREEPS_TOKEN_FILE: 'tokenFile',
      DASHBOARD_ALLOWED_ORIGINS: 'dashboardAllowedOrigins',
    };
    return file[envKey] ?? file[aliases[envKey]];
  };
  const value = (key, fallback = undefined) => env[key] ?? fileValue(key) ?? fallback;
  const baseUrl = normalizeUrl(value('SCREEPS_BASE_URL', DEFAULT_BASE_URL), 'SCREEPS_BASE_URL');
  const allowedInput = value('SCREEPS_ALLOWED_ORIGINS');
  const allowedOrigins = normalizeOrigins(
    (Array.isArray(allowedInput) ? allowedInput : String(allowedInput ?? new URL(baseUrl).origin).split(','))
      .map((item) => String(item).trim())
      .filter(Boolean)
  );
  const tokenFile = env.SCREEPS_TOKEN_FILE ?? fileValue('SCREEPS_TOKEN_FILE');
  const token = tokenFile
    ? await readSecretFile(tokenFile, readFileImpl)
    : env.SCREEPS_TOKEN !== undefined
      ? String(env.SCREEPS_TOKEN).trim()
      : String(file.token || '').trim();
  const username = String(value('SCREEPS_USERNAME', '')).trim();
  const dashboardOriginsInput = value('DASHBOARD_ALLOWED_ORIGINS', '');
  const dashboardAllowedOrigins = normalizeOrigins(
    (Array.isArray(dashboardOriginsInput) ? dashboardOriginsInput : String(dashboardOriginsInput).split(','))
      .map((item) => String(item).trim())
      .filter(Boolean)
  );
  if (!allowedOrigins.includes(new URL(baseUrl).origin)) {
    throw new Error('SCREEPS_BASE_URL must be present in SCREEPS_ALLOWED_ORIGINS');
  }

  return {
    baseUrl,
    username,
    token,
    allowedOrigins,
    dashboardAllowedOrigins,
    port: parsePositiveInteger(value('PORT', 3000), 3000, 'PORT'),
    host: String(value('HOST', '0.0.0.0')),
    staticDir: String(value('STATIC_DIR', 'src-next/out')),
    maxRequestBytes: parsePositiveInteger(value('MAX_REQUEST_BYTES', DEFAULT_MAX_REQUEST_BYTES), DEFAULT_MAX_REQUEST_BYTES, 'MAX_REQUEST_BYTES'),
    maxWsPayloadBytes: parsePositiveInteger(value('MAX_WS_PAYLOAD_BYTES', DEFAULT_MAX_WS_PAYLOAD_BYTES), DEFAULT_MAX_WS_PAYLOAD_BYTES, 'MAX_WS_PAYLOAD_BYTES'),
    ready: Boolean(token),
    public: {
      baseUrl,
      username,
      configured: Boolean(token),
      realtimePath: '/socket/websocket',
    },
  };
}

export function configErrorResponse(error) {
  return new Response(JSON.stringify({
    error: error instanceof Error ? error.message : 'Dashboard configuration is invalid',
  }), {
    status: 503,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
