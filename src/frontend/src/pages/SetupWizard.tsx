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
    const timestamp = new Date().toISOString().split('T')[0];
    const text = `Schichtplan Recovery Codes - ${timestamp}\n${'='.repeat(50)}\n\n${codes.map((code, i) => `${i + 1}. ${code}`).join('\n')}\n\nThese codes are for emergency access only.\nKeep them in a safe place!`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schichtplan-recovery-codes-${timestamp}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-amber-600 dark:text-amber-500">
        <Shield className="h-6 w-6" />
        <h3 className="text-lg font-semibold">Save Your Recovery Codes</h3>
      </div>

      <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
        <AlertDescription className="text-amber-900 dark:text-amber-100">
          <strong>Critical:</strong> These 4 codes are your only backup if you lose access to your authenticator.
          Write them down and store them in a secure, offline location—like a safe or encrypted file.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Your Recovery Codes:</p>
        <div className="grid grid-cols-2 gap-3">
          {codes.map((code, idx) => (
            <div
              key={idx}
              className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-4 rounded-lg font-mono text-center text-sm font-bold border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow"
            >
              <div className="text-xs text-muted-foreground mb-1">Code {idx + 1}</div>
              <div className="text-lg text-foreground">{code}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Button onClick={downloadCodes} variant="outline" className="w-full gap-2">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19m0 0l-6-6m6 6l6-6m0-5V5a2 2 0 00-2-2H7a2 2 0 00-2 2v6" />
          </svg>
          Download as Text File
        </Button>

        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <input
            type="checkbox"
            id="confirm-saved"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="rounded border-gray-300 mt-1"
          />
          <label htmlFor="confirm-saved" className="text-sm text-muted-foreground cursor-pointer flex-1">
            I have saved these recovery codes in a safe place and understand they cannot be recovered if lost
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
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Welcome to Schichtplan! Let's set up your admin account with modern, secure authentication.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-semibold text-base">🔐 Secure Passkey Authentication</h4>
                    <p className="text-sm text-muted-foreground">
                      Use biometric authentication (fingerprint, face recognition) or a security key. No passwords needed.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-semibold text-base">🔑 Recovery Codes for Emergency Access</h4>
                    <p className="text-sm text-muted-foreground">
                      Get 4 backup codes to regain access if you lose your authenticator.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-semibold text-base">✨ Optional AI Integration</h4>
                    <p className="text-sm text-muted-foreground">
                      Enhance scheduling with AI providers (Gemini, OpenAI, Anthropic). Can be added later.
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={() => setStep('passkey')} className="w-full" size="lg">
                Begin Setup
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
            <div className="space-y-6">
              <div className="flex justify-center py-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-blue-500 rounded-full blur-lg opacity-30 animate-pulse"></div>
                  <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950 flex items-center justify-center border-2 border-green-500 dark:border-green-400">
                    <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </div>

              <div className="text-center space-y-3">
                <h3 className="text-2xl font-bold">🎉 Setup Complete!</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Your Schichtplan account is configured and ready. You'll authenticate with your passkey
                  each time you log in—fast, secure, and password-free!
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 py-4">
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm"><strong className="text-blue-900 dark:text-blue-100">💡 Quick Tip:</strong> You'll be asked to authenticate once per day for security.</p>
                </div>
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm"><strong className="text-amber-900 dark:text-amber-100">📌 Remember:</strong> Save your recovery codes somewhere safe. You'll need them if you lose access to your authenticator.</p>
                </div>
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
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Go to Dashboard
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
