import { AIAssistantOrb } from "@/components/ai/AIAssistantOrb";
import { ConversationalAIChat } from "@/components/ai/ConversationalAIChat";
import { MinimalAIAssistant } from "@/components/ai/MinimalAIAssistant";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { useAIDialog } from "@/hooks/useAIDialog";
import { useEffect, useState } from "react";

/**
 * Global AI Dialog Component with Enhanced UI
 * Features:
 * - Orb-style floating button with mouse interaction
 * - Minimal popup assistant (draggable, expandable)
 * - Full conversation dialog
 * Accessible via:
 * - Orb button (bottom-right)
 * - Keyboard shortcut (Cmd+/ or Ctrl+/)
 * - Menu item in sidebar
 */
export function GlobalAIDialog() {
    const { isOpen, closeDialog, toggleDialog } = useAIDialog();
    const [useMinimalMode, setUseMinimalMode] = useState(true);
    const [expandToFull, setExpandToFull] = useState(false);

    // Keyboard shortcut: Cmd+/ or Ctrl+/
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "/") {
                e.preventDefault();
                toggleDialog();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [toggleDialog]);

    // Handle Orb click
    const handleOrbClick = () => {
        if (useMinimalMode) {
            toggleDialog();
        } else {
            toggleDialog();
        }
    };

    return (
        <>
            {/* AI Orb Button - Professional tech-style */}
            {!expandToFull && (
                <AIAssistantOrb
                    onClick={handleOrbClick}
                    isActive={isOpen}
                />
            )}

            {/* Minimal AI Assistant - Draggable popup */}
            {useMinimalMode && isOpen && (
                <MinimalAIAssistant
                    isOpen={isOpen}
                    onMaximize={() => {
                        setUseMinimalMode(false);
                        setExpandToFull(true);
                    }}
                />
            )}

            {/* Full Conversation Dialog */}
            {!useMinimalMode && (
                <Dialog open={isOpen} onOpenChange={closeDialog}>
                    <DialogContent className="w-[95vw] h-[95vh] max-w-7xl flex flex-col gap-0 p-0 rounded-2xl">
                        {/* AI Chat Component - Full screen */}
                        <div className="flex-1 overflow-hidden flex flex-col">
                            <ConversationalAIChat />
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
