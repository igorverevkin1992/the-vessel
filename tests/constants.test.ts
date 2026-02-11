import { describe, it, expect } from 'vitest';
import { AVAILABLE_MODELS, APP_VERSION, CHARS_PER_SECOND, MIN_BLOCK_DURATION_SEC, MAX_LOG_ENTRIES, API_RETRY_COUNT, AGENT_MODELS } from '../constants';

describe('constants', () => {
  it('APP_VERSION should be a non-empty string', () => {
    expect(APP_VERSION).toBeTruthy();
    expect(typeof APP_VERSION).toBe('string');
  });

  it('AVAILABLE_MODELS should have at least one model', () => {
    expect(AVAILABLE_MODELS.length).toBeGreaterThan(0);
  });

  it('each model should have id and name', () => {
    AVAILABLE_MODELS.forEach(model => {
      expect(model.id).toBeTruthy();
      expect(model.name).toBeTruthy();
    });
  });

  it('timing constants should be positive numbers', () => {
    expect(CHARS_PER_SECOND).toBeGreaterThan(0);
    expect(MIN_BLOCK_DURATION_SEC).toBeGreaterThan(0);
  });

  it('MAX_LOG_ENTRIES should be a reasonable number', () => {
    expect(MAX_LOG_ENTRIES).toBeGreaterThan(100);
  });

  it('API_RETRY_COUNT should be at least 1', () => {
    expect(API_RETRY_COUNT).toBeGreaterThanOrEqual(1);
  });

  it('AGENT_MODELS should use Flash for Scout, Decoder, Architect', () => {
    expect(AGENT_MODELS.SCOUT).toContain('flash');
    expect(AGENT_MODELS.DECODER).toContain('flash');
    expect(AGENT_MODELS.ARCHITECT).toContain('flash');
  });

  it('AGENT_MODELS should use Pro for Researcher and Narrator', () => {
    expect(AGENT_MODELS.RESEARCHER).toContain('pro');
    expect(AGENT_MODELS.NARRATOR).toContain('pro');
  });
});
