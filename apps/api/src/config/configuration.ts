export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
  databaseUrl: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  twoFactorEncryptionKey: string;
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  // Railway (and most PaaS hosts) injects PORT and expects the process to
  // bind to it; local dev uses API_PORT instead since PORT isn't set.
  port: parseInt(process.env.PORT ?? process.env.API_PORT ?? '3000', 10),
  // Comma-separated so a domain migration (old Railway URL + new custom
  // domain) can be allowed side by side instead of an all-or-nothing swap.
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((origin) => origin.trim()),
  databaseUrl: requireEnv('DATABASE_URL'),
  jwt: {
    accessSecret: requireEnv('JWT_ACCESS_SECRET'),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  },
  twoFactorEncryptionKey: requireEnv('TWO_FACTOR_ENCRYPTION_KEY'),
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
