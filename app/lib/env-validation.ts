export function validateEnv() {
  const required = {
    API_URL: process.env.API_URL,
    API_TOKEN: process.env.API_TOKEN,
    LIGHTNING_API_URL: process.env.LIGHTNING_API_URL,
    LIGHTNING_API_ID: process.env.LIGHTNING_API_ID,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nPlease set these in your .env file');
    process.exit(1);
  }

  console.log('✅ All required environment variables are set');
}

