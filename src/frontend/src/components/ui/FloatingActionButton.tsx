import { Button } from "@/components/ui/button";
import {
    ArrowDown,
    ArrowUp,
    LayoutPanelLeft,
    SunMoon,
    Zap,
} from "lucide-react"; // Added more icons
import React from "react";

export const FloatingActionButton: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleClick = () => {
    setIsOpen(!isOpen);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setIsOpen(false); // Close menu after action
  };

  const scrollToBottom = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    setIsOpen(false); // Close menu after action
  };

  // Placeholder functions for future features
  const handleLayoutChange = () => {
    console.log("Layout change clicked");
    setIsOpen(false);
  };
  const handleThemeChange = () => {
    console.log("Theme change clicked");
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-3 p-2 bg-card/80 backdrop-blur-md border border-border/50 rounded-lg space-y-1 w-48 transition-all duration-200 ease-out">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={scrollToTop}
          >
            <ArrowUp size={16} /> To Top
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={scrollToBottom}
          >
            <ArrowDown size={16} /> To Bottom
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={handleLayoutChange}
          >
            <LayoutPanelLeft size={16} /> Layouts
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={handleThemeChange}
          >
            <SunMoon size={16} /> Theme
          </Button>
        </div>
      )}
      <Button
        size="icon"
        className="rounded-full w-14 h-14 bg-primary/70 hover:bg-primary/90 backdrop-blur-sm text-primary-foreground hover:scale-110 transform transition-all duration-200 ease-out border border-white/20"
        onClick={handleClick}
        title="Open Layout Menu"
      >
        <Zap className="h-6 w-6" />
      </Button>
    </div>
  );
};
