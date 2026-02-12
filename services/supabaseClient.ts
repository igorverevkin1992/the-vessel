import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ScriptBlock, HistoryItem } from '../types';
import { logger } from './logger';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

export const saveRunToHistory = async (topic: string, model: string, script: ScriptBlock[]): Promise<HistoryItem | null> => {
  if (!supabase) {
    logger.warn("Supabase credentials missing. History not saved.");
    return null;
  }

  const { data, error } = await supabase
    .from('blockbuster_history')
    .insert([{ topic, model, script }])
    .select();

  if (error) {
    logger.error('Error saving history', error);
    return null;
  }
  return (data?.[0] as HistoryItem) ?? null;
};

export const fetchHistory = async (): Promise<HistoryItem[]> => {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('blockbuster_history')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Error fetching history', error);
    return [];
  }
  return (data as HistoryItem[]) ?? [];
};

export const deleteHistoryItem = async (id: number): Promise<boolean> => {
  if (!supabase) return false;

  const { error } = await supabase
    .from('blockbuster_history')
    .delete()
    .eq('id', id);

  if (error) {
    logger.error('Error deleting history item', error);
    return false;
  }
  return true;
};
