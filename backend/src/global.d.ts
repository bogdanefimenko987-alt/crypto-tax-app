declare namespace NodeJS {
  interface ProcessEnv {
    JWT_SECRET?: string;
    ENCRYPTION_KEY?: string;
    NODE_ENV?: string;
    PORT?: string;
    VERCEL?: string;
    DATABASE_URL?: string;
  }
}

declare const Buffer: typeof import('buffer').Buffer;
declare const process: NodeJS.Process;