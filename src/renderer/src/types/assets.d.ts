// Allow importing CSS files as side-effects in TypeScript
declare module '*.css' {
  const content: Record<string, string>
  export default content
}
