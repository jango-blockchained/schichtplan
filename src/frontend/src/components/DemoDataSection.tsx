import React from 'react';
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { DemoDataGenerationProgress } from '@/components/DemoDataGenerationProgress';

export function DemoDataSection() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    return (
        <TabsContent value="data">
            <Card>
                <CardHeader>
                    <CardTitle>Demo Data Generation</CardTitle>
                    <CardDescription>
                        Generate demo data for testing and development purposes
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold">Demo Data Generation</h3>
                            <p className="text-sm text-muted-foreground">
                                Generate demo data with employees, shifts, and coverage requirements
                            </p>
                        </div>

                        <DemoDataGenerationProgress
                            onComplete={() => {
                                queryClient.invalidateQueries({ queryKey: ["settings"] });
                                toast({
                                    title: "Success",
                                    description: "Demo data generated successfully",
                                });
                            }}
                            onError={(error) => {
                                toast({
                                    title: "Error",
                                    description: error,
                                    variant: "destructive",
                                });
                            }}
                        />
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
} 