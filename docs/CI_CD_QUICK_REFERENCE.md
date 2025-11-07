# CI/CD Quick Reference

## GitHub Actions Workflows

### CI Workflow (Tests & Linting)
**File:** `.github/workflows/ci.yml`

```bash
# Triggered automatically on:
- Push to main, develop, feature/** branches
- Pull requests to main, develop
```

**What it does:**
- ✅ Tests backend (Python/Flask)
- ✅ Tests frontend (TypeScript/React)
- ✅ Lints code (Black, Flake8, ESLint)
- ✅ Type checks TypeScript
- ✅ Uploads coverage to Codecov

### Docker Build Workflow
**File:** `.github/workflows/docker-build.yml`

```bash
# Triggered automatically on:
- Push to main, develop branches
- Version tags (v*)
- Pull requests to main, develop
```

**What it does:**
- 🐳 Builds Docker images for backend, frontend, and MCP
- 🏗️ Multi-arch builds (amd64, arm64)
- 📦 Pushes to GitHub Container Registry
- ✅ Tests docker-compose configuration on PRs

**Image locations:**
```
ghcr.io/{owner}/schichtplan-backend:main
ghcr.io/{owner}/schichtplan-frontend:main
ghcr.io/{owner}/schichtplan-mcp:main
```

### Electron Build Workflow
**File:** `.github/workflows/electron-build.yml`

```bash
# Triggered automatically on:
- Push to main branch
- Version tags (v*)
- Pull requests to main
```

**What it does:**
- 🖥️ Builds desktop apps for Windows, macOS, Linux
- 📦 Creates installers (DMG, EXE, AppImage, DEB, RPM)
- 🚀 Publishes releases for version tags
- 📤 Uploads artifacts (7-day retention)

## Manual Triggers

All workflows can be triggered manually:

1. Go to **Actions** tab in GitHub
2. Select workflow (CI, Docker Build, or Electron Build)
3. Click **Run workflow**
4. Select branch
5. Click **Run workflow** button

## Local Commands

### Testing
```bash
# Backend tests
pytest tests/backend/ -v

# Frontend tests
cd src/frontend && bun test

# All tests
npm test
```

### Linting
```bash
# Backend linting
black --check .
flake8 src/backend

# Frontend linting
cd src/frontend && bun run lint

# All linting
npm run lint
```

### Building

#### Frontend Build
```bash
cd src/frontend
bun run build
```

#### Docker Build
```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build backend
docker-compose build frontend
docker-compose build mcp-server
```

#### Electron Build
```bash
# Build for current platform
npm run electron:build

# Build for specific platform
npm run electron:build:mac
npm run electron:build:win
npm run electron:build:linux
```

## Creating a Release

### For Electron Desktop App

1. Update version in `package.json`:
   ```json
   {
     "version": "1.2.3"
   }
   ```

2. Commit and push:
   ```bash
   git add package.json
   git commit -m "Bump version to 1.2.3"
   git push
   ```

3. Create and push tag:
   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

4. GitHub Actions will:
   - Build for Windows, macOS, Linux
   - Create GitHub Release
   - Upload installers

### For Docker Images

Images are automatically built and tagged:

```bash
# Latest on main branch
ghcr.io/{owner}/schichtplan-backend:main

# Specific version
ghcr.io/{owner}/schichtplan-backend:v1.2.3

# Specific commit
ghcr.io/{owner}/schichtplan-backend:sha-abc123
```

## Troubleshooting

### CI Fails
```bash
# Run locally to reproduce
npm test
npm run lint
cd src/frontend && bun run typecheck
```

### Docker Build Fails
```bash
# Test locally
docker-compose build
docker-compose up -d
docker-compose logs
```

### Electron Build Fails
```bash
# Test locally
npm install
cd src/frontend && bun install
npm run build:frontend
npm run electron:build
```

### Common Issues

1. **Tests fail**: Check Python/Node versions match CI
2. **Lint errors**: Run `black .` and `bun run lint:fix`
3. **Type errors**: Run `cd src/frontend && bun run typecheck`
4. **Build errors**: Clear caches with `npm run cache:clear`

## Workflow Status Badges

Add to README.md:

```markdown
![CI](https://github.com/{owner}/{repo}/workflows/CI/badge.svg)
![Docker Build](https://github.com/{owner}/{repo}/workflows/Docker%20Build/badge.svg)
![Electron Build](https://github.com/{owner}/{repo}/workflows/Electron%20Build/badge.svg)
```

## Resources

- 📚 [Full CI/CD Documentation](./CI_CD_SETUP.md)
- 🔧 [GitHub Actions Docs](https://docs.github.com/en/actions)
- 🐳 [Docker Docs](https://docs.docker.com/)
- ⚡ [Electron Builder Docs](https://www.electron.build/)
