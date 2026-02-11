import { describe, it, expect } from 'vitest';
import { logger } from '../services/logger';

describe('logger', () => {
  it('should have info, warn, and error methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should not throw when called', () => {
    expect(() => logger.info('test message')).not.toThrow();
    expect(() => logger.warn('test warning')).not.toThrow();
    expect(() => logger.error('test error')).not.toThrow();
  });

  it('should accept optional data parameter', () => {
    expect(() => logger.info('test', { key: 'value' })).not.toThrow();
    expect(() => logger.error('test', new Error('test error'))).not.toThrow();
  });
});
