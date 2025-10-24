import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
} from "@apollo/client";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const httpLink = new HttpLink({
  uri: `${API_BASE_URL}/graphql`,
  credentials: "include",
});

const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: "cache-and-network",
    },
    query: {
      fetchPolicy: "cache-first",
    },
  },
});

export default client;
