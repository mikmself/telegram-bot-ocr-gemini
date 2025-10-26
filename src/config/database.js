const mysql = require('mysql2/promise');
const config = require('./env');
const logger = require('../utils/logger');

let pool = null;

const createPool = () => {
  if (pool) {
    return pool;
  }

  pool = mysql.createPool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    connectionLimit: config.database.connectionLimit,
    queueLimit: config.database.queueLimit,
    waitForConnections: config.database.waitForConnections,
    enableKeepAlive: config.database.enableKeepAlive,
    keepAliveInitialDelay: config.database.keepAliveInitialDelay
  });

  logger.info('MySQL connection pool created', {
    host: config.database.host,
    port: config.database.port,
    database: config.database.database
  });

  return pool;
};

const getConnection = async () => {
  if (!pool) {
    createPool();
  }

  try {
    const connection = await pool.getConnection();
    logger.debug('Database connection acquired');
    return connection;
  } catch (error) {
    logger.error('Failed to get database connection:', error);
    throw error;
  }
};

const query = async (sql, params = []) => {
  const connection = await getConnection();

  try {
    const [results] = await connection.execute(sql, params);
    return results;
  } catch (error) {
    logger.error('Database query error:', { sql, error: error.message });
    throw error;
  } finally {
    connection.release();
  }
};

const testConnection = async () => {
  try {
    const connection = await getConnection();
    await connection.ping();
    connection.release();
    logger.info('Database connection test successful');
    return true;
  } catch (error) {
    logger.error('Database connection test failed:', error);
    return false;
  }
};

const closePool = async () => {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      logger.info('MySQL connection pool closed');
    } catch (error) {
      logger.error('Error closing connection pool:', error);
    }
  }
};


const executeTransaction = async (callback) => {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();
    logger.debug('Transaction started');

    const result = await callback(connection);

    await connection.commit();
    logger.debug('Transaction committed');

    return result;

  } catch (error) {
    await connection.rollback();
    logger.error('Transaction rolled back due to error:', error.message);
    throw error;

  } finally {
    connection.release();
  }
};


const queryInTransaction = async (connection, sql, params = []) => {
  try {
    const [results] = await connection.execute(sql, params);
    return results;
  } catch (error) {
    logger.error('Transaction query error:', { sql, error: error.message });
    throw error;
  }
};

module.exports = {
  createPool,
  getConnection,
  query,
  testConnection,
  closePool,
  executeTransaction,
  queryInTransaction,
  get pool() {
    return pool;
  }
};
