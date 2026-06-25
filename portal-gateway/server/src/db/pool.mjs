import pg from 'pg'
import { config } from '../config/index.mjs'

const { Pool } = pg
export const pool = new Pool({ connectionString: config.databaseUrl })

export async function closePool() {
  await pool.end()
}
