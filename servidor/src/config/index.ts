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
  masterCode: process.env.MASTER_CODE || '',
  database: {
    url: required('DATABASE_URL'),
  },
};
