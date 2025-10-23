import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import {
    copyCoverageProfile,
    deleteCoverageProfile,
    getAllCoverageProfiles,
    setDefaultCoverageProfile,
    updateCoverageProfile,
} from "@/services/api";
import { CoverageProfile } from "@/types/index";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
    ArchiveRestore,
    Copy,
    Loader2,
    Pencil,
    Star,
    Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

interface CoverageProfileManagerProps {
    onSelectProfile?: (profile: CoverageProfile) => void;
    selectedProfileId?: number;
}

export function CoverageProfileManager({
    onSelectProfile,
    selectedProfileId,
}: CoverageProfileManagerProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [editingProfile, setEditingProfile] =
        useState<CoverageProfile | null>(null);
    const [copyingProfile, setCopyingProfile] =
        useState<CoverageProfile | null>(null);
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [copyName, setCopyName] = useState("");
    const [copyDescription, setCopyDescription] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const { data: profiles, isLoading: profilesLoading } = useQuery({
        queryKey: ["coverage-profiles"],
        queryFn: getAllCoverageProfiles,
    });

    const sortedProfiles = useMemo(() => {
        if (!profiles) return [];
        return [...profiles].sort((a, b) => {
            // Default first
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            // Then by updated date (newest first)
            return (
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime()
            );
        });
    }, [profiles]);

    const handleSetDefault = async (profile: CoverageProfile) => {
        if (profile.isDefault) return;
        try {
            setIsLoading(true);
            await setDefaultCoverageProfile(profile.id);
            queryClient.invalidateQueries({
                queryKey: ["coverage-profiles"],
            });
            toast({
                title: "Success",
                description: `"${profile.name}" is now the default profile`,
            });
        } catch (error) {
            toast({
                title: "Error",
                description:
                    error instanceof Error
                        ? error.message
                        : "Failed to set default profile",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (profile: CoverageProfile) => {
        if (
            !confirm(`Are you sure you want to delete "${profile.name}"?`)
        ) {
            return;
        }
        try {
            setIsLoading(true);
            await deleteCoverageProfile(profile.id);
            queryClient.invalidateQueries({
                queryKey: ["coverage-profiles"],
            });
            toast({
                title: "Deleted",
                description: `Profile "${profile.name}" deleted`,
            });
        } catch (error) {
            toast({
                title: "Error",
                description:
                    error instanceof Error
                        ? error.message
                        : "Failed to delete profile",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenEdit = (profile: CoverageProfile) => {
        setEditingProfile(profile);
        setEditName(profile.name);
        setEditDescription(profile.description || "");
    };

    const handleSaveEdit = async () => {
        if (!editingProfile || !editName.trim()) {
            toast({
                title: "Error",
                description: "Profile name is required",
                variant: "destructive",
            });
            return;
        }
        try {
            setIsLoading(true);
            await updateCoverageProfile(editingProfile.id, {
                name: editName,
                description: editDescription,
            });
            queryClient.invalidateQueries({
                queryKey: ["coverage-profiles"],
            });
            toast({
                title: "Updated",
                description: `Profile "${editName}" updated`,
            });
            setEditingProfile(null);
        } catch (error) {
            toast({
                title: "Error",
                description:
                    error instanceof Error ? error.message : "Failed to update profile",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenCopy = (profile: CoverageProfile) => {
        setCopyingProfile(profile);
        setCopyName(`${profile.name} (Copy)`);
        setCopyDescription(profile.description || "");
    };

    const handleSaveCopy = async () => {
        if (!copyingProfile || !copyName.trim()) {
            toast({
                title: "Error",
                description: "Profile name is required",
                variant: "destructive",
            });
            return;
        }
        try {
            setIsLoading(true);
            await copyCoverageProfile(
                copyingProfile.id,
                copyName,
                copyDescription,
            );
            queryClient.invalidateQueries({
                queryKey: ["coverage-profiles"],
            });
            toast({
                title: "Copied",
                description: `Profile "${copyName}" created`,
            });
            setCopyingProfile(null);
        } catch (error) {
            toast({
                title: "Error",
                description:
                    error instanceof Error ? error.message : "Failed to copy profile",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (profilesLoading) {
        return (
            <Card>
                <CardContent className="flex justify-center items-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Loading profiles...</span>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ArchiveRestore className="h-5 w-5" />
                        Coverage Profiles
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {sortedProfiles.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>No coverage profiles yet. Save your current coverage as a profile to get started.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[30%]">Name</TableHead>
                                        <TableHead className="w-[40%]">Description</TableHead>
                                        <TableHead className="w-[20%]">Last Updated</TableHead>
                                        <TableHead className="w-[10%] text-right">
                                            Actions
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedProfiles.map((profile) => (
                                        <TableRow
                                            key={profile.id}
                                            className={
                                                selectedProfileId === profile.id
                                                    ? "bg-accent"
                                                    : ""
                                            }
                                        >
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {profile.isDefault && (
                                                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                                    )}
                                                    <span className="font-medium">
                                                        {profile.name}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {profile.description || "-"}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {format(
                                                    new Date(profile.updatedAt),
                                                    "dd.MM.yyyy HH:mm",
                                                    {
                                                        locale: de,
                                                    },
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-end gap-2">
                                                    {onSelectProfile && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => onSelectProfile(profile)}
                                                            disabled={isLoading}
                                                        >
                                                            Load
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleOpenEdit(profile)}
                                                        disabled={isLoading}
                                                        title="Edit profile"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleOpenCopy(profile)}
                                                        disabled={isLoading}
                                                        title="Copy profile"
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                    {!profile.isDefault && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleSetDefault(profile)}
                                                            disabled={isLoading}
                                                            title="Set as default"
                                                        >
                                                            <Star className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {!profile.isDefault && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDelete(profile)}
                                                            disabled={isLoading}
                                                            title="Delete profile"
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog
                open={!!editingProfile}
                onOpenChange={(open) => {
                    if (!open) setEditingProfile(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Profile</DialogTitle>
                        <DialogDescription>
                            Update the profile name and description
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="edit-name">Profile Name</Label>
                            <Input
                                id="edit-name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="e.g., Summer Schedule"
                            />
                        </div>
                        <div>
                            <Label htmlFor="edit-description">Description</Label>
                            <Input
                                id="edit-description"
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                placeholder="Optional description"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setEditingProfile(null)}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSaveEdit}
                                disabled={isLoading}
                            >
                                {isLoading && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Save
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Copy Dialog */}
            <Dialog
                open={!!copyingProfile}
                onOpenChange={(open) => {
                    if (!open) setCopyingProfile(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Copy Profile</DialogTitle>
                        <DialogDescription>
                            Create a copy of "{copyingProfile?.name}"
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="copy-name">New Profile Name</Label>
                            <Input
                                id="copy-name"
                                value={copyName}
                                onChange={(e) => setCopyName(e.target.value)}
                                placeholder="e.g., Summer Schedule (Copy)"
                            />
                        </div>
                        <div>
                            <Label htmlFor="copy-description">Description</Label>
                            <Input
                                id="copy-description"
                                value={copyDescription}
                                onChange={(e) => setCopyDescription(e.target.value)}
                                placeholder="Optional description"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setCopyingProfile(null)}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSaveCopy}
                                disabled={isLoading}
                            >
                                {isLoading && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Copy
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
