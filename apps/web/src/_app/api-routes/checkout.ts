import { NextResponse } from 'next/server';
import type { CheckoutFailure } from '@gear-drop/contracts';
import { fetchStore } from '@/shared/api/store.server';

const maxPayloadBytes = 8192;

export async function POST(request: Request) {
  const key = request.headers.get('idempotency-key');
  if (!key || !request.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json<CheckoutFailure>({ code: 'INVALID_REQUEST', message: 'A JSON body and idempotency key are required.' }, { status: 400 });
  }

  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxPayloadBytes) {
        await reader.cancel();
        return NextResponse.json<CheckoutFailure>({ code: 'INVALID_REQUEST', message: 'Checkout request is too large.' }, { status: 413 });
      }
      chunks.push(chunk.value);
    }
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const upstream = await fetchStore('/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': key },
      body,
    });
    if (upstream.status < 500) return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  } catch {}
  return NextResponse.json<CheckoutFailure>({ code: 'SERVICE_UNAVAILABLE', message: 'Checkout is temporarily unavailable. Please try again.' }, { status: 503 });
}
