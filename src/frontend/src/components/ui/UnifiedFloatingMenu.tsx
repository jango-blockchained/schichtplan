import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Bot, MoreHorizontal, Sparkles } from "lucide-react";
import React from "react";

interface UnifiedFloatingMenuProps {
    className?: string;
}

/**
 * UnifiedFloatingMenu
 * Single bottom-right floating menu that merges:
 * - Default navigation (scroll up/down)
 * - AI Conversation (opens GlobalAIChat)
 * - AI Suggestions (opens FloatingSuggestionsPanel)
 */
export const UnifiedFloatingMenu: React.FC<UnifiedFloatingMenuProps> = ({ className }) => {
    const [open, setOpen] = React.useState(false);

    const toggle = () => setOpen((v) => !v);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        setOpen(false);
    };

    const scrollToBottom = () => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        setOpen(false);
    };

    const openAIChat = () => {
        window.dispatchEvent(new CustomEvent("open-global-ai-chat"));
        setOpen(false);
    };

    const openAISuggestions = () => {
        window.dispatchEvent(new CustomEvent("open-suggestions-panel"));
        setOpen(false);
    };

    return (
        <div className={cn("fixed bottom-6 right-6 z-[60] flex flex-col items-end", className)}>
            {open && (
                <Card className="mb-3 w-56 p-2 backdrop-blur border-border/60 shadow-xl">
                    <div className="flex flex-col gap-1">
                        <Button variant="ghost" size="sm" className="justify-start gap-2" onClick={scrollToTop}>
                            <ArrowUp className="h-4 w-4" /> Page up
                        </Button>
                        <Button variant="ghost" size="sm" className="justify-start gap-2" onClick={scrollToBottom}>
                            <ArrowDown className="h-4 w-4" /> Page down
                        </Button>
                        <div className="h-px my-1 bg-border" />
                        <Button variant="ghost" size="sm" className="justify-start gap-2" onClick={openAIChat}>
                            <Bot className="h-4 w-4" /> AI Conversation
                        </Button>
                        <Button variant="ghost" size="sm" className="justify-start gap-2" onClick={openAISuggestions}>
                            <Sparkles className="h-4 w-4" /> AI Suggestions
                        </Button>
                    </div>
                </Card>
            )}

            <Button
                size="icon"
                className="rounded-full h-12 w-12 shadow-lg"
                aria-label="Open quick menu"
                onClick={toggle}
            >
                <MoreHorizontal className="h-5 w-5" />
            </Button>
        </div>
    );
};

export default UnifiedFloatingMenu;
