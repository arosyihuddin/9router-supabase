/**
 * Environment detection utilities
 */

/**
 * Check if running in serverless environment
 * @returns {boolean}
 */
export function isServerless() {
  return (
    process.env.DEPLOYMENT_ENV === "serverless" ||
    process.env.VERCEL === "1" ||
    process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined
  );
}

/**
 * Check if using Supabase database
 * @returns {boolean}
 */
export function isSupabaseMode() {
  return process.env.DATABASE_TYPE === "supabase";
}
