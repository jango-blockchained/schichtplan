import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GlobalMCPService } from "@/services/mcpClient";
import React from "react";
import { ConversationalAIChat } from "./ConversationalAIChat";

export const GlobalAIChat: React.FC = () => {
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const svc = await GlobalMCPService.getInstance(window.location.origin);
                if (!mounted) return;
                // subscribe to updates (kept to initialize service connection)
                svc.on('healthUpdate', () => {
                    // no-op for now; could display connection badge in future
                });
            } catch {
                // ignore
            }
        })();
        // Global event to open the AI chat from unified menu
        const openHandler = () => setOpen(true);
        window.addEventListener('open-global-ai-chat', openHandler as EventListener);
        return () => {
            mounted = false;
            window.removeEventListener('open-global-ai-chat', openHandler as EventListener);
        };
    }, []);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0">
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle className="flex items-center gap-2">Conversational AI</DialogTitle>
                </DialogHeader>
                <div className="px-6 pb-6">
                    <ConversationalAIChat />
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default GlobalAIChat;
