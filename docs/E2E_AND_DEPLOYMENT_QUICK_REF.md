# E2E Testing & Production Deployment - Quick Reference

## E2E Testing

### Quick Start
```bash
# Install Playwright
bunx playwright install --with-deps chromium

# Run all E2E tests
npm run test:e2e

# Run smoke tests (quick validation)
npm run test:e2e:smoke

# Debug tests
npm run test:e2e:debug

# View test report
npm run test:e2e:report
```

### Test Suites
- **auth.spec.ts** - Authentication & security
- **employees.spec.ts** - Employee CRUD operations
- **schedule.spec.ts** - Schedule management
- **navigation.spec.ts** - UI navigation & accessibility
- **responsive.spec.ts** - Mobile/tablet compatibility
- **smoke.spec.ts** - Production smoke tests

### Browsers Tested
✅ Chromium, Firefox, WebKit  
✅ Mobile: iPhone 13, Pixel 5, iPad  
✅ 73+ test cases across all browsers

## Production Deployment

### Pre-Deployment
```bash
# 1. Run all tests
npm run test:all

# 2. Check security
npm audit
pip check

# 3. Generate production secrets
python3 -c "import secrets; print(secrets.token_hex(32))"

# 4. Review checklist
cat docs/PRODUCTION_CHECKLIST.md
```

### Deployment Methods

#### Docker (Recommended)
```bash
# 1. Configure environment
cp .env.prod.example .env.prod
nano .env.prod

# 2. Build and deploy
docker-compose -f docker-compose.prod.yml up -d

# 3. Check status
docker-compose ps
docker-compose logs -f
```

#### Manual Deployment
```bash
# 1. Update code
git pull origin main

# 2. Install dependencies
pip install -r requirements.txt
cd src/frontend && bun install && bun run build

# 3. Run migrations
flask db upgrade

# 4. Restart services
sudo systemctl restart schichtplan-backend nginx
```

### Post-Deployment Validation
```bash
# Run smoke tests
npm run test:e2e:smoke

# Check health
./scripts/health-check.sh

# Monitor logs
tail -f /var/log/schichtplan/app.log
tail -f /var/log/nginx/access.log
```

### Health Monitoring
```bash
# Backend health
curl http://localhost:5000/health

# Frontend
curl http://localhost/health

# Full system check
./scripts/health-check.sh
```

## Production Checklist

✅ **Security**
- Strong secrets configured
- HTTPS enabled
- Firewall configured
- Security headers set

✅ **Configuration**
- WebAuthn domain set
- Database configured
- Redis configured
- Email/AI services set (if using)

✅ **Testing**
- All tests passing
- Smoke tests passing
- Load testing done

✅ **Monitoring**
- Health checks configured
- Logs accessible
- Alerts configured

✅ **Backup**
- Database backups scheduled
- Backup restoration tested
- Rollback plan ready

## Common Commands

```bash
# E2E Testing
npm run test:e2e              # All tests
npm run test:e2e:smoke        # Quick validation
npm run test:e2e:mobile       # Mobile only
npm run test:e2e:ui           # Interactive mode
npm run test:e2e:report       # View results

# Deployment
docker-compose up -d          # Start services
docker-compose down           # Stop services
docker-compose logs -f        # View logs
./scripts/health-check.sh     # Health check

# Maintenance
docker-compose restart        # Restart all
docker-compose pull           # Update images
flask db upgrade              # Run migrations
systemctl restart schichtplan # Restart service
```

## Troubleshooting

**Tests failing?**
- Check application is running: `./start.sh`
- Install browsers: `bunx playwright install`
- Check BASE_URL: `PLAYWRIGHT_BASE_URL=http://localhost:5173`

**Deployment issues?**
- Check logs: `docker-compose logs` or `journalctl -u schichtplan`
- Verify environment: `docker-compose config`
- Test connectivity: `curl http://localhost:5000/health`

**Production problems?**
- Run health check: `./scripts/health-check.sh`
- Check SSL: `openssl s_client -connect yourdomain.com:443`
- Review checklist: `docs/PRODUCTION_CHECKLIST.md`
- Follow rollback plan if needed

## Documentation

- 📖 [E2E Testing Guide](./E2E_TESTING_GUIDE.md) - Complete testing documentation
- 🚀 [Production Deployment](./PRODUCTION_DEPLOYMENT.md) - Full deployment guide
- ✅ [Production Checklist](./PRODUCTION_CHECKLIST.md) - Deployment checklist
- 🐳 [Docker Guide](./deployment/docker.md) - Docker setup

## CI/CD

Tests run automatically on:
- Push to main/develop
- Pull requests
- Daily at 2 AM UTC
- Manual trigger

View results: GitHub Actions → E2E Tests workflow

## Need Help?

- 🐛 [Report Issue](https://github.com/jango-blockchained/schichtplan/issues)
- 💬 [Discussions](https://github.com/jango-blockchained/schichtplan/discussions)
- 📖 [Full Documentation](https://jango-blockchained.github.io/schichtplan)

---

**Pro Tip**: Run smoke tests after every deployment to quickly validate critical functionality!
