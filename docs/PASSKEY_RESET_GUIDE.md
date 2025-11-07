# Admin Passkey Reset Guide

This document describes all available methods to reset the admin passkey in Schichtplan when access is lost.

## Three Methods to Reset Admin Passkey

### Method 1: Via Settings UI (Easiest)

**When to use:** When you can still access the application

**Steps:**

1. Log in to Schichtplan (if possible)
2. Go to **Settings** → **Data Management**
3. Find the **"Authentication Management"** section
4. Click **"Reset Admin Passkey"** button
5. Confirm in the dialog
6. Copy or download the recovery codes
7. Use recovery codes to log in if needed

**Pros:**

- Easiest method
- No command line required
- Generates codes immediately
- UI displays codes nicely

**Cons:**

- Requires being able to access the UI
- Only works if you can still navigate

---

### Method 2: CLI Tool (Most Flexible)

**When to use:** When you have server access but can't access the web UI

**Command:**

```bash
cd /path/to/schichtplan
python src/backend/tools/reset_admin_passkey.py
```

**With options:**

```bash
# Force reset without confirmation (useful for automation)
python src/backend/tools/reset_admin_passkey.py --force

# Force reset and save recovery codes to file
python src/backend/tools/reset_admin_passkey.py --force --save recovery_codes.txt
```

**Output:**

```
✅ Admin passkey reset successfully!

Recovery Codes (save these in a secure place):
--------------------------------------------------
  1. ABC123DEF456...
  2. GHI789JKL012...
  3. MNO345PQR678...
  4. STU901VWX234...
--------------------------------------------------

Username: admin
Email: admin@example.com

You can now log in using:
  • A recovery code (each code can only be used once)
  • Then re-register a new passkey
```

**Pros:**

- Works directly from server
- Can be automated/scheduled
- Can save codes to file
- No UI dependency

**Cons:**

- Requires SSH/terminal access to server
- Requires understanding of command line

---

### Method 3: Token-Based Reset (Emergency/Offline)

**When to use:** Complete access loss or for pre-generating emergency tokens

#### Step 1: Generate Reset Token

Call the token generation endpoint:

```bash
curl -X POST http://localhost:5000/api/v2/setup/reset-token \
  -H "Content-Type: application/json"
```

**Response:**

```json
{
  "message": "Reset token generated successfully",
  "token_file": "/path/to/instance/reset_tokens/reset_token_ABC123...txt",
  "instructions": "A reset token file has been created..."
}
```

The token is saved in: `instance/reset_tokens/reset_token_<token>.txt`

#### Step 2a: Reset via CLI with Token

```bash
python src/backend/tools/reset_admin_passkey.py --force
```

#### Step 2b: Reset via API with Token

```bash
curl -X POST http://localhost:5000/api/v2/setup/reset-with-token \
  -H "Content-Type: application/json" \
  -d '{
    "reset_token": "YOUR_TOKEN_HERE"
  }'
```

**Response:**

```json
{
  "message": "Admin passkey has been reset...",
  "recovery_codes": ["CODE1", "CODE2", "CODE3", "CODE4"]
}
```

**Pros:**

- Can be pre-generated and stored securely
- Works offline (token is local file)
- One-time use (token consumed after reset)
- Flexible - use via CLI or API

**Cons:**

- More steps
- Requires secure token storage

---

## Recovery Codes

After resetting the passkey, you'll receive **4 recovery codes**:

- Each code is a 12-character alphanumeric string
- Each code can be used **once** for login
- After using a code, remaining count decreases
- Save them in a secure location (password manager, encrypted file, etc.)

**Login with recovery code:**

1. Go to login page
2. Select "Recovery Code" tab
3. Enter username and recovery code
4. Click "Sign in with Recovery Code"
5. You'll then be able to register a new passkey

---

## Security Best Practices

1. **Before You Need It:**

   - Generate and save a reset token regularly
   - Store recovery codes in a secure location
   - Consider backing up `instance/reset_tokens/` directory

2. **When Resetting:**

   - Use the most restrictive method available
   - Verify reset was successful
   - Immediately re-register a new passkey
   - Review account activity logs if available

3. **After Resetting:**
   - Update any stored recovery codes
   - Regenerate tokens if they might be compromised
   - Delete old recovery codes
   - Audit any recent access attempts

---

## Troubleshooting

### "No admin user exists"

- The database might be corrupted or empty
- Check database with: `python check_database_entities.py`
- May need to restore from backup

### "Reset token not found"

- Token file may have been deleted
- Generate a new token with Method 3 Step 1
- Check that `instance/reset_tokens/` directory exists

### "Cannot connect to API"

- Verify backend is running: `curl http://localhost:5000/api/v2/setup/status`
- Check backend logs in `instance/logs/app.log`
- Verify port number (default: 5000)

### Recovery codes not working

- Each code can only be used once
- Check count with: `Settings → Data Management → Authentication Management`
- Generate new codes if all are exhausted

---

## Emergency Procedures

### Complete Access Loss Scenario

1. **SSH to server** (if available)

   ```bash
   cd /path/to/schichtplan
   python src/backend/tools/reset_admin_passkey.py --force
   ```

2. **Or via Docker:**

   ```bash
   docker exec schichtplan-backend python src/backend/tools/reset_admin_passkey.py --force
   ```

3. **Or use pre-generated token:**

   - Retrieve token from `instance/reset_tokens/` directory
   - Use Method 3 to reset

4. **Or restore from backup:**
   - If you have a recent backup before losing passkey
   - Restore and re-register a new passkey

---

## File Locations

- **CLI Tool:** `src/backend/tools/reset_admin_passkey.py`
- **Reset Tokens:** `instance/reset_tokens/`
- **Backup Tokens:** Consider backing up this directory
- **Logs:** `instance/logs/app.log` (contains reset events)

---

## API Reference

### Reset via UI

- **Endpoint:** Internal (handled by frontend)
- **Method:** POST
- **URL:** `/api/v2/setup/reset-admin-passkey`
- **Body:** (empty)
- **Auth:** Not required (for emergency)

### Generate Reset Token

- **Endpoint:** `/api/v2/setup/reset-token`
- **Method:** POST
- **Body:** (empty)
- **Response:** Token file path and instructions

### Reset with Token

- **Endpoint:** `/api/v2/setup/reset-with-token`
- **Method:** POST
- **Body:** `{"reset_token": "token_string"}`
- **Response:** Recovery codes

---

## Questions?

Refer to:

- `SETUP_AND_AUTHENTICATION_GUIDE.md` - Complete setup documentation
- `src/backend/utils/logger.py` - View logs for debugging
- `instance/logs/app.log` - Application log file
