export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  mongo: {
    uri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/travel-b2b',
  },

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'access-secret-change-in-prod',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'refresh-secret-change-in-prod',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  aws: {
    region: process.env.AWS_REGION ?? 'me-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3Bucket: process.env.AWS_S3_BUCKET ?? 'travel-b2b-vouchers',
    sesSenderEmail: process.env.AWS_SES_SENDER_EMAIL ?? 'no-reply@example.com',
  },

  currency: {
    default: process.env.DEFAULT_CURRENCY ?? 'AED',
    supported: ['AED', 'USD'],
  },

  paytabs: {
    serverKey: process.env.PAYTABS_SERVER_KEY,
    profileId: parseInt(process.env.PAYTABS_PROFILE_ID ?? '0', 10),
    region: process.env.PAYTABS_REGION ?? 'ARE',
    sandbox: process.env.PAYTABS_SANDBOX === 'true',
  },

  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
  passwordResetTokenTtlMin: 30,
  emailVerificationTokenTtlMin: 60,

  clientAppUrl: process.env.CLIENT_APP_URL ?? 'http://localhost:4200',
  adminAppUrl: process.env.ADMIN_APP_URL ?? 'http://localhost:4201',

  tbo: {
    apiUrl: process.env.TBO_API_URL ?? 'http://api.tbotechnology.in/HotelAPI_v7/HotelService.svc',
    clientId: process.env.TBO_CLIENT_ID ?? '',
    username: process.env.TBO_API_USERNAME ?? '',
    apiKey: process.env.TBO_API_KEY ?? '',
    sandbox: process.env.TBO_SANDBOX === 'true',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    fromNumber: process.env.TWILIO_FROM_NUMBER ?? '',
  },
});
