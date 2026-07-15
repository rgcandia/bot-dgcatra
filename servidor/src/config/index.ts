const required = (key: string): string => {
  const val = process.env[key];
  if (!val) {
    console.error(`❌ Variable de entorno requerida no definida: ${key}`);
    process.exit(1);
  }
  return val;
};

export const config = {
  port: parseInt(process.env.PORT || '4002', 10),
  jwt: {
    secret: required('JWT_SECRET'),
  },
  superAdminPhone: process.env.SUPER_ADMIN_PHONE || '',
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  database: {
    url: required('DATABASE_URL'),
  },
};
