import { createClient } from '@supabase/supabase-js';
import { Submission, MAX_POSSIBLE_SCORE } from '../types';

/**
 * SUPABASE SETUP INSTRUCTIONS
 * 
 * 1. Create a new project at https://supabase.com
 * 2. Go to the SQL Editor and run the following query to create the table:
 * 
 * create table submissions (
 *   id text primary key,
 *   user_name text,
 *   created_at timestamptz,
 *   data jsonb,
 *   score numeric,
 *   decision text,
 *   ai_explanation text,
 *   hard_blocker text
 * );
 * 
 * 3. Retrieve your URL and ANON KEY from Project Settings -> API.
 * 4. Set them as environment variables: SUPABASE_URL and SUPABASE_KEY.
 */

// NOTE: These should be set in your environment variables.
// If missing, the app will gracefully fallback to local mock data.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export const fetchSubmissions = async (): Promise<Submission[]> => {
  if (!supabase) {
    console.log('Supabase not configured, using local state.');
    return [];
  }
  
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase fetch error:', error);
    return [];
  }

  // Map DB rows (snake_case) to app Submission shape (camelCase)
  return (data || []).map((d: any) => {
    const rawExplanation = d.ai_explanation ?? d.aiExplanation ?? '';
    return {
      id: d.id,
      user: d.user_name ?? d.user ?? '',
      timestamp: new Date(d.created_at),
      data: typeof d.data === 'string' ? JSON.parse(d.data) : d.data,
      score: Number(d.score) ?? 0,
      maxScore: d.max_score ?? MAX_POSSIBLE_SCORE,
      decision: d.decision ?? '',
      aiExplanation: typeof rawExplanation === 'string' ? rawExplanation : String(rawExplanation),
      hardBlocker: d.hard_blocker ?? d.hardBlocker,
    } as Submission;
  });
};

export const saveSubmission = async (submission: Submission): Promise<boolean> => {
  if (!supabase) return false;

  const { error } = await supabase
    .from('submissions')
    .insert([{
      id: submission.id,
      user_name: submission.user, 
      created_at: submission.timestamp.toISOString(), // Map 'timestamp' to 'created_at'
      data: submission.data,
      score: submission.score,
      decision: submission.decision,
      ai_explanation: submission.aiExplanation,
      hard_blocker: submission.hardBlocker
    }]);

  if (error) {
    console.error('Supabase save error:', error);
    return false;
  }
  return true;
};