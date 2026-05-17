# Deployment Guide

## Environment Variables

Copy `infra/.env.example` to `infra/.env` and fill in all required values.

### Required in Production

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string with `replicaSet=rs0` |
| `JWT_ACCESS_SECRET` | Min 32 chars, random, never the default |
| `JWT_REFRESH_SECRET` | Min 32 chars, random, never the default |
| `ENCRYPTION_KEY` | 32+ char key for AES-256 at-rest encryption |
| `PAYTABS_SERVER_KEY` | PayTabs server key from merchant dashboard |
| `PAYTABS_PROFILE_ID` | PayTabs profile ID |

### Optional (defaults to sandbox/localhost)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | API server port |
| `NODE_ENV` | `development` | Set to `production` in prod |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | — | Redis password (if any) |
| `AWS_REGION` | `me-south-1` | AWS region |
| `AWS_ACCESS_KEY_ID` | — | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | — | AWS credentials |
| `AWS_S3_BUCKET` | `travel-b2b-vouchers` | S3 bucket for vouchers |
| `AWS_SES_SENDER_EMAIL` | `no-reply@example.com` | SES sender |
| `TWILIO_ACCOUNT_SID` | — | Twilio SID |
| `TWILIO_AUTH_TOKEN` | — | Twilio auth token |
| `TWILIO_FROM_NUMBER` | — | Twilio source number |
| `TBO_API_URL` | TBO default URL | TBO API endpoint |
| `TBO_CLIENT_ID` | — | TBO client ID |
| `TBO_API_USERNAME` | — | TBO username |
| `TBO_API_KEY` | — | TBO API key |
| `TBO_SANDBOX` | `false` | Use TBO sandbox |
| `PAYTABS_REGION` | `ARE` | PayTabs region |
| `PAYTABS_SANDBOX` | `false` | Use PayTabs sandbox |
| `BCRYPT_ROUNDS` | `12` | bcrypt rounds (10 min in prod) |
| `CLIENT_APP_URL` | `http://localhost:4200` | CORS origin for client |
| `ADMIN_APP_URL` | `http://localhost:4201` | CORS origin for admin |

## Docker Compose (Production)

```bash
# Build and start
docker-compose -f infra/docker-compose.yml up -d --build

# View logs
docker-compose -f infra/docker-compose.yml logs -f server

# Scale server (if load-balanced)
docker-compose -f infra/docker-compose.yml up -d --scale server=3
```

### What docker-compose starts

- `mongo` — MongoDB 7 with `--replSet rs0` (required for transactions)
- `redis` — Redis 7 (BullMQ jobs + hotel search cache)
- `server` — NestJS API (waits for mongo health check)

### Mongo Replica Set Init

The healthcheck in docker-compose automatically runs `rs.initiate()` on first boot. Subsequent boots detect `rs0` is already configured and skip init.

## Production Checklist

- [ ] All required env vars set (boot will fail-fast if not)
- [ ] `NODE_ENV=production` set
- [ ] `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are unique, 32+ chars
- [ ] `ENCRYPTION_KEY` set for API config key encryption
- [ ] MongoDB replica set confirmed running (`rs.status()`)
- [ ] Redis confirmed running and reachable
- [ ] Reverse proxy (nginx/caddy) handles SSL termination
- [ ] `CLIENT_APP_URL` and `ADMIN_APP_URL` point to actual domains
- [ ] S3 bucket created with appropriate IAM permissions
- [ ] SES verified sender email

## Health Check

```bash
curl http://localhost:3000/api/v1/health
```

## Database Backup

```bash
# Dump
mongodump --uri="$MONGO_URI" --out=/backup/$(date +%Y%m%d)

# Restore
mongorestore --uri="$MONGO_URI" /backup/20260517
```
