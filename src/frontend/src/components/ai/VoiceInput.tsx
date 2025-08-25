import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { aiService, type VoiceCommand } from "@/services/aiService";
import {
    Activity,
    AlertCircle,
    CheckCircle2,
    Loader2,
    Mic,
    MicOff,
    Settings,
    Volume2,
    VolumeX
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface VoiceInputProps {
    onTranscript: (text: string) => void;
    onCommand?: (command: VoiceCommand) => void;
    disabled?: boolean;
    language?: string;
    className?: string;
}

interface VoiceState {
    isListening: boolean;
    isProcessing: boolean;
    hasPermission: boolean;
    audioLevel: number;
    transcript: string;
    confidence: number;
    error?: string;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
    onTranscript,
    onCommand,
    disabled = false,
    language = 'de-DE',
    className
}) => {
    const [voiceState, setVoiceState] = useState<VoiceState>({
        isListening: false,
        isProcessing: false,
        hasPermission: false,
        audioLevel: 0,
        transcript: '',
        confidence: 0
    });

    const [settings, setSettings] = useState({
        language,
        sensitivity: 0.7,
        autoStop: true,
        noiseReduction: true
    });

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const animationFrameRef = useRef<number>();
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);

    useEffect(() => {
        checkMicrophonePermission();
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    const checkMicrophonePermission = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setVoiceState(prev => ({ ...prev, hasPermission: true }));
            stream.getTracks().forEach(track => track.stop());
        } catch (error) {
            setVoiceState(prev => ({
                ...prev,
                hasPermission: false,
                error: 'Microphone permission denied'
            }));
            toast.error('Mikrofonberechtigung erforderlich für Spracheingabe');
        }
    };

    const startRecording = async () => {
        if (!voiceState.hasPermission || disabled) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: settings.noiseReduction,
                    sampleRate: 44100
                }
            });

            // Setup audio analysis for visual feedback
            audioContextRef.current = new AudioContext();
            analyserRef.current = audioContextRef.current.createAnalyser();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            analyserRef.current.fftSize = 256;

            mediaRecorderRef.current = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await processAudioBlob(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setVoiceState(prev => ({
                ...prev,
                isListening: true,
                transcript: '',
                confidence: 0,
                error: undefined
            }));

            // Start audio level monitoring
            monitorAudioLevel();

            // Auto-stop after 30 seconds if enabled
            if (settings.autoStop) {
                setTimeout(() => {
                    if (voiceState.isListening) {
                        stopRecording();
                    }
                }, 30000);
            }

        } catch (error) {
            console.error('Failed to start recording:', error);
            toast.error('Aufnahme konnte nicht gestartet werden');
            setVoiceState(prev => ({
                ...prev,
                error: 'Failed to start recording'
            }));
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && voiceState.isListening) {
            mediaRecorderRef.current.stop();
            setVoiceState(prev => ({
                ...prev,
                isListening: false,
                isProcessing: true
            }));

            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        }
    };

    const processAudioBlob = async (audioBlob: Blob) => {
        try {
            const voiceCommand = await aiService.processVoiceCommand(audioBlob);

            setVoiceState(prev => ({
                ...prev,
                isProcessing: false,
                transcript: voiceCommand.transcript,
                confidence: voiceCommand.confidence
            }));

            if (voiceCommand.confidence > settings.sensitivity) {
                onTranscript(voiceCommand.transcript);
                if (onCommand) {
                    onCommand(voiceCommand);
                }
                toast.success(`Spracheingabe erkannt: "${voiceCommand.transcript}"`);
            } else {
                toast.warning('Sprache nicht deutlich genug erkannt');
            }

        } catch (error) {
            console.error('Voice processing failed:', error);
            setVoiceState(prev => ({
                ...prev,
                isProcessing: false,
                error: 'Voice processing failed'
            }));
            toast.error('Sprachverarbeitung fehlgeschlagen');
        }
    };

    const monitorAudioLevel = () => {
        if (!analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

        const updateLevel = () => {
            if (!analyserRef.current || !voiceState.isListening) return;

            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            const level = Math.min(100, (average / 128) * 100);

            setVoiceState(prev => ({ ...prev, audioLevel: level }));
            animationFrameRef.current = requestAnimationFrame(updateLevel);
        };

        updateLevel();
    };

    const toggleRecording = () => {
        if (voiceState.isListening) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const getStatusIcon = () => {
        if (voiceState.error) return <AlertCircle className="h-4 w-4 text-red-500" />;
        if (voiceState.isProcessing) return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
        if (voiceState.isListening) return <Activity className="h-4 w-4 text-green-500 animate-pulse" />;
        if (voiceState.transcript) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        return null;
    };

    const getStatusText = () => {
        if (voiceState.error) return voiceState.error;
        if (voiceState.isProcessing) return 'Verarbeite Spracheingabe...';
        if (voiceState.isListening) return 'Hört zu...';
        if (voiceState.transcript) return 'Sprache erkannt';
        return 'Bereit für Spracheingabe';
    };

    return (
        <div className={cn("space-y-3", className)}>
            {/* Main Voice Button */}
            <div className="flex items-center gap-3">
                <Button
                    onClick={toggleRecording}
                    disabled={disabled || !voiceState.hasPermission || voiceState.isProcessing}
                    variant={voiceState.isListening ? "destructive" : "outline"}
                    size="lg"
                    className={cn(
                        "relative",
                        voiceState.isListening && "animate-pulse"
                    )}
                >
                    {voiceState.isListening ? (
                        <MicOff className="h-5 w-5" />
                    ) : (
                        <Mic className="h-5 w-5" />
                    )}

                    {voiceState.isListening && (
                        <span className="absolute -inset-1 rounded-lg bg-red-500/20 animate-ping" />
                    )}
                </Button>

                {/* Status Display */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        {getStatusIcon()}
                        <span className="text-sm font-medium truncate">
                            {getStatusText()}
                        </span>
                    </div>

                    {voiceState.isListening && (
                        <Progress
                            value={voiceState.audioLevel}
                            className="h-1 mt-1"
                        />
                    )}
                </div>

                {/* Settings Button */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        // Settings modal would open here
                        toast.info('Voice-Einstellungen (noch nicht implementiert)');
                    }}
                    disabled={voiceState.isListening}
                >
                    <Settings className="h-4 w-4" />
                </Button>
            </div>

            {/* Transcript Display */}
            {voiceState.transcript && (
                <Card>
                    <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                            <Volume2 className="h-4 w-4 mt-1 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm">{voiceState.transcript}</p>
                                {voiceState.confidence > 0 && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" className="text-xs">
                                            {Math.round(voiceState.confidence * 100)}% Vertrauen
                                        </Badge>
                                        <Badge
                                            variant={voiceState.confidence > settings.sensitivity ? "default" : "secondary"}
                                            className="text-xs"
                                        >
                                            {voiceState.confidence > settings.sensitivity ? "Akzeptiert" : "Zu ungenau"}
                                        </Badge>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Permission Warning */}
            {!voiceState.hasPermission && (
                <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                            <VolumeX className="h-4 w-4 text-amber-500" />
                            <span className="text-sm text-amber-700">
                                Mikrofonberechtigung erforderlich für Spracheingabe
                            </span>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={checkMicrophonePermission}
                                className="ml-auto"
                            >
                                Erneut versuchen
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default VoiceInput;
