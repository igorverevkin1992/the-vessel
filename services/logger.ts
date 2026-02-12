type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
}

const isDev = import.meta.env?.DEV ?? true;

const formatEntry = (entry: LogEntry): string =>
  `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;

const log = (level: LogLevel, message: string, data?: unknown): void => {
  if (!isDev) return;

  const entry: LogEntry = {
    level,
    message,
    data,
    timestamp: new Date().toISOString(),
  };

  const formatted = formatEntry(entry);

  // eslint-disable-next-line no-console
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  out(formatted, data ?? '');
};

export const logger = {
  info: (message: string, data?: unknown) => log('info', message, data),
  warn: (message: string, data?: unknown) => log('warn', message, data),
  error: (message: string, data?: unknown) => log('error', message, data),
};
