/**
 * SetupWizard - First-time setup flow with passkey registration
 */
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { completeSetup, configureAIKeys, registerPasskey, type AIKeysConfig } from '@/services/setupService';
import { CheckCircle2, KeyRound, Loader2, Shield, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type SetupStep = 'welcome' | 'passkey' | 'recovery' | 'ai-keys' | 'complete';

interface RecoveryCodesDisplayProps {
  codes: string[];
  onContinue: () => void;
}

const RecoveryCodesDisplay: React.FC<RecoveryCodesDisplayProps> = ({ codes, onContinue }) => {
  const [confirmed, setConfirmed] = useState(false);

  const downloadCodes = () => {
    const text = codes.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schichtplan-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-amber-600 dark:text-amber-500">
        <Shield className="h-6 w-6" />
        <h3 className="text-lg font-semibold">Save Your Recovery Codes</h3>
      </div>

      <Alert>
        <AlertDescription>
          These codes are your backup access method. Write them down and store them in a safe place.
          Each code can only be used once.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-3">
        {codes.map((code, idx) => (
          <div
            key={idx}
            className="bg-muted p-4 rounded-md font-mono text-center text-sm font-semibold"
          >
            {code}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <Button onClick={downloadCodes} variant="outline" className="w-full">
          Download as Text File
        </Button>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="confirm-saved"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="rounded border-gray-300"
          />
          <label htmlFor="confirm-saved" className="text-sm text-muted-foreground cursor-pointer">
            I have saved these recovery codes in a safe place
          </label>
        </div>

        <Button
          onClick={onContinue}
          className="w-full"
          disabled={!confirmed}
        >
          Continue to AI Configuration
        </Button>
      </div>
    </div>
  );
};

export const SetupWizard: React.FC = () => {
  const [step, setStep] = useState<SetupStep>('welcome');
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('admin');
  const [email, setEmail] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [aiKeys, setAiKeys] = useState<AIKeysConfig>({
    api_keys: {},
    provider: 'gemini',
    enabled: false,
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  const handlePasskeySetup = async () => {
    if (!email) {
      toast({
        title: 'Email Required',
        description: 'Please enter your email address',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await registerPasskey(username, email);
      setRecoveryCodes(result.recovery_codes);
      toast({
        title: 'Passkey Registered',
        description: 'Your passkey has been successfully registered',
      });
      setStep('recovery');
    } catch (error: any) {
      toast({
        title: 'Registration Failed',
        description: error.message || 'Failed to register passkey',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAIConfiguration = async () => {
    setLoading(true);
    try {
      // Only send keys that have been filled in
      const filledKeys = Object.entries(aiKeys.api_keys)
        .filter(([_, value]) => value && value.trim() !== '')
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

      await configureAIKeys({
        ...aiKeys,
        api_keys: filledKeys,
      });

      toast({
        title: 'Configuration Saved',
        description: 'AI settings have been saved',
      });
      setStep('complete');
    } catch (error: any) {
      toast({
        title: 'Configuration Failed',
        description: error.message || 'Failed to save AI configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await completeSetup();
      toast({
        title: 'Setup Complete',
        description: 'Welcome to Schichtplan!',
      });
      // Redirect to login or main page
      navigate('/');
    } catch (error: any) {
      toast({
        title: 'Setup Error',
        description: error.message || 'Failed to complete setup',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Schichtplan Setup</CardTitle>
              <CardDescription>
                {step === 'welcome' && 'Welcome! Let\'s set up your admin account'}
                {step === 'passkey' && 'Step 1: Create Your Passkey'}
                {step === 'recovery' && 'Step 2: Save Recovery Codes'}
                {step === 'ai-keys' && 'Step 3: Configure AI (Optional)'}
                {step === 'complete' && 'Setup Complete!'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Welcome Step */}
          {step === 'welcome' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Secure Authentication</h4>
                    <p className="text-sm text-muted-foreground">
                      Use passkeys (biometric or device authentication) for secure, password-free access
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Recovery Codes</h4>
                    <p className="text-sm text-muted-foreground">
                      Get 4 recovery codes as a backup authentication method
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">AI Integration</h4>
                    <p className="text-sm text-muted-foreground">
                      Optionally configure AI providers for advanced scheduling features
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={() => setStep('passkey')} className="w-full" size="lg">
                Get Started
              </Button>
            </div>
          )}

          {/* Passkey Setup Step */}
          {step === 'passkey' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    disabled
                    className="mt-1.5"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Admin username is pre-set
                  </p>
                </div>
              </div>

              <Alert>
                <KeyRound className="h-4 w-4" />
                <AlertDescription>
                  You'll be prompted to use your device's authentication (fingerprint, face recognition,
                  or security key) to create your passkey.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handlePasskeySetup}
                className="w-full"
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Passkey...
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Create Passkey
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Recovery Codes Step */}
          {step === 'recovery' && (
            <RecoveryCodesDisplay
              codes={recoveryCodes}
              onContinue={() => setStep('ai-keys')}
            />
          )}

          {/* AI Keys Configuration Step */}
          {step === 'ai-keys' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-primary">
                <Sparkles className="h-6 w-6" />
                <h3 className="text-lg font-semibold">AI Configuration (Optional)</h3>
              </div>

              <Alert>
                <AlertDescription>
                  Configure AI providers to enable advanced features like intelligent scheduling
                  and natural language interactions. You can skip this step and configure later.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="gemini-key">Google Gemini API Key</Label>
                  <Input
                    id="gemini-key"
                    type="password"
                    placeholder="Enter API key (optional)"
                    value={aiKeys.api_keys.gemini || ''}
                    onChange={(e) => setAiKeys({
                      ...aiKeys,
                      api_keys: { ...aiKeys.api_keys, gemini: e.target.value }
                    })}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="openai-key">OpenAI API Key</Label>
                  <Input
                    id="openai-key"
                    type="password"
                    placeholder="Enter API key (optional)"
                    value={aiKeys.api_keys.openai || ''}
                    onChange={(e) => setAiKeys({
                      ...aiKeys,
                      api_keys: { ...aiKeys.api_keys, openai: e.target.value }
                    })}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="anthropic-key">Anthropic API Key</Label>
                  <Input
                    id="anthropic-key"
                    type="password"
                    placeholder="Enter API key (optional)"
                    value={aiKeys.api_keys.anthropic || ''}
                    onChange={(e) => setAiKeys({
                      ...aiKeys,
                      api_keys: { ...aiKeys.api_keys, anthropic: e.target.value }
                    })}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setStep('complete')}
                  variant="outline"
                  className="flex-1"
                >
                  Skip for Now
                </Button>
                <Button
                  onClick={handleAIConfiguration}
                  className="flex-1"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save & Continue'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-500" />
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">Setup Complete!</h3>
                <p className="text-muted-foreground">
                  Your Schichtplan account is ready to use. You'll need to authenticate with your
                  passkey once per day.
                </p>
              </div>

              <Button
                onClick={handleComplete}
                className="w-full"
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Finalizing...
                  </>
                ) : (
                  'Continue to Schichtplan'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
