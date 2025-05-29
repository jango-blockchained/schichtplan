import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';

// Mock data for suggestions - replace with actual data flow later
const mockSuggestions = [
	{
		id: 'suggestion1',
		name: 'Suggestion 1',
		metrics: { coverage: '95%', fairness: '8/10', costReduction: '5%' },
		changes: [
			'Assign Employee A to Morning Shift on 2025-06-01',
			'Remove Employee B from Night Shift on 2025-06-03',
			'Add Employee C to Evening Shift on 2025-06-02',
		],
	},
	{
		id: 'suggestion2',
		name: 'Suggestion 2',
		metrics: { coverage: '92%', fairness: '9/10', costReduction: '3%' },
		changes: [
			'Swap Employee D and Employee E shifts on 2025-06-04',
			'Assign Employee F to Weekend Overtime on 2025-06-07',
		],
	},
];

const noSuggestions = false; // Set to true to test no suggestions view

/**
 * @interface AISuggestionViewProps
 * @description Props for the AISuggestionView component. Currently, it takes no props.
 * Future props might include the actual list of suggestions and callbacks for actions.
 */
interface AISuggestionViewProps {}

/**
 * @component AISuggestionView
 * @description A component responsible for displaying AI-generated schedule suggestions.
 * It can show multiple suggestions in tabs and provides options to preview or apply them.
 * It also handles the case where no suggestions are available or not yet generated.
 *
 * @param {AISuggestionViewProps} props - The props for the component.
 * @returns {React.ReactElement} The rendered AI suggestion view.
 */
const AISuggestionView: React.FC<AISuggestionViewProps> = () => {
	if (noSuggestions) {
		return (
			<Alert variant="destructive">
				<Terminal className="h-4 w-4" />
				<AlertTitle>No Suggestions Found</AlertTitle>
				<AlertDescription>
					The AI could not generate any feasible schedule suggestions with the current settings for the selected period.
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<Tabs defaultValue={mockSuggestions[0]?.id || 'nosuggestions'} className="w-full">
			<TabsList className="grid w-full grid-cols-2">
				{mockSuggestions.map((suggestion) => (
					<TabsTrigger key={suggestion.id} value={suggestion.id}>
						{suggestion.name}
					</TabsTrigger>
				))}
			</TabsList>
			{mockSuggestions.map((suggestion) => (
				<TabsContent key={suggestion.id} value={suggestion.id}>
					<Card>
						<CardHeader>
							<CardTitle>{suggestion.name} Details</CardTitle>
							<div className="flex space-x-2 pt-2">
								<Badge>Coverage: {suggestion.metrics.coverage}</Badge>
								<Badge variant="secondary">Fairness: {suggestion.metrics.fairness}</Badge>
								<Badge variant="outline">Cost Saving: {suggestion.metrics.costReduction}</Badge>
							</div>
						</CardHeader>
						<CardContent className="space-y-2">
							<p className="text-sm font-medium">Proposed Changes:</p>
							<ul className="list-disc pl-5 text-sm text-muted-foreground">
								{suggestion.changes.map((change, index) => (
									<li key={index}>{change}</li>
								))}
							</ul>
						</CardContent>
						<CardFooter className="flex justify-end space-x-2">
							<Button variant="outline">Preview</Button>
							<Button>Apply Suggestion</Button>
						</CardFooter>
					</Card>
				</TabsContent>
			))}
			{mockSuggestions.length === 0 && !noSuggestions && (
				<TabsContent value="nosuggestions">
					<Alert>
						<Terminal className="h-4 w-4" />
						<AlertTitle>AI Suggestions</AlertTitle>
						<AlertDescription>Generate a schedule to see AI suggestions here.</AlertDescription>
					</Alert>
				</TabsContent>
			)}
		</Tabs>
	);
};

export default AISuggestionView;
