'use client';

export function ErrorState({ reset }: { reset: () => void }) {
  return (
    <section className="wrap empty-state" aria-labelledby="error-title">
      <h1 id="error-title">Store temporarily unavailable</h1>
      <p>Give it a moment and try loading the page again.</p>
      <button className="action action-dark" onClick={reset}>Try again</button>
    </section>
  );
}
