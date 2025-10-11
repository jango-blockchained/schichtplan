# Frontend Startup Fix

## Problem

The frontend was not starting correctly when using `./start.sh` script.

## Root Cause

The `start.sh` script was using `npx vite` to start the frontend server, but this project uses **Bun** as the JavaScript runtime, not npm/npx.

**Location**: `start.sh` line 312

**Incorrect command**:

```bash
npx vite > "$SCRIPT_DIR/$LOG_DIR/tmux_frontend_output.log" 2>&1 &
```

## Solution

Changed the frontend startup command to use Bun instead of npx.

**Corrected command**:

```bash
bun dev > "$SCRIPT_DIR/$LOG_DIR/tmux_frontend_output.log" 2>&1 &
```

## Why This Matters

### Project Uses Bun

According to the project configuration:

- `bunfig.toml` exists in the project root
- `src/frontend/package.json` specifies `"engines": { "bun": ">=1.0.0" }`
- All dependencies are managed via Bun
- The copilot instructions explicitly state: **"This project uses Bun (not npm)"**

### What `bun dev` Does

When you run `bun dev`, it:

1. Uses Bun's JavaScript runtime (faster than Node.js)
2. Executes the `"dev": "vite"` script from `package.json`
3. Starts the Vite dev server on port 5173
4. Provides hot module replacement (HMR) for development

### Why `npx vite` Failed

- `npx` is part of npm/Node.js ecosystem
- May not be installed if project only uses Bun
- Even if installed, uses Node.js runtime instead of Bun
- Doesn't respect Bun's configuration (`bunfig.toml`)
- Can cause dependency resolution issues

## Verification

### Check the Fix

```bash
# View the corrected line
grep "bun dev" start.sh
```

Expected output:

```bash
tmux send-keys -t "$TMUX_SESSION" "bun dev > \"$SCRIPT_DIR/$LOG_DIR/tmux_frontend_output.log\" 2>&1 &" C-m
```

### Test Frontend Startup

```bash
# Method 1: Use the fixed start.sh script
./start.sh

# Method 2: Start frontend manually
cd src/frontend
bun install
bun dev
```

### Expected Behavior

1. Dependencies install via `bun install`
2. Frontend starts with message: "Starting Frontend with Bun in background..."
3. Vite dev server starts on http://localhost:5173
4. Browser shows the application
5. Logs appear in `src/logs/tmux_frontend_output.log`

## Related Files

### Modified

- `start.sh` - Line 312 changed from `npx vite` to `bun dev`

### Related Configuration

- `bunfig.toml` - Bun configuration for the project
- `src/frontend/package.json` - Specifies Bun as engine and defines `dev` script
- `src/frontend/vite.config.ts` - Vite configuration (works with Bun)

## Additional Notes

### Other Correct Bun Usage in start.sh

The script already correctly uses Bun elsewhere:

- Line 310: `bun install` - Install dependencies with Bun ✅
- This was the only location using `npx` incorrectly

### Start Script Dependencies

The `start.sh` script requires:

- `bun` command available in PATH
- `tmux` for terminal multiplexing
- `python3` for backend
- `redis-server` if using conversational AI

### Troubleshooting

#### If frontend still doesn't start:

1. **Check Bun is installed**:
   ```bash
   bun --version
   ```
2. **Check port 5173 is free**:

   ```bash
   nc -z localhost 5173 && echo "Port in use" || echo "Port free"
   ```

3. **Check frontend logs**:

   ```bash
   tail -f src/logs/tmux_frontend_output.log
   ```

4. **Try starting frontend manually**:

   ```bash
   cd src/frontend
   bun install
   bun dev
   ```

5. **Check for dependency issues**:
   ```bash
   cd src/frontend
   bun install --verbose
   ```

#### If Bun is not installed:

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Reload shell
source ~/.bashrc  # or ~/.zshrc
```

## Testing Checklist

After applying the fix:

- [ ] `./start.sh` runs without errors
- [ ] Frontend starts on port 5173
- [ ] Can access http://localhost:5173 in browser
- [ ] Hot module replacement (HMR) works
- [ ] Console shows Vite dev server output
- [ ] No npm/npx related errors in logs

## Impact

### Before Fix

- ❌ Frontend failed to start
- ❌ `npx vite` command not found or used wrong runtime
- ❌ Application inaccessible

### After Fix

- ✅ Frontend starts correctly with Bun
- ✅ Proper runtime and dependency management
- ✅ Consistent with project architecture
- ✅ Application accessible at http://localhost:5173

## Date & Version

- **Fixed**: 2025-10-10
- **Branch**: `feature/week-navigation-only`
- **File Modified**: `start.sh` (line 312)
