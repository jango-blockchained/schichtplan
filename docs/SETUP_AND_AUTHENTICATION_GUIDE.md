# Setup Flow and Authentication Guide

## Overview

Schichtplan includes a secure first-time setup wizard that establishes admin authentication using passkeys (WebAuthn) and provides recovery codes as a backup authentication method.

## Features

- **Passkey Authentication**: Password-less authentication using biometrics, security keys, or device PIN
- **Recovery Codes**: 4 single-use recovery codes for backup access
- **AI API Configuration**: Optional setup of AI providers (Gemini, OpenAI, Anthropic)
- **Daily Login Requirement**: Admin must authenticate once per day for security

## Setup Flow

### Step 1: Initial Check

On first launch, the application checks if setup is completed:
- Checks for existing admin user
- Checks `initial_setup_completed` flag in settings
- Redirects to setup wizard if needed

### Step 2: Welcome Screen

The setup wizard presents an overview of the process:
- Secure passkey authentication
- Recovery codes for backup
- Optional AI configuration

### Step 3: Passkey Registration

Admin creates a passkey using WebAuthn:

1. Enter email address (username is pre-set to "admin")
2. Click "Create Passkey"
3. Browser prompts for device authentication:
   - Fingerprint sensor
   - Face recognition
   - Security key
   - Device PIN

**Technical Details:**
- Uses SimpleWebAuthn library for browser integration
- Credentials are stored securely in the database (encrypted)
- RP ID configured via `WEBAUTHN_RP_ID` environment variable

### Step 4: Recovery Codes

After successful passkey creation, 4 recovery codes are generated:

- **Format**: 12-character alphanumeric codes
- **Usage**: Each code can only be used once
- **Storage**: Hashed in database (bcrypt)
- **Display**: Shown once, must be saved immediately

**Important**: Users should:
1. Write down all 4 codes on paper
2. Store them in a secure location
3. Download the text file as backup
4. Confirm they've saved the codes before continuing

### Step 5: AI Configuration (Optional)

Configure AI providers for advanced features:

- **Gemini API Key**: Google's AI service
- **OpenAI API Key**: GPT models
- **Anthropic API Key**: Claude models

This step can be skipped and configured later in Settings.

### Step 6: Completion

Setup is marked complete:
- User's `setup_completed` flag is set to `true`
- Settings `initial_setup_completed` is set to `true`
- User is redirected to login page

## Authentication Methods

### Primary: Passkey Login

1. Navigate to `/login`
2. Enter username
3. Click "Sign in with Passkey"
4. Authenticate with device biometrics/PIN

**Technical Flow:**
```
Client → /api/v2/auth/passkey/init-login → Server
       ← Authentication options ←

Client → Browser WebAuthn API
       ← Signed assertion ←

Client → /api/v2/auth/passkey/complete-login → Server
       ← JWT token ←
```

### Backup: Recovery Code Login

Use when passkey is unavailable (device lost, etc.):

1. Navigate to `/login`
2. Switch to "Recovery Code" tab
3. Enter username and recovery code
4. System verifies and invalidates the used code

**Note**: After using a recovery code, the remaining count decreases. Generate new codes when running low.

## Security Features

### Passkey Security

- **Device-bound**: Credentials never leave the user's device
- **Phishing-resistant**: Domain-bound, can't be used on fake sites
- **No password**: Nothing to steal or leak

### Recovery Code Security

- **Hashed Storage**: Codes are bcrypt-hashed in database
- **Single-use**: Each code can only be used once
- **Limited quantity**: Only 4 codes, forcing users to be careful

### Session Management

- **JWT Tokens**: 24-hour expiration by default
- **Daily Login**: Users must re-authenticate once per day
- **Token Storage**: Stored in localStorage
- **Logout**: Clears token and redirects to login

## API Endpoints

### Setup Endpoints

- `GET /api/v2/setup/status` - Check if setup is complete
- `POST /api/v2/setup/init-passkey` - Initialize passkey registration
- `POST /api/v2/setup/complete-passkey` - Complete registration with credential
- `POST /api/v2/setup/configure-ai` - Save AI API keys
- `POST /api/v2/setup/complete` - Mark setup as complete
- `POST /api/v2/setup/recovery-code/verify` - Verify a recovery code

### Authentication Endpoints

- `POST /api/v2/auth/passkey/init-login` - Initialize passkey login
- `POST /api/v2/auth/passkey/complete-login` - Complete login with assertion
- `GET /api/v2/auth/passkey/check-daily-login` - Check if daily login needed

## Configuration

### Environment Variables

```bash
# Backend (.env)
WEBAUTHN_RP_ID=localhost                    # Your domain (production: app.example.com)
WEBAUTHN_RP_NAME=Schichtplan               # Display name for passkeys
WEBAUTHN_ORIGIN=http://localhost:5173      # Frontend URL
SECRET_KEY=your-secret-key-here            # JWT signing key
```

### Frontend (.env)

```bash
VITE_API_URL=http://localhost:5000         # Backend API URL
```

## Database Schema

### User Model Additions

```python
webauthn_credentials = Column(Text, nullable=True)  # JSON array of credentials
recovery_codes = Column(Text, nullable=True)        # JSON array of hashed codes
setup_completed = Column(Boolean, default=False)    # User setup flag
```

### Settings Model Additions

```python
initial_setup_completed = Column(Boolean, default=False)  # Global setup flag
```

## Troubleshooting

### Passkey Registration Fails

**Problem**: Browser doesn't prompt for authentication
- Check that site is accessed via HTTPS (or localhost)
- Verify browser supports WebAuthn
- Check browser console for errors

### Recovery Code Not Working

**Problem**: "Invalid recovery code" error
- Verify code is typed correctly (case-sensitive)
- Check if code was already used
- Ensure username is correct

### Setup Stuck in Loop

**Problem**: Setup wizard keeps appearing
- Check database for admin user
- Verify `initial_setup_completed` in settings table
- Check browser console for API errors

### Daily Login Required

**Problem**: App keeps asking to login
- This is expected behavior (once per day)
- Check `last_login` timestamp in database
- Verify JWT token is being stored in localStorage

## Development

### Testing Setup Flow

1. Delete the database: `rm instance/app.db`
2. Restart backend: `./start.sh`
3. Open frontend: `http://localhost:5173`
4. Should redirect to `/setup`

### Testing Login Flow

1. Complete setup first
2. Clear localStorage: `localStorage.removeItem('auth_token')`
3. Reload page
4. Should redirect to `/login`

### Simulating WebAuthn

For testing without a physical device, use a virtual authenticator:

**Chrome DevTools:**
1. Open DevTools
2. Settings → More tools → WebAuthn
3. Enable virtual authenticator environment
4. Add virtual authenticator

## Migration Guide

### From Existing Setup

If you already have users in the system:

1. **Create Admin User**: First admin user is created during setup
2. **Existing Users**: Add migration to mark existing users as `setup_completed=False`
3. **Force Setup**: Existing admins must complete setup on next login

### Production Deployment

1. **HTTPS Required**: WebAuthn requires HTTPS in production
2. **Update RP_ID**: Set to your actual domain
3. **Update Origins**: Set to your production frontend URL
4. **Backup Codes**: Store recovery codes securely (physical paper)
5. **Monitor Usage**: Track remaining recovery codes

## Best Practices

1. **Recovery Codes**:
   - Print and store physically
   - Keep in secure location (safe, locked drawer)
   - Never share or transmit electronically
   - Generate new ones before running out

2. **Passkeys**:
   - Register multiple devices if possible
   - Use security keys for highest security
   - Keep backup device registered

3. **Daily Login**:
   - Keep passkey device accessible
   - Store recovery codes for emergencies
   - Set up multiple authentication methods

## Future Enhancements

- Multiple admin users
- Passkey management (add/remove devices)
- Recovery code regeneration
- Two-factor authentication options
- Audit log for authentication events
- Session management dashboard

## References

- [WebAuthn Specification](https://www.w3.org/TR/webauthn/)
- [SimpleWebAuthn Documentation](https://simplewebauthn.dev/)
- [FIDO Alliance](https://fidoalliance.org/)
