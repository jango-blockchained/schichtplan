import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GlobalMCPService, type MCPHealthStatus } from "@/services/mcpClient";
import { Bot } from "lucide-react";
import React from "react";
import { ConversationalAIChat } from "./ConversationalAIChat";

export const GlobalAIChat: React.FC = () => {
    const [open, setOpen] = React.useState(false);
    const [connected, setConnected] = React.useState(false);

    React.useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const svc = await GlobalMCPService.getInstance(window.location.origin);
                const status = svc.getConnectionStatus();
                if (!mounted) return;
                setConnected(status.isConnected);
                // subscribe to updates
                svc.on('healthUpdate', (h: MCPHealthStatus) => {
                    setConnected(['healthy', 'degraded'].includes(h.status));
                });
            } catch {
                // ignore
            }
        })();
        return () => { mounted = false; };
    }, []);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    className="fixed bottom-6 right-6 z-[60] shadow-lg rounded-full h-12 w-12 p-0"
                    variant="default"
                    aria-label="Open AI chat"
                >
                    <div className="relative">
                        <Bot className="h-6 w-6" />
                        <span
                            className={`absolute -top-1 -right-1 block h-3 w-3 rounded-full border border-background ${connected ? 'bg-green-500' : 'bg-red-500'}`}
                        />
                    </div>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0">
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5" /> Conversational AI
                    </DialogTitle>
                </DialogHeader>
                <div className="px-6 pb-6">
                    <ConversationalAIChat />
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default GlobalAIChat;
