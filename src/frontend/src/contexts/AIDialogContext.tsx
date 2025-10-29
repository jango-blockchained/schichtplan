import React, { createContext, ReactNode, useCallback, useState } from "react";

interface AIDialogContextType {
    isOpen: boolean;
    openDialog: () => void;
    closeDialog: () => void;
    toggleDialog: () => void;
}

export const AIDialogContext = createContext<AIDialogContextType | undefined>(
    undefined
);

export const AIDialogProvider: React.FC<{ children: ReactNode }> = ({
    children,
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const openDialog = useCallback(() => {
        setIsOpen(true);
    }, []);

    const closeDialog = useCallback(() => {
        setIsOpen(false);
    }, []);

    const toggleDialog = useCallback(() => {
        setIsOpen((prev) => !prev);
    }, []);

    return (
        <AIDialogContext.Provider
            value={{ isOpen, openDialog, closeDialog, toggleDialog }}
        >
            {children}
        </AIDialogContext.Provider>
    );
};
