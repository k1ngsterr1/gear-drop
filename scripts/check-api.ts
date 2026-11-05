async function checkApi(): Promise<void> {
  const response = await fetch('http://127.0.0.1:4000/products/field-75', {
    signal: AbortSignal.timeout(2000),
  });
  if (!response.ok) throw new Error(`Store API returned ${response.status}.`);
}

void checkApi().catch(() => { process.exitCode = 1; });
