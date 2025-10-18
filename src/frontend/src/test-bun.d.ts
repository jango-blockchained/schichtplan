declare module "bun:test" {
  // Provide a generic mock function type so test code can call mock<T>(implementation)
  export function mock<T = any>(implementation?: any): any;
}
