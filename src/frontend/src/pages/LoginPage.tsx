/**
 * LoginPage - Authentication with passkey or recovery code
 */
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { login as passwordLogin } from '@/services/authService';
import { loginWithPasskey, verifyRecoveryCode } from '@/services/setupService';
import { AlertCircle, AlertTriangle, KeyRound, Loader2, LockKeyhole, Shield } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handlePasswordLogin = async () => {
    if (!password.trim()) {
      toast({
        title: 'Password Required',
        description: 'Please enter your password',
        variant: 'destructive',
      });
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await passwordLogin({
        username: username.trim(),
        password: password.trim(),
      });

      toast({
        title: 'Login Successful',
        description: 'Welcome back!',
      });

      // Redirect to main app
      navigate('/');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setError(errorMessage);
      toast({
        title: 'Login Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      await loginWithPasskey(username);

      toast({
        title: 'Login Successful',
        description: 'Welcome back!',
      });

      // Redirect to main app
      navigate('/');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setError(errorMessage);
      toast({
        title: 'Login Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryCodeLogin = async () => {
    if (!recoveryCode.trim()) {
      toast({
        title: 'Recovery Code Required',
        description: 'Please enter your recovery code',
        variant: 'destructive',
      });
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await verifyRecoveryCode(username, recoveryCode.trim());

      toast({
        title: 'Login Successful',
        description: `Recovery code accepted. ${result.remaining_recovery_codes} codes remaining.`,
      });

      // Redirect to main app
      navigate('/');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid recovery code';
      setError(errorMessage);
      toast({
        title: 'Login Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/80 dark:from-primary/90 dark:to-primary/70 text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-white/20 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-2xl text-primary-foreground">Welcome Back</CardTitle>
              <CardDescription className="text-primary-foreground/80">
                Secure authentication to Schichtplan
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <Tabs defaultValue="password" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="password" className="gap-2">
                <LockKeyhole className="h-4 w-4" />
                Password
              </TabsTrigger>
              <TabsTrigger value="passkey" className="gap-2">
                <KeyRound className="h-4 w-4" />
                Passkey
              </TabsTrigger>
              <TabsTrigger value="recovery" className="gap-2">
                <Shield className="h-4 w-4" />
                Recovery
              </TabsTrigger>
            </TabsList>

            {/* Password Login */}
            <TabsContent value="password" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password-username" className="font-semibold">Username</Label>
                <Input
                  id="password-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  placeholder="admin"
                  className="h-10"
                  onKeyDown={(e) => e.key === 'Enter' && handlePasswordLogin()}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password-input" className="font-semibold">Password</Label>
                <Input
                  id="password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="Enter your password"
                  className="h-10"
                  onKeyDown={(e) => e.key === 'Enter' && handlePasswordLogin()}
                />
              </div>

              {error && (
                <Alert variant="destructive" className="border-destructive/30 bg-destructive/5 dark:bg-destructive/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handlePasswordLogin}
                className="w-full"
                size="lg"
                disabled={loading || !username.trim() || !password.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <LockKeyhole className="mr-2 h-4 w-4" />
                    Sign in with Password
                  </>
                )}
              </Button>
            </TabsContent>

            {/* Passkey Login */}
            <TabsContent value="passkey" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="passkey-username" className="font-semibold">Username</Label>
                <Input
                  id="passkey-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  placeholder="admin"
                  className="h-10"
                />
              </div>

              {error && (
                <Alert variant="destructive" className="border-destructive/30 bg-destructive/5 dark:bg-destructive/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Alert className="border-primary/30 bg-primary/5 dark:bg-primary/10">
                <KeyRound className="h-4 w-4 text-primary" />
                <AlertDescription className="text-foreground">
                  You'll be prompted to use your device's authentication—fingerprint, face recognition, or security key.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handlePasskeyLogin}
                className="w-full"
                size="lg"
                disabled={loading || !username.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Sign in with Passkey
                  </>
                )}
              </Button>
            </TabsContent>

            {/* Recovery Code Login */}
            <TabsContent value="recovery" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-username" className="font-semibold">Username</Label>
                <Input
                  id="recovery-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  placeholder="admin"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recovery-code" className="font-semibold">Recovery Code</Label>
                <Input
                  id="recovery-code"
                  type="text"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                  disabled={loading}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="h-10 font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Enter one of the recovery codes you saved during setup
                </p>
              </div>

              {error && (
                <Alert variant="destructive" className="border-destructive/30 bg-destructive/5 dark:bg-destructive/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Alert variant="destructive" className="border-destructive/30 bg-destructive/5 dark:bg-destructive/10">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-foreground">
                  <strong>⚠️ Important:</strong> Each recovery code can only be used once. Use this method only when you can't access your passkey.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleRecoveryCodeLogin}
                className="w-full"
                size="lg"
                disabled={loading || !username.trim() || !recoveryCode.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Sign in with Recovery Code
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
