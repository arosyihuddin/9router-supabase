import { createClient } from "@supabase/supabase-js";

/**
 * Supabase adapter for 9Router
 * Async implementation with table/column name normalization
 */
export async function createSupabaseAdapter(supabaseUrl, supabaseKey) {
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    db: { schema: "public" }
  });

  // Test connection
  const { error: testError } = await supabase.from("_meta").select("key").limit(1);
  if (testError && !testError.message.includes("does not exist") && !testError.message.includes("relation")) {
    throw new Error(`Supabase connection failed: ${testError.message}`);
  }

  // Convert camelCase table names to lowercase for Postgres
  function normalizeTableName(sql) {
    const tableMap = {
      'providerConnections': 'providerconnections',
      'providerNodes': 'providernodes',
      'proxyPools': 'proxypools',
      'apiKeys': 'apikeys',
      'usageHistory': 'usagehistory',
      'usageDaily': 'usagedaily',
      'requestDetails': 'requestdetails'
    };

    let normalized = sql;
    for (const [camel, lower] of Object.entries(tableMap)) {
      normalized = normalized.replace(new RegExp(`\\b${camel}\\b`, 'gi'), lower);
    }
    return normalized;
  }

  // Convert column names from camelCase to lowercase
  function normalizeColumnNames(sql) {
    const columnMap = {
      'authType': 'authtype',
      'isActive': 'isactive',
      'createdAt': 'createdat',
      'updatedAt': 'updatedat',
      'testStatus': 'teststatus',
      'machineId': 'machineid',
      'connectionId': 'connectionid',
      'apiKey': 'apikey',
      'promptTokens': 'prompttokens',
      'completionTokens': 'completiontokens',
      'dateKey': 'datekey'
    };

    let normalized = sql;
    for (const [camel, lower] of Object.entries(columnMap)) {
      normalized = normalized.replace(new RegExp(`\\b${camel}\\b`, 'g'), lower);
    }
    return normalized;
  }

  function normalizeSQL(sql) {
    let normalized = normalizeTableName(sql);
    normalized = normalizeColumnNames(normalized);
    return normalized;
  }

  // Convert result column names from lowercase back to camelCase
  function denormalizeResult(data) {
    if (!data) return data;

    const columnMap = {
      'authtype': 'authType',
      'isactive': 'isActive',
      'createdat': 'createdAt',
      'updatedat': 'updatedAt',
      'teststatus': 'testStatus',
      'machineid': 'machineId',
      'connectionid': 'connectionId',
      'apikey': 'apiKey',
      'prompttokens': 'promptTokens',
      'completiontokens': 'completionTokens',
      'datekey': 'dateKey'
    };

    if (Array.isArray(data)) {
      return data.map(row => {
        const newRow = {};
        for (const [key, value] of Object.entries(row)) {
          const camelKey = columnMap[key] || key;
          newRow[camelKey] = value;
        }
        return newRow;
      });
    } else if (typeof data === 'object') {
      const newRow = {};
      for (const [key, value] of Object.entries(data)) {
        const camelKey = columnMap[key] || key;
        newRow[camelKey] = value;
      }
      return newRow;
    }

    return data;
  }

  async function execSQL(sql, params = []) {
    const normalized = normalizeSQL(sql);

    // Substitute parameters directly into SQL (escape values for safety)
    let finalSql = normalized;
    if (params && params.length > 0) {
      let paramIndex = 0;
      finalSql = normalized.replace(/\?/g, () => {
        const param = params[paramIndex++];
        if (param === null || param === undefined) return 'NULL';
        if (typeof param === 'number') return String(param);
        if (typeof param === 'boolean') return param ? '1' : '0';
        // Escape single quotes in strings
        return `'${String(param).replace(/'/g, "''")}'`;
      });
    }

    const { data, error } = await supabase.rpc('exec_sql', {
      query: finalSql,
      params: '[]'  // Empty params since we already substituted
    });

    if (error) {
      throw new Error(`Supabase query error: ${error.message}`);
    }

    if (data && typeof data === 'object' && data.error) {
      throw new Error(`SQL execution error: ${data.error}`);
    }

    // Convert column names back to camelCase
    return denormalizeResult(data);
  }

  return {
    driver: "supabase-postgres",

    async run(sql, params = []) {
      const result = await execSQL(sql, params);
      return {
        changes: Array.isArray(result) ? result.length : 1,
        lastInsertRowid: 0
      };
    },

    async get(sql, params = []) {
      const result = await execSQL(sql, params);
      return Array.isArray(result) ? result[0] : result;
    },

    async all(sql, params = []) {
      const result = await execSQL(sql, params);
      return Array.isArray(result) ? result : (result ? [result] : []);
    },

    async exec(sql) {
      const statements = sql
        .split(";")
        .map(s => s.trim())
        .filter(s => s && !s.startsWith("--"));

      for (const stmt of statements) {
        await execSQL(stmt, []);
      }
    },

    async transaction(fn) {
      // Supabase doesn't support traditional transactions via PostgREST
      // We'll execute the function directly without transaction semantics
      // For production use, consider using Supabase Edge Functions with proper transaction support
      try {
        const result = await fn();
        return result;
      } catch (error) {
        console.error('[Supabase transaction] Error:', error);
        throw error;
      }
    },

    checkpoint() {},
    close() {},
    raw: supabase,
  };
}
