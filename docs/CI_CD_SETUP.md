# CI/CD Setup Documentation

This document describes the Continuous Integration and Continuous Deployment (CI/CD) setup for the Schichtplan project.

## Overview

The project uses GitHub Actions for CI/CD with three main workflows:

1. **CI Workflow** (`ci.yml`) - Runs tests and linting on every push and pull request
2. **Docker Build** (`docker-build.yml`) - Builds and publishes Docker images
3. **Electron Build** (`electron-build.yml`) - Builds desktop applications for Windows, macOS, and Linux

## Workflows

### 1. CI Workflow

**File:** `.github/workflows/ci.yml`

**Triggers:**
- Push to `main`, `develop`, or `feature/**` branches
- Pull requests to `main` or `develop`
- Manual workflow dispatch

**Jobs:**

#### Backend Tests
- Sets up Python 3.12
- Installs dependencies from `requirements.txt`
- Runs linting with Black and Flake8
- Executes pytest with coverage reporting
- Uploads coverage to Codecov

#### Frontend Tests
- Sets up Bun runtime
- Installs frontend dependencies
- Runs ESLint for code quality
- Performs TypeScript type checking
- Executes Bun tests
- Builds the frontend with Vite

### 2. Docker Build Workflow

**File:** `.github/workflows/docker-build.yml`

**Triggers:**
- Push to `main` or `develop` branches
- Push of version tags (`v*`)
- Pull requests to `main` or `develop`
- Manual workflow dispatch

**Jobs:**

#### Build and Test
- Builds Docker images for three services:
  - Backend (Flask API)
  - Frontend (React/Vite)
  - MCP Server (AI integration)
- Uses Docker Buildx for multi-platform builds (amd64, arm64)
- Pushes images to GitHub Container Registry (ghcr.io)
- Tags images with branch name, PR number, semver, and commit SHA

#### Test Docker Compose
- Runs on pull requests only
- Tests the docker-compose.yml configuration
- Starts PostgreSQL and Redis services
- Verifies service health

**Image Tags:**
- `ghcr.io/{owner}/{repo}-backend:main` - Latest backend on main branch
- `ghcr.io/{owner}/{repo}-frontend:v1.2.3` - Specific version
- `ghcr.io/{owner}/{repo}-mcp:sha-abc123` - Specific commit

### 3. Electron Build Workflow

**File:** `.github/workflows/electron-build.yml`

**Triggers:**
- Push to `main` branch
- Push of version tags (`v*`)
- Pull requests to `main`
- Manual workflow dispatch

**Jobs:**

#### Build
- Builds desktop applications for three platforms:
  - **macOS** - DMG and ZIP (x64 and arm64)
  - **Windows** - NSIS installer and portable EXE
  - **Linux** - AppImage, DEB, and RPM packages
- Uses electron-builder for packaging
- Uploads build artifacts with 7-day retention

#### Release
- Runs only when a version tag is pushed (e.g., `v1.0.0`)
- Downloads all platform artifacts
- Creates a GitHub Release
- Attaches all installers to the release
- Generates release notes automatically

**Build Outputs:**
- macOS: `Schichtplan-1.0.0.dmg`, `Schichtplan-1.0.0-mac.zip`
- Windows: `Schichtplan Setup 1.0.0.exe`, `Schichtplan 1.0.0.exe` (portable)
- Linux: `Schichtplan-1.0.0.AppImage`, `schichtplan_1.0.0_amd64.deb`, `schichtplan-1.0.0.x86_64.rpm`

## Electron Configuration

### Files Structure
```
schichtplan/
├── electron/
│   ├── main.js           # Main Electron process
│   ├── preload.js        # Preload script for security
│   └── resources/        # Application icons
│       ├── icon.icns     # macOS icon
│       ├── icon.ico      # Windows icon
│       └── icon.png      # Linux icon
├── electron-builder.json # Build configuration
└── package.json          # Updated with Electron scripts
```

### Package.json Scripts

```json
{
  "electron:dev": "NODE_ENV=development electron .",
  "electron:build": "npm run build:frontend && electron-builder",
  "electron:build:mac": "npm run build:frontend && electron-builder --mac",
  "electron:build:win": "npm run build:frontend && electron-builder --win",
  "electron:build:linux": "npm run build:frontend && electron-builder --linux"
}
```

### Local Development

#### Running Electron in Development
```bash
# Terminal 1: Start the Vite dev server
cd src/frontend
bun run dev

# Terminal 2: Start Electron
npm run electron:dev
```

#### Building Electron Locally
```bash
# Build for current platform
npm run electron:build

# Build for specific platform
npm run electron:build:mac
npm run electron:build:win
npm run electron:build:linux
```

## Docker Configuration

### Available Images

All images are built for both `linux/amd64` and `linux/arm64` architectures.

#### Backend Image
- **Base:** Python 3.12
- **Includes:** Flask, SQLAlchemy, Gunicorn
- **Ports:** 5000
- **Dockerfile:** `Dockerfile.backend`

#### Frontend Image
- **Base:** Node with Bun
- **Includes:** React, Vite, Tailwind CSS
- **Ports:** 5173
- **Dockerfile:** `src/frontend/Dockerfile`

#### MCP Server Image
- **Base:** Python 3.12
- **Includes:** FastMCP, AI integration tools
- **Ports:** 8001
- **Dockerfile:** `Dockerfile.mcp`

### Using Docker Images

#### Pull from GitHub Container Registry
```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull images
docker pull ghcr.io/{owner}/schichtplan-backend:main
docker pull ghcr.io/{owner}/schichtplan-frontend:main
docker pull ghcr.io/{owner}/schichtplan-mcp:main
```

#### Using with Docker Compose
```bash
# Use images from registry
docker-compose pull
docker-compose up -d

# Or build locally
docker-compose build
docker-compose up -d
```

## Secrets and Configuration

### Required Secrets

Configure these in GitHub repository settings (Settings → Secrets and variables → Actions):

1. **GITHUB_TOKEN** - Automatically provided by GitHub Actions
2. **CODECOV_TOKEN** (Optional) - For uploading code coverage reports

### Optional Configuration

#### Code Signing (Electron)
For production releases, add code signing certificates:

**macOS:**
- `CSC_LINK` - Base64-encoded p12 certificate
- `CSC_KEY_PASSWORD` - Certificate password
- `APPLE_ID` - Apple ID for notarization
- `APPLE_ID_PASSWORD` - App-specific password

**Windows:**
- `CSC_LINK` - Base64-encoded PFX certificate
- `CSC_KEY_PASSWORD` - Certificate password

## Continuous Deployment

### Automated Releases

To create a release:

1. Update version in `package.json`
2. Commit changes
3. Create and push a version tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. GitHub Actions will:
   - Build all platforms
   - Run tests
   - Create a GitHub Release
   - Upload installers

### Docker Deployment

Docker images are automatically pushed on:
- Every commit to `main` or `develop`
- Every version tag

To deploy a specific version:
```bash
docker pull ghcr.io/{owner}/schichtplan-backend:v1.0.0
docker pull ghcr.io/{owner}/schichtplan-frontend:v1.0.0
docker pull ghcr.io/{owner}/schichtplan-mcp:v1.0.0
```

## Monitoring and Troubleshooting

### Viewing Workflow Runs

1. Go to the **Actions** tab in GitHub
2. Select the workflow (CI, Docker Build, or Electron Build)
3. Click on a specific run to view logs

### Common Issues

#### Electron Build Fails
- **Missing icons:** Add icon files to `electron/resources/`
- **Build timeout:** Increase timeout in workflow file
- **Code signing:** Check certificate configuration

#### Docker Build Fails
- **Context issues:** Verify Dockerfile paths in workflow
- **Multi-arch:** Ensure QEMU is available for arm64 builds
- **Push denied:** Check GitHub Container Registry permissions

#### CI Tests Fail
- **Backend tests:** Check Python version compatibility
- **Frontend tests:** Verify Bun installation
- **Flake8 errors:** Run `black .` to format code

### Debug Mode

Enable debug logging in workflows:
```yaml
- name: Enable debug
  run: echo "ACTIONS_STEP_DEBUG=true" >> $GITHUB_ENV
```

## Best Practices

1. **Test Locally First**
   - Run `npm test` before pushing
   - Build Docker images locally with `docker-compose build`
   - Test Electron builds with `npm run electron:build`

2. **Version Tags**
   - Use semantic versioning (v1.2.3)
   - Create tags only for stable releases
   - Document changes in release notes

3. **Branch Strategy**
   - Develop features in `feature/*` branches
   - Merge to `develop` for testing
   - Merge to `main` for production

4. **Resource Management**
   - Artifacts are kept for 7 days
   - Docker images are cached to speed up builds
   - Use `workflow_dispatch` for manual testing

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Buildx Multi-platform](https://docs.docker.com/build/building/multi-platform/)
- [Electron Builder](https://www.electron.build/)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

## Support

For issues or questions:
1. Check workflow logs in GitHub Actions
2. Review this documentation
3. Open an issue in the repository
4. Contact the development team
