# About Schichtplan

## What is Schichtplan?

Schichtplan (German for "shift plan") is a modern, AI-powered employee scheduling system designed to simplify workforce management for organizations of all sizes. Built with cutting-edge technologies and a focus on security, usability, and flexibility, Schichtplan helps managers create optimal schedules while respecting employee preferences and ensuring compliance with labor regulations.

## Project History

Schichtplan was born from the real-world need for a better scheduling solution in retail environments. Traditional scheduling tools were either too expensive, too inflexible, or lacked the intelligence to handle complex scenarios like:

- Multiple employee types with different contract hours
- Keyholder requirements for opening and closing shifts
- Month-end week splits for reporting purposes
- Compliance with varying labor laws and contracts
- Fair distribution of desirable and undesirable shifts

Rather than settling for an inadequate solution, we built Schichtplan to address these challenges head-on.

## Core Philosophy

### Open Source First

Schichtplan is open source because we believe:

- **Transparency**: You should know exactly how your scheduling data is processed
- **Trust**: Open code can be audited for security and compliance
- **Freedom**: No vendor lock-in or surprise licensing changes
- **Community**: Better software through collaboration

### Privacy & Security

Your data belongs to you:

- **Self-Hosted**: Run Schichtplan on your infrastructure
- **No Tracking**: We don't collect analytics or usage data
- **Passwordless**: Modern WebAuthn eliminates password vulnerabilities
- **Encryption**: Sensitive data is encrypted at rest and in transit

### AI as an Assistant

AI should help, not replace, human decision-making:

- **Suggestions**: AI recommends, you decide
- **Transparency**: AI reasoning is explainable
- **Control**: All AI features can be disabled
- **Privacy**: Your data isn't sent to AI providers without consent

### Developer-Friendly

We built Schichtplan the way we'd want to use it:

- **Clean Architecture**: Well-organized, documented code
- **Comprehensive API**: Everything is accessible programmatically
- **Extensible**: Plugin system for custom functionality
- **Standard Technologies**: No proprietary frameworks

## Technology Choices

### Why These Technologies?

**Frontend: React + TypeScript**
- Industry-standard, well-supported
- Strong typing catches errors early
- Excellent ecosystem and tooling
- Great developer experience

**Backend: Flask + SQLAlchemy**
- Python's simplicity and readability
- Mature ORM with migration support
- Excellent for AI/ML integration
- Easy to understand and extend

**Database: SQLite (PostgreSQL-compatible)**
- Zero-configuration for small deployments
- Easy backup (single file)
- Sufficient for most use cases
- Simple migration to PostgreSQL if needed

**Authentication: WebAuthn**
- Eliminates password security risks
- Better user experience
- Future-proof technology
- Supported by all modern browsers

**AI: Model Context Protocol**
- Vendor-neutral AI integration
- Works with multiple AI providers
- Standardized interface
- Growing ecosystem

## Project Structure

Schichtplan follows a clean, modular architecture:

```
schichtplan/
├── src/
│   ├── backend/          # Python/Flask backend
│   │   ├── models/       # Database models
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Business logic
│   │   └── tools/        # Utilities and scripts
│   └── frontend/         # React/TypeScript frontend
│       ├── src/
│       │   ├── components/  # React components
│       │   ├── hooks/       # Custom hooks
│       │   ├── services/    # API clients
│       │   └── types/       # TypeScript types
│       └── public/          # Static assets
├── docs/                 # Documentation (you are here!)
├── tests/               # Test suites
└── electron/            # Desktop app wrapper
```

## Development Principles

### Code Quality

- **Type Safety**: TypeScript and Python type hints throughout
- **Testing**: Comprehensive test coverage
- **Linting**: Automatic code style enforcement
- **Documentation**: Every feature is documented

### User Experience

- **Intuitive**: Common tasks should be obvious
- **Responsive**: Works on desktop, tablet, and mobile
- **Accessible**: WCAG compliance for accessibility
- **Performance**: Fast load times and smooth interactions

### Maintainability

- **Clear Naming**: Variables and functions describe their purpose
- **Small Functions**: Each function does one thing well
- **Comments**: Explain why, not what
- **Refactoring**: Continuous improvement of code structure

## Community

### Contributors

Schichtplan is built by developers who care about quality software. We welcome contributions from everyone, whether you're fixing a typo or implementing a major feature.

See our [list of contributors](https://github.com/jango-blockchained/schichtplan/graphs/contributors).

### How You Can Help

There are many ways to contribute:

- 🐛 **Report bugs** - Help us identify and fix issues
- 💡 **Suggest features** - Share your ideas for improvement
- 📝 **Improve documentation** - Help others understand Schichtplan
- 🧪 **Write tests** - Increase code coverage
- 🎨 **Enhance UI/UX** - Make Schichtplan more beautiful and usable
- 🌍 **Translate** - Help make Schichtplan multilingual
- ⭐ **Star the repo** - Show your support and help others discover Schichtplan

See [Contributing Guide](../development/contributing.md) for details.

## Roadmap

### Completed

- ✅ Core scheduling functionality
- ✅ Employee management
- ✅ WebAuthn authentication
- ✅ AI integration via MCP
- ✅ Telegram bot
- ✅ PDF export
- ✅ Docker deployment
- ✅ Desktop applications
- ✅ Vacation planning
- ✅ Comprehensive documentation

### In Progress

- 🚧 Mobile apps (iOS, Android)
- 🚧 Advanced analytics dashboard
- 🚧 Multi-location support
- 🚧 Email notifications

### Planned

- 📋 Multi-language interface
- 📋 Calendar sync (Google Calendar, Outlook)
- 📋 In-app messaging
- 📋 Training mode for new schedulers
- 📋 Shift trading/swapping
- 📋 Time clock integration
- 📋 Payroll export

### Long-Term Vision

- 🌟 Mobile-first redesign
- 🌟 Real-time collaboration
- 🌟 Advanced AI forecasting
- 🌟 Industry-specific templates
- 🌟 Marketplace for extensions

## Recognition

### Built With

Schichtplan wouldn't exist without these excellent open-source projects:

- [React](https://react.dev/) - UI framework
- [Flask](https://flask.palletsprojects.com/) - Backend framework
- [FastMCP](https://github.com/jlowin/fastmcp) - Model Context Protocol
- [Shadcn UI](https://ui.shadcn.com/) - Component library
- [Electron](https://www.electronjs.org/) - Desktop framework
- [SQLAlchemy](https://www.sqlalchemy.org/) - ORM
- [python-telegram-bot](https://python-telegram-bot.org/) - Telegram integration
- [py-webauthn](https://github.com/duo-labs/py_webauthn) - WebAuthn implementation

### Inspiration

Schichtplan was inspired by:

- The need for better scheduling tools in retail
- Modern authentication patterns
- The potential of AI to assist (not replace) human decision-making
- The open-source philosophy of transparency and collaboration

## Contact & Support

### Getting Help

- 📖 [Documentation](https://jango-blockchained.github.io/schichtplan)
- 💬 [GitHub Discussions](https://github.com/jango-blockchained/schichtplan/discussions)
- 🐛 [Issue Tracker](https://github.com/jango-blockchained/schichtplan/issues)

### Stay Updated

- ⭐ [Star on GitHub](https://github.com/jango-blockchained/schichtplan)
- 👀 [Watch for releases](https://github.com/jango-blockchained/schichtplan/releases)
- 🔔 [Follow discussions](https://github.com/jango-blockchained/schichtplan/discussions)

## License

Schichtplan is released under the **MIT License**. This means:

- ✅ Free to use for commercial and non-commercial purposes
- ✅ Free to modify and distribute
- ✅ No warranty or liability
- ✅ Must include license and copyright notice

See the [full license text](license.md) for details.

---

Thank you for being part of the Schichtplan community! 🎉
