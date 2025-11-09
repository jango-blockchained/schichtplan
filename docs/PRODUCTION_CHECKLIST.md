# Production Deployment Checklist

Use this checklist before and after deploying to production.

## Pre-Deployment

### Code & Testing
- [ ] All unit tests passing (`npm run test`)
- [ ] All E2E tests passing (`npm run test:e2e`)
- [ ] Code review completed and approved
- [ ] No security vulnerabilities in dependencies (`npm audit`, `pip check`)
- [ ] Performance testing completed
- [ ] Load testing completed (if applicable)
- [ ] Documentation updated

### Configuration
- [ ] Production environment variables configured (`.env.prod`)
- [ ] Strong `SECRET_KEY` generated and set
- [ ] Strong `JWT_SECRET_KEY` generated and set
- [ ] Database credentials configured
- [ ] Redis credentials configured
- [ ] CORS origins set correctly
- [ ] WebAuthn domain configured (`WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`)
- [ ] Email service configured (if using)
- [ ] AI API keys configured (if using)
- [ ] Telegram bot configured (if using)

### Infrastructure
- [ ] Production server provisioned
- [ ] Domain name configured and DNS pointing to server
- [ ] SSL/TLS certificates obtained
- [ ] Firewall rules configured
- [ ] Reverse proxy (nginx) configured
- [ ] Database server ready (PostgreSQL recommended)
- [ ] Redis server ready
- [ ] Backup storage configured

### Security
- [ ] Firewall enabled and configured
- [ ] SSH key-based authentication only
- [ ] Fail2Ban installed and configured
- [ ] Security headers configured in nginx
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] Rate limiting configured
- [ ] Sensitive data not in version control
- [ ] Database backups scheduled

### Monitoring
- [ ] Health check endpoints configured
- [ ] Monitoring system set up (optional: Prometheus, Grafana)
- [ ] Log aggregation configured
- [ ] Error tracking configured (optional: Sentry)
- [ ] Uptime monitoring configured (optional: UptimeRobot)
- [ ] Alert notifications configured

## Deployment Steps

### 1. Backup Current System
- [ ] Backup current database
- [ ] Backup current application files
- [ ] Backup current configuration
- [ ] Test backup restoration

### 2. Deploy Application
- [ ] Pull latest code: `git pull origin main`
- [ ] Install/update dependencies: `pip install -r requirements.txt`, `bun install`
- [ ] Build frontend: `cd src/frontend && bun run build`
- [ ] Run database migrations: `flask db upgrade`
- [ ] Update environment variables
- [ ] Restart services: `sudo systemctl restart schichtplan-backend`

### 3. Docker Deployment (Alternative)
- [ ] Pull latest images: `docker-compose pull`
- [ ] Stop containers: `docker-compose down`
- [ ] Start containers: `docker-compose up -d`
- [ ] Check container status: `docker-compose ps`
- [ ] View logs: `docker-compose logs -f`

## Post-Deployment

### Verification
- [ ] Run smoke tests: `npm run test:e2e -- e2e/tests/smoke.spec.ts`
- [ ] Health check script passing: `./scripts/health-check.sh`
- [ ] Can access application in browser
- [ ] Login/authentication working
- [ ] Can create/edit employees
- [ ] Can generate schedules
- [ ] Can publish schedules
- [ ] PDF export working
- [ ] WebAuthn working on production domain
- [ ] Mobile site working correctly

### Monitoring
- [ ] Check application logs: `tail -f /var/log/schichtplan/app.log`
- [ ] Check nginx logs: `tail -f /var/log/nginx/access.log`
- [ ] Check error logs: `tail -f /var/log/nginx/error.log`
- [ ] Monitor CPU usage: `htop` or `top`
- [ ] Monitor memory usage: `free -h`
- [ ] Monitor disk space: `df -h`
- [ ] Check database connections
- [ ] Check Redis connections

### Performance
- [ ] Page load time acceptable (< 3 seconds)
- [ ] API response time acceptable (< 500ms)
- [ ] No memory leaks
- [ ] No database connection pool exhaustion
- [ ] Static assets caching working
- [ ] Gzip compression enabled

### Security
- [ ] HTTPS working and enforced
- [ ] Security headers present
- [ ] Rate limiting working
- [ ] No sensitive data exposed in responses
- [ ] No debug mode enabled
- [ ] No stack traces in error responses

## Rollback Plan

If deployment fails or issues are found:

1. **Immediate Rollback**
   - [ ] Stop new version: `docker-compose down` or `sudo systemctl stop schichtplan-backend`
   - [ ] Restore previous code: `git checkout <previous-tag>`
   - [ ] Restore database backup (if migrations were run)
   - [ ] Start previous version
   - [ ] Verify rollback successful

2. **Investigate Issues**
   - [ ] Check logs for errors
   - [ ] Review monitoring dashboards
   - [ ] Check error tracking service
   - [ ] Document issue

3. **Fix and Redeploy**
   - [ ] Fix identified issues
   - [ ] Test fixes in staging
   - [ ] Prepare new deployment
   - [ ] Repeat deployment process

## Regular Maintenance

### Daily
- [ ] Check application logs for errors
- [ ] Monitor system resources
- [ ] Verify backups completed

### Weekly
- [ ] Review security logs
- [ ] Check for dependency updates
- [ ] Review performance metrics
- [ ] Test backup restoration

### Monthly
- [ ] Update dependencies (security patches)
- [ ] Review and optimize database
- [ ] Review and rotate logs
- [ ] Security audit
- [ ] Performance review

### Quarterly
- [ ] Review and update documentation
- [ ] Conduct disaster recovery test
- [ ] Review and update security policies
- [ ] Capacity planning review

## Emergency Contacts

- **System Administrator**: [Name/Contact]
- **Database Administrator**: [Name/Contact]
- **Security Team**: [Contact]
- **On-Call Engineer**: [Contact/Schedule]
- **Hosting Provider Support**: [Contact]

## Documentation Links

- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT.md)
- [E2E Testing Guide](./E2E_TESTING_GUIDE.md)
- [Docker Setup Guide](./DOCKER_SETUP_GUIDE.md)
- [Troubleshooting Guide](../docs/troubleshooting.md)

## Notes

Date Deployed: _______________  
Deployed By: _______________  
Version/Tag: _______________  
Issues Encountered: _______________  
Resolution: _______________  

---

**Remember**: Always test in staging before deploying to production!
