import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  ApolloLink,
} from "@apollo/client";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const httpLink = new HttpLink({
  uri: `${API_BASE_URL}/graphql`,
  credentials: "include",
});

const client = new ApolloClient({
  link: httpLink as unknown as ApolloLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: "network-only",
    },
    query: {
      fetchPolicy: "network-only",
    },
  },
});

export default client;
