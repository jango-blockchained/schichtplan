import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bot } from "lucide-react";
import { useState } from "react";
import { ConversationalAIChat } from "./ConversationalAIChat";

interface GlobalAIChatDialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function GlobalAIChatDialog({ open = false, onOpenChange }: GlobalAIChatDialogProps) {
    const [isOpen, setIsOpen] = useState(open);

    const handleOpenChange = (newOpen: boolean) => {
        setIsOpen(newOpen);
        onOpenChange?.(newOpen);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5" />
                        AI Assistant
                    </DialogTitle>
                    <DialogDescription>
                        Sprechen Sie mit der KI über Ihre Schichtplanungsanforderungen. Der
                        Kontext wird automatisch basierend auf Ihrer aktuellen Seite
                        hinzugefügt.
                    </DialogDescription>
                </DialogHeader>

                <div className="h-[600px]">
                    <ConversationalAIChat />
                </div>
            </DialogContent>
        </Dialog>
    );
}
