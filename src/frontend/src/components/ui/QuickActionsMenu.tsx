import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    ArrowDownCircle,
    ArrowUpCircle,
    ChevronsUpDown,
    Copy,
    Download,
    Filter,
    MessageSquare,
    MoreVertical,
    Sparkles,
} from 'lucide-react';
import React from 'react';

interface QuickActionsMenuProps {
    onPageUp?: () => void;
    onPageDown?: () => void;
    onOpenAIConversation?: () => void;
    onOpenAISuggestions?: () => void;
    onExport?: () => void;
    onCopyWeek?: () => void;
    onGenerateDemoData?: () => void;
    onToggleFilters?: () => void;
}

export const QuickActionsMenu: React.FC<QuickActionsMenuProps> = ({
    onPageUp,
    onPageDown,
    onOpenAIConversation,
    onOpenAISuggestions,
    onExport,
    onCopyWeek,
    onGenerateDemoData,
    onToggleFilters,
}) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="Quick actions">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex items-center gap-2">
                    <ChevronsUpDown className="h-4 w-4" /> Quick Actions
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <div className="px-2">
                    <p className="text-xs text-muted-foreground">Navigation</p>
                </div>
                <DropdownMenuItem onClick={onPageUp}>
                    <ArrowUpCircle className="h-4 w-4 mr-2" /> Page Up
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onPageDown}>
                    <ArrowDownCircle className="h-4 w-4 mr-2" /> Page Down
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <div className="px-2">
                    <p className="text-xs text-muted-foreground">AI</p>
                </div>
                <DropdownMenuItem onClick={onOpenAIConversation}>
                    <MessageSquare className="h-4 w-4 mr-2" /> AI Conversation
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenAISuggestions}>
                    <Sparkles className="h-4 w-4 mr-2" /> AI Suggestions
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <div className="px-2">
                    <p className="text-xs text-muted-foreground">Utilities</p>
                </div>
                <DropdownMenuItem onClick={onExport}>
                    <Download className="h-4 w-4 mr-2" /> Export PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onCopyWeek}>
                    <Copy className="h-4 w-4 mr-2" /> Copy Week
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleFilters}>
                    <Filter className="h-4 w-4 mr-2" /> Toggle Filters
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onGenerateDemoData}>
                    <Sparkles className="h-4 w-4 mr-2" /> Generate Demo Data
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default QuickActionsMenu;
