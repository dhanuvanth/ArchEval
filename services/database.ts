import { createClient } from '@supabase/supabase-js';
import { Submission } from '../types';

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
 *   ai_explanation text
 * );
 * 
 * 3. Retrieve your URL and ANON KEY from Project Settings -> API.
 * 4. Set them as environment variables: SUPABASE_URL and SUPABASE_KEY.
 */

// NOTE: These should be set in your environment variables.
// If missing, the app will gracefully fallback to local mock data.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

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

  // Ensure dates are parsed correctly from JSON
  return (data || []).map((d: any) => ({
    ...d,
    // Map database 'created_at' to app 'timestamp'
    timestamp: new Date(d.created_at), 
    // Ensure data JSONB field is handled if Supabase returns it as string or object
    data: typeof d.data === 'string' ? JSON.parse(d.data) : d.data,
    // Map database column names back to TypeScript interface if needed
    user: d.user_name || d.user
  })) as Submission[];
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
      ai_explanation: submission.aiExplanation
    }]);

  if (error) {
    console.error('Supabase save error:', error);
    return false;
  }
  return true;
};