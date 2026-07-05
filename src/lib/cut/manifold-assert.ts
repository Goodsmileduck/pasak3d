/**
 * Throw if a manifold boolean produced invalid geometry, freeing the bad solid
 * first so it doesn't leak on the error path. Returns the solid on success so it
 * can be used inline.
 */
export function assertNoError(solid: any, label: string): any {
  const status = solid.status();
  if (status !== "NoError") {
    solid.delete();
    throw new Error(`${label}: ${status}`);
  }
  return solid;
}
