/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GRAPHQL_API_URL: string;
  // add more environment variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
