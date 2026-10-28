import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL ='https://xsfchlzrahvijklpkupr.supabase.co' ;
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_YwnZLfqNFnEoJYCWUCRA3g_snwyc9Us';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);