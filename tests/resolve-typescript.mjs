// Node's native strip-types runner does not resolve extensionless TypeScript imports.
// Resolve those imports for Node tests without changing Next.js application code.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.')) throw error;
    return nextResolve(specifier + '.ts', context);
  }
}
