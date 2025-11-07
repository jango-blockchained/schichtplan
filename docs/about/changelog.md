# Frequently Asked Questions

Find answers to common questions about Schichtplan.

## General Questions

### What is Schichtplan?

Schichtplan is an open-source, AI-powered employee scheduling system designed to simplify workforce management. It combines modern web technologies with artificial intelligence to help create optimal work schedules while respecting employee preferences and ensuring compliance.

### Is Schichtplan free?

Yes! Schichtplan is completely free and open-source under the MIT License. You can use it for commercial and non-commercial purposes without any licensing fees.

### What does "Schichtplan" mean?

Schichtplan is German for "shift plan" or "work schedule." The name reflects the application's primary purpose.

### Who should use Schichtplan?

Schichtplan is ideal for:

- Retail stores and shops
- Restaurants and hospitality businesses
- Healthcare facilities
- Any organization managing hourly employees with complex scheduling needs

## Technical Questions

### What are the system requirements?

**For Web Deployment:**
- Python 3.12 or higher
- Node.js 18+ or Bun runtime
- 2GB RAM minimum (4GB recommended)
- Modern web browser with WebAuthn support

**For Docker:**
- Docker 20.10+
- Docker Compose 2.0+
- 2GB RAM minimum

**For Desktop:**
- Windows 10+, macOS 10.13+, or modern Linux
- 100MB disk space

### Can I run Schichtplan offline?

Yes! The desktop applications work completely offline. The web version requires a server connection, but you can run the server locally.

### Which databases are supported?

Schichtplan uses SQLite by default, which is perfect for small to medium deployments. For larger installations, you can easily migrate to PostgreSQL.

### Is my data secure?

Yes! Schichtplan uses:
- Passwordless WebAuthn authentication
- Encrypted data transmission (HTTPS)
- Self-hosted deployment (your data stays with you)
- No telemetry or data collection

### Can I customize Schichtplan?

Absolutely! Schichtplan is open source, so you can:
- Modify the source code
- Add custom features
- Create plugins
- Customize the UI theme
- Extend the API

## Features & Functionality

### Does Schichtplan support multiple locations?

Not yet, but multi-location support is on our roadmap for a future release.

### Can employees access their schedules?

Currently, Schichtplan is designed for managers/schedulers. Employee-facing features (like viewing their own schedules via mobile app or portal) are planned for future releases.

However, you can:
- Export schedules to PDF and distribute them
- Use the Telegram bot for schedule queries
- Use the API to build a custom employee portal

### How does AI scheduling work?

Schichtplan's AI integration uses Model Context Protocol (MCP) to:
- Analyze employee availability and preferences
- Suggest optimal shift assignments
- Detect scheduling conflicts
- Balance workload fairly across employees
- Answer natural language questions about schedules

AI features are optional and can be disabled.

### What AI providers are supported?

Schichtplan supports:
- Google Gemini
- OpenAI (ChatGPT)
- Anthropic Claude
- Any MCP-compatible AI tool

### Can I use Schichtplan without AI features?

Yes! All AI features are completely optional. Schichtplan works perfectly well as a traditional scheduling tool without any AI integration.

### Does Schichtplan handle vacation/time-off?

Yes! Schichtplan includes vacation planning with:
- Vacation request submission
- Approval workflow
- Calendar integration
- Automatic schedule blocking
- Balance tracking

### Can I export schedules?

Yes! Schichtplan supports:
- PDF export (multiple layouts)
- CSV export
- API access for custom exports
- Print-friendly formats

### Does it support multiple shift types?

Yes! You can define unlimited shift templates with:
- Custom start and end times
- Different days of the week
- Specific employee type requirements
- Keyholder requirements
- Pause/break periods

## Authentication & Security

### What is WebAuthn/Passkey authentication?

WebAuthn is a modern, passwordless authentication standard that uses:
- Biometrics (fingerprint, face recognition)
- Security keys (YubiKey, etc.)
- Device PIN as fallback

It's more secure than passwords because there's nothing to steal or phish.

### What if I lose my passkey?

Schichtplan provides 4 recovery codes during setup. Keep these in a safe place! If you lose your passkey, you can use a recovery code to regain access.

### What if I lose my recovery codes too?

If you lose both your passkey and all recovery codes, you'll need to reset the database, which will delete all data. This is why it's crucial to keep recovery codes safe!

### Can I have multiple admin users?

Currently, Schichtplan supports a single admin user. Multi-user support with role-based permissions is planned for a future release.

### Is two-factor authentication (2FA) supported?

WebAuthn passkeys are already more secure than traditional 2FA. They combine "something you have" (your device) with "something you are" (biometric) or "something you know" (PIN).

## Deployment & Hosting

### Can I host Schichtplan in the cloud?

Yes! You can deploy Schichtplan to:
- Amazon AWS (EC2, ECS, Fargate)
- Google Cloud Platform
- Microsoft Azure
- DigitalOcean
- Heroku
- Any VPS or cloud provider

### How much does it cost to host?

Costs depend on your hosting choice:
- **Self-hosted** (on-premises): Just hardware costs
- **VPS** (DigitalOcean, Linode): $5-20/month
- **Cloud** (AWS, GCP, Azure): Variable based on usage
- **Docker** on local server: Free (just hardware)

### Can I use my own domain name?

Yes! Configure your domain in the `.env` file:
```bash
WEBAUTHN_RP_ID=yourdomain.com
WEBAUTHN_ORIGIN=https://yourdomain.com
```

### Do I need a SSL/TLS certificate?

For production use with passkeys, yes. WebAuthn requires HTTPS (except for localhost during development).

Use Let's Encrypt for free SSL certificates.

### How do I backup my data?

Backup the SQLite database file regularly:
```bash
cp instance/app.db backups/app.db.$(date +%Y%m%d)
```

For Docker deployments, the database is in a volume. See the [Docker deployment guide](../deployment/docker.md) for backup instructions.

### How do I update Schichtplan?

```bash
# Pull latest code
git pull

# Update dependencies
pip install -r requirements.txt
cd src/frontend && bun install

# Apply database migrations
flask db upgrade

# Restart the application
./start.sh
```

For Docker: `docker-compose pull && docker-compose up -d`

## Integration & API

### Does Schichtplan have an API?

Yes! Schichtplan provides:
- RESTful API for all operations
- OpenAPI/Swagger documentation
- MCP server for AI tool integration
- JWT authentication

### Can I integrate with other systems?

Yes! Use the REST API to:
- Import employees from HR systems
- Export schedules to payroll systems
- Sync with calendar applications
- Build custom integrations

### Is there a mobile app?

Native mobile apps for iOS and Android are planned but not yet available. Currently, you can:
- Use the responsive web interface on mobile
- Use the Telegram bot for mobile access
- Use the desktop app on tablets

### Can I use Schichtplan with Telegram?

Yes! Schichtplan includes a Telegram bot that lets you:
- Search for employees
- View schedules
- Ask questions in natural language
- Receive notifications

See the [Telegram Bot Guide](../features/telegram-bot.md) for setup.

## Troubleshooting

### The application won't start

Check:
1. Python version is 3.12+
2. Virtual environment is activated
3. All dependencies are installed
4. Ports 5000 and 5173 are not in use

See the [Troubleshooting Guide](../guides/troubleshooting.md).

### Passkey registration fails

Ensure:
1. You're using HTTPS or localhost
2. Browser supports WebAuthn
3. Domain is configured correctly in `.env`
4. Browser has permission to use security device

### Database errors

Try:
```bash
# Check database schema
python check_db_schema.py

# Apply pending migrations
flask db upgrade

# In worst case, rebuild (WARNING: deletes data!)
python src/backend/tools/rebuild_db.py
```

### Performance is slow

Check:
1. Database size and indices
2. Number of active schedules
3. System resources (RAM, CPU)
4. Browser caching settings

### AI features don't work

Verify:
1. API keys are configured correctly
2. MCP server is running
3. Network connectivity to AI providers
4. API quota hasn't been exceeded

## Support & Community

### Where can I get help?

- 📖 [Documentation](https://jango-blockchained.github.io/schichtplan)
- 💬 [GitHub Discussions](https://github.com/jango-blockchained/schichtplan/discussions)
- 🐛 [Issue Tracker](https://github.com/jango-blockchained/schichtplan/issues)

### How do I report a bug?

1. Check if the bug is already reported
2. Create a new issue on GitHub
3. Include:
   - Steps to reproduce
   - Expected vs actual behavior
   - System information
   - Error messages and logs

### Can I request features?

Yes! Feature requests are welcome:
1. Check if already requested
2. Open a GitHub discussion
3. Describe the feature and use case
4. Explain why it would be useful

### How do I contribute?

See the [Contributing Guide](../development/contributing.md) for:
- Code contribution process
- Coding standards
- Testing requirements
- Pull request guidelines

### Is commercial support available?

Currently, support is community-based through GitHub. Professional support options may be available in the future.

## Licensing & Legal

### Can I use Schichtplan commercially?

Yes! The MIT License allows commercial use without restrictions.

### Do I need to share my modifications?

No, but we'd appreciate it! The MIT License doesn't require you to share modifications, but contributing back helps everyone.

### Can I sell Schichtplan?

Yes, but you must include the original license and copyright notice. Note that since Schichtplan is free and open source, selling it may not be practical.

### What about the data I create?

All data you create (employees, schedules, etc.) belongs to you. Schichtplan doesn't claim any rights to your data.

## Still Have Questions?

If your question isn't answered here:

1. Check the [full documentation](https://jango-blockchained.github.io/schichtplan)
2. Search [GitHub Discussions](https://github.com/jango-blockchained/schichtplan/discussions)
3. Ask in a new discussion
4. Open an issue if you've found a bug

We're here to help! 🎉
