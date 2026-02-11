import { describe, it, expect } from 'vitest';
import { AgentType, INITIAL_STATE } from '../types';

describe('types', () => {
  describe('AgentType enum', () => {
    it('should have all 6 agent types', () => {
      expect(AgentType.SCOUT).toBe('SCOUT');
      expect(AgentType.DECODER).toBe('DECODER');
      expect(AgentType.RESEARCHER).toBe('RESEARCHER');
      expect(AgentType.ARCHITECT).toBe('ARCHITECT');
      expect(AgentType.NARRATOR).toBe('NARRATOR');
      expect(AgentType.COMPLETED).toBe('COMPLETED');
    });
  });

  describe('INITIAL_STATE', () => {
    it('should start in IDLE state', () => {
      expect(INITIAL_STATE.currentAgent).toBe('IDLE');
    });

    it('should have empty topic', () => {
      expect(INITIAL_STATE.topic).toBe('');
    });

    it('should not be processing', () => {
      expect(INITIAL_STATE.isProcessing).toBe(false);
    });

    it('should have initial log messages', () => {
      expect(INITIAL_STATE.logs.length).toBeGreaterThan(0);
    });

    it('should have empty history', () => {
      expect(INITIAL_STATE.history).toEqual([]);
    });

    it('should have steppable mode off', () => {
      expect(INITIAL_STATE.isSteppable).toBe(false);
    });

    it('should not have showHistory open by default', () => {
      expect(INITIAL_STATE.showHistory).toBe(false);
    });
  });
});
