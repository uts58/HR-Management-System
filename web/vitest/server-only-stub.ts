// Vitest stand-in for the `server-only` package (see vitest.config.mts).
// The real package throws when imported outside a React Server Components
// build. Under Vitest that would break every test that imports a file from
// src/server or src/auth, so tests get this empty module instead. Next.js
// builds still use the real package, so the guard stays active in the app.
export {};
