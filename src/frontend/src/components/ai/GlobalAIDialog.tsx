import { ConversationalAIChat } from "@/components/ai/ConversationalAIChat";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useAIDialog } from "@/hooks/useAIDialog";
import { Bot } from "lucide-react";
import { useEffect } from "react";

/**
 * Global AI Dialog Component
 * Accessible via:
 * - Floating button (bottom-right)
 * - Keyboard shortcut (Cmd+/ or Ctrl+/)
 * - Menu item in sidebar
 */
export function GlobalAIDialog() {
    const { isOpen, closeDialog, toggleDialog } = useAIDialog();

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

    return (
        <>
            {/* Floating Button */}
            <div className="fixed bottom-6 right-6 z-[40]">
                <Button
                    onClick={toggleDialog}
                    size="lg"
                    className="rounded-full shadow-lg hover:shadow-xl transition-all"
                    title="AI Assistant (Cmd+/)"
                >
                    <Bot className="size-5 mr-2" />
                    AI Assistant
                </Button>
            </div>

            {/* Global Dialog */}
            <Dialog open={isOpen} onOpenChange={closeDialog}>
                <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Bot className="size-5" />
                            AI Assistant
                        </DialogTitle>
                        <DialogDescription>
                            Intelligent scheduling assistance and recommendations
                        </DialogDescription>
                    </DialogHeader>

                    {/* AI Chat Component */}
                    <div className="flex-1 overflow-hidden">
                        <ConversationalAIChat />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
