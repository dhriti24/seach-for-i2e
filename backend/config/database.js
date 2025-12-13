module.exports = ({ env }) => {
  // Auto-detect Neon database (host contains "neon.tech" or "neon")
  const isNeon = env('DATABASE_HOST', '').includes('neon.tech') || env('DATABASE_HOST', '').includes('neon');
  
  // Auto-enable SSL for Neon, or use explicit DATABASE_SSL setting
  const sslEnabled = env.bool('DATABASE_SSL', isNeon);
  
  return {
    connection: {
      client: 'postgres',
      connection: {
        host: env('DATABASE_HOST', 'localhost'),
        port: env.int('DATABASE_PORT', 5432),
        database: env('DATABASE_NAME', 'i2e_search'),
        user: env('DATABASE_USERNAME', 'postgres'),
        password: env('DATABASE_PASSWORD', 'root'),
        ssl: sslEnabled ? {
          rejectUnauthorized: false, // Required for Neon and most cloud databases
        } : false,
      },
    },
  };
};

