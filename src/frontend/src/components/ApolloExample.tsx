import { gql, useQuery } from "@apollo/client";

// Example GraphQL query
const EXAMPLE_QUERY = gql`
  query ExampleQuery {
    # Replace with your actual query fields
    hello
  }
`;

// Example component to demonstrate Apollo Client usage
export function ApolloExample() {
  const { loading, error, data } = useQuery(EXAMPLE_QUERY, {
    // Skip the query execution since this is just a demonstration
    skip: true,
  });

  return (
    <div className="p-4 border rounded-lg bg-card">
      <h2 className="text-lg font-medium mb-2">Apollo Client Example</h2>
      <p className="text-sm text-muted-foreground mb-4">
        This component demonstrates Apollo Client integration. Open Apollo
        DevTools in your browser to see it working.
      </p>

      <div className="text-sm">
        <p>Query Status:</p>
        {loading && <p className="text-blue-500">Loading...</p>}
        {error && <p className="text-red-500">Error: {error.message}</p>}
        {data && (
          <pre className="bg-muted p-2 rounded mt-2">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
