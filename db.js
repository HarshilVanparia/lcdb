const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'local_community',
  password: 'ghost123',
  port: 5432,
});

module.exports = pool;
