/**
 * LoginPage - Authentication with passkey or recovery code
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, KeyRound, Shield, AlertCircle } from 'lucide-react';
import { loginWithPasskey, verifyRecoveryCode } from '@/services/setupService';
import { useToast } from '@/hooks/use-toast';

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('admin');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handlePasskeyLogin = async () => {
    setError(null);
    setLoading(true);
    
    try {
      const result = await loginWithPasskey(username);
      
      toast({
        title: 'Login Successful',
        description: 'Welcome back!',
      });
      
      // Redirect to main app
      navigate('/');
    } catch (error: any) {
      const errorMessage = error.message || 'Authentication failed';
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
    } catch (error: any) {
      const errorMessage = error.message || 'Invalid recovery code';
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Welcome Back</CardTitle>
              <CardDescription>
                Sign in to Schichtplan
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="passkey" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="passkey">
                <KeyRound className="h-4 w-4 mr-2" />
                Passkey
              </TabsTrigger>
              <TabsTrigger value="recovery">
                <Shield className="h-4 w-4 mr-2" />
                Recovery Code
              </TabsTrigger>
            </TabsList>

            {/* Passkey Login */}
            <TabsContent value="passkey" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="passkey-username">Username</Label>
                <Input
                  id="passkey-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Alert>
                <KeyRound className="h-4 w-4" />
                <AlertDescription>
                  You'll be prompted to use your device's authentication (fingerprint, face recognition, 
                  or security key).
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
                <Label htmlFor="recovery-username">Username</Label>
                <Input
                  id="recovery-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recovery-code">Recovery Code</Label>
                <Input
                  id="recovery-code"
                  type="text"
                  placeholder="Enter your 12-character code"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                  disabled={loading}
                  maxLength={12}
                  className="font-mono"
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Each recovery code can only be used once. After using a code, you'll have fewer 
                  recovery codes available.
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
