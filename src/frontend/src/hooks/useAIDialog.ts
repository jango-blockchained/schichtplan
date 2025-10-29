import { AIDialogContext } from "@/contexts/AIDialogContext";
import { useContext } from "react";

export const useAIDialog = () => {
  const context = useContext(AIDialogContext);
  if (context === undefined) {
    throw new Error("useAIDialog must be used within AIDialogProvider");
  }
  return context;
};
