# Authentication System - Quick Test Guide

## System Overview

The passkey authentication system has been fully implemented with UI polish and multiple reset methods. Below is a quick reference for testing and deployment.

## Setup Flow (First Time)

### Steps:

1. **Welcome Screen** → Setup info and features displayed
2. **Passkey Registration** → Create WebAuthn credential with your device
3. **Recovery Codes** → Save 4 single-use emergency codes
4. **AI Configuration (Optional)** → Configure AI provider keys
5. **Completion** → Redirect to main application

### Testing Setup:

```bash
# Access setup wizard
http://localhost:5173/setup

# No database reset needed - system auto-detects incomplete setup
```

## Login Flow

### Methods:

#### Method 1: Passkey Login (Primary)

1. Enter username: `admin`
2. Click "Sign in with Passkey"
3. Authenticate with device (fingerprint, face, security key, etc.)

**Testing:**

```bash
http://localhost:5173/login
# Tab: Passkey
# Enter: admin
# Click: Sign in with Passkey
```

#### Method 2: Recovery Code Login (Emergency)

1. Enter username: `admin`
2. Enter any saved recovery code in format: `XXXX-XXXX-XXXX-XXXX`
3. Click "Sign in with Recovery Code"
4. Each code is single-use

**Testing:**

```bash
http://localhost:5173/login
# Tab: Recovery Code
# Enter username: admin
# Enter code: (from setup wizard)
# Click: Sign in with Recovery Code
```

## Admin Reset Methods

### Method 1: UI-Based Reset (Settings)

**Location:** Settings → Security → Reset Passkey

**Steps:**

1. Click "Reset Passkey"
2. Confirm action
3. Generates new recovery codes
4. Re-run setup wizard

**Testing:**

```bash
http://localhost:5173/settings
# Find: Security Section
# Click: Reset Passkey Button
```

### Method 2: CLI Reset (Emergency)

**Command:**

```bash
cd /home/jango/Git/maike2/schichtplan
python src/backend/tools/passkey_reset.py
```

**Output:**

- Generates 4 new recovery codes
- Saves to file: `recovery_codes_YYYY-MM-DD.txt`
- Displays on console

### Method 3: Token-Based Reset (API)

**Endpoint:** `POST /api/passkey/emergency-reset/{token}`

**Steps:**

1. Generate reset token (CLI or admin panel)
2. Use token to trigger reset
3. Receive new recovery codes
4. Re-run setup wizard

**Testing:**

```bash
# Get reset token (from CLI tool output)
curl -X POST http://localhost:5000/api/passkey/emergency-reset/TOKEN_HERE
```

## Database & Recovery

### Demo Data

```bash
# Generate fresh demo data with admin account
python src/backend/tools/data_generators/update_demo_data.py
```

### Reset Everything (DESTRUCTIVE)

```bash
# WARNING: This deletes all data
python src/backend/tools/rebuild_db.py
```

### Check Database Status

```bash
python check_database_entities.py
```

## Authentication Flow Diagrams

### Registration Flow

```
Setup Wizard
    ↓
Welcome → Passkey → Recovery Codes → AI Config → Complete
    ↓
registerPasskey() API call
    ↓
Backend: Create WebAuthn credential
    ↓
Backend: Generate 4 recovery codes (hashed)
    ↓
Frontend: Display codes + download option
    ↓
User saves codes securely
    ↓
completeSetup() called
    ↓
Redirect to main app
```

### Login Flow

```
Login Page
    ↓
Passkey Tab ←→ Recovery Tab
    ↓
Enter Username
    ↓
Choice 1: loginWithPasskey()     Choice 2: verifyRecoveryCode()
    ↓                                    ↓
WebAuthn challenge/response       Recovery code verification
    ↓                                    ↓
Backend credential verification   Backend recovery code check
    ↓                                    ↓
Generate JWT token                Mark code as used
    ↓                                    ↓
Set auth_token in localStorage    Set auth_token in localStorage
    ↓                                    ↓
Navigate to main app              Navigate to main app
```

## API Endpoints Reference

### Setup Endpoints

- `POST /api/setup/check-status` - Check if setup needed
- `POST /api/setup/register-passkey` - Register WebAuthn credential
- `POST /api/setup/complete` - Mark setup complete

### Login Endpoints

- `POST /api/passkey/init-login` - Get WebAuthn challenge
- `POST /api/passkey/verify` - Verify WebAuthn response
- `POST /api/passkey/verify-recovery-code` - Verify recovery code

### Reset Endpoints

- `POST /api/passkey/reset` - Reset passkey (requires auth)
- `POST /api/passkey/emergency-reset/{token}` - Emergency reset with token

## Frontend Components

### SetupWizard.tsx

- **Path:** `src/frontend/src/pages/SetupWizard.tsx`
- **Features:** 4-step wizard with gradient UI
- **Styling:** Emoji icons, color-coded cards, animations
- **Dark Mode:** Full support

### LoginPage.tsx

- **Path:** `src/frontend/src/pages/LoginPage.tsx`
- **Features:** Tab-based dual authentication
- **Styling:** Gradient header, color-coded tabs, responsive
- **Dark Mode:** Full support

### OverviewPage.tsx

- **Path:** `src/frontend/src/pages/OverviewPage.tsx`
- **Features:** Dashboard with stats and quick links
- **Shows:** After successful login

## Backend Components

### Passkey Auth Routes

- **Path:** `src/backend/routes/passkey_auth.py`
- **Features:** WebAuthn credential verification
- **Fixed Issues:** Credential parsing, transport conversion

### Setup Routes

- **Path:** `src/backend/routes/setup.py`
- **Features:** Registration and setup completion
- **Fixed Issues:** Recovery code generation, credential handling

### User Model

- **Path:** `src/backend/models/user.py`
- **Features:** Role management, permission handling
- **Fixed Issues:** Role enum/string mismatch

## Common Issues & Solutions

### Issue: "Credential parsing failed"

**Cause:** WebAuthn library version mismatch
**Solution:** Ensure webauthn v2.0+ installed

```bash
pip show webauthn
```

### Issue: "Transport type error"

**Cause:** Transport conversion not working
**Solution:** Check transports are converted to AuthenticatorTransport enum

### Issue: Recovery codes not saving

**Cause:** Database column missing
**Solution:** Run migrations

```bash
flask db upgrade
```

### Issue: Login redirects to setup

**Cause:** auth_token not in localStorage or setup_completed flag incorrect
**Solution:** Check localStorage after login, verify database setup_completed flag

## Verification Checklist

- [ ] Setup wizard loads (no errors)
- [ ] Can complete setup with device auth
- [ ] Recovery codes download properly
- [ ] Recovery codes contain valid format (XXXX-XXXX-XXXX-XXXX)
- [ ] Can login with passkey
- [ ] Can login with recovery code
- [ ] Recovery code is single-use
- [ ] UI looks good in both light and dark modes
- [ ] All buttons are responsive
- [ ] Error messages are clear
- [ ] Loading states show properly

## Testing Devices

### Desktop

- Chrome/Chromium (built-in authenticator)
- Firefox (with built-in authenticator)
- Safari (with iCloud Keychain)

### Mobile

- iOS: Safari with Face ID/Touch ID
- Android: Chrome with fingerprint sensor

## Performance Notes

- Passkey registration: ~2-5 seconds
- Passkey login: ~3-8 seconds
- Recovery code verification: ~1-2 seconds
- All operations include timeouts

## Security Notes

- Recovery codes are hashed using bcrypt before storage
- Each recovery code is single-use
- WebAuthn credentials use Ed25519 by default
- All sensitive operations logged to security audit trail
- HTTPS recommended for production

## Support Resources

- WebAuthn Standard: https://www.w3.org/TR/webauthn-2/
- SimpleWebAuthn Library: https://simplewebauthn.dev/
- Project Docs: See `docs/` directory
