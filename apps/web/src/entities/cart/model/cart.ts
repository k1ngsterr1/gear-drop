'use client';

import { useSyncExternalStore } from 'react';

export interface CartLine {
  variantId: string;
  slug: string;
  name: string;
  variant: string;
  priceCents: number;
  quantity: number;
  stock?: number;
}

interface Cart {
  lineage: string | null;
  version: string | null;
  revision: number;
  lines: CartLine[];
  lastOrderId: string | null;
  lastOrderRevision: number;
}

interface CheckoutAttempt {
  key: string;
  lineage: string;
  revision: number;
}

type CheckoutPreparation = { status: 'ready'; attempt: CheckoutAttempt }
  | { status: 'changed' }
  | { status: 'legacy-unverified' };

const storageKey = 'gear-drop:bag:v1';
const maxLines = 20;
const maxQuantity = 10;
const empty: Cart = { lineage: null, version: null, revision: 0, lines: [], lastOrderId: null, lastOrderRevision: 0 };
const listeners = new Set<() => void>();
let cart = empty;
let ready = false;
let canPersist = true;
let storedValue: string | null | undefined;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== 'object') return false;
  const item: Partial<Record<keyof CartLine, unknown>> = value;
  return typeof item.variantId === 'string' && typeof item.slug === 'string'
    && /^[a-z0-9-]+$/.test(item.slug) && typeof item.name === 'string' && typeof item.variant === 'string'
    && typeof item.priceCents === 'number' && Number.isInteger(item.priceCents) && item.priceCents > 0
    && typeof item.quantity === 'number' && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= maxQuantity
    && (item.stock === undefined || (typeof item.stock === 'number' && Number.isInteger(item.stock) && item.stock >= 0));
}

function decode(raw: string | null): Cart {
  let parsed: unknown;
  try { parsed = raw ? JSON.parse(raw) : null; } catch { return empty; }
  if (!parsed || typeof parsed !== 'object') return empty;
  const stored: Partial<Record<keyof Cart, unknown>> = Array.isArray(parsed) ? { lines: parsed } : parsed;
  if (!Array.isArray(stored.lines)) return empty;

  const byId = new Map<string, CartLine>();
  for (const item of stored.lines.slice(0, maxLines)) {
    if (isCartLine(item)) byId.set(item.variantId, item);
  }
  const revision = typeof stored.revision === 'number' && Number.isSafeInteger(stored.revision) && stored.revision > 0
    ? stored.revision : Number(byId.size > 0);
  const lastOrderId = isUuid(stored.lastOrderId) ? stored.lastOrderId : null;
  const savedRevision = stored.lastOrderRevision;
  const lastOrderRevision = lastOrderId && typeof savedRevision === 'number'
    && Number.isSafeInteger(savedRevision) && savedRevision >= 0 && savedRevision <= revision ? savedRevision : 0;
  return {
    lineage: isUuid(stored.lineage) ? stored.lineage : null,
    version: isUuid(stored.version) ? stored.version : null,
    revision,
    lines: [...byId.values()],
    lastOrderId,
    lastOrderRevision,
  };
}

function publish() {
  listeners.forEach((listener) => listener());
}

function bagStorage() {
  return navigator.locks ? window.localStorage : window.sessionStorage;
}

function readStoredBag() {
  const storage = bagStorage();
  const raw = storage.getItem(storageKey);
  if (raw !== null || navigator.locks) return raw;

  let previous: string | null = null;
  try { previous = window.localStorage.getItem(storageKey); } catch {}
  const imported = JSON.stringify(decode(previous));
  try { storage.setItem(storageKey, imported); } catch { canPersist = false; }
  return imported;
}

function refresh() {
  if (!canPersist) return;
  let raw: string | null;
  try {
    raw = readStoredBag();
  } catch {
    canPersist = false;
    return;
  }
  if (raw === storedValue) return;
  storedValue = raw;
  cart = decode(raw);
  publish();
}

function onStorage(event: StorageEvent) {
  if (event.key === storageKey || event.key === null) refresh();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    if (navigator.locks) window.addEventListener('storage', onStorage);
    ready = true;
    refresh();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.removeEventListener('storage', onStorage);
      ready = false;
    }
  };
}

function save(next: Cart) {
  cart = next;
  if (canPersist) {
    try {
      const raw = JSON.stringify(next);
      bagStorage().setItem(storageKey, raw);
      storedValue = raw;
    } catch {
      canPersist = false;
    }
  }
  publish();
}

function withCurrentCart<T>(update: (current: Cart) => T): Promise<T> {
  const run = () => {
    refresh();
    return update(cart);
  };
  // Only local reads and writes run under the lock. Checkout requests run independently.
  if (navigator.locks) return navigator.locks.request(storageKey, run);
  return Promise.resolve().then(run);
}

function saveLines(current: Cart, lines: CartLine[]) {
  const isUnverifiedLegacy = current.version === null && current.revision > current.lastOrderRevision;
  save({
    ...current,
    lineage: current.lineage ?? crypto.randomUUID(),
    version: isUnverifiedLegacy ? null : crypto.randomUUID(),
    revision: current.revision + 1,
    lines,
  });
}

export function canIncrease(line: Pick<CartLine, 'quantity' | 'stock'>) {
  return line.quantity < Math.min(maxQuantity, line.stock ?? maxQuantity);
}

export function addLine(line: Omit<CartLine, 'quantity'>) {
  return withCurrentCart((current) => {
    const existing = current.lines.find((item) => item.variantId === line.variantId);
    const quantity = existing?.quantity ?? 0;
    if (!canIncrease({ ...line, quantity }) || (!existing && current.lines.length >= maxLines)) return false;

    const next = { ...line, quantity: quantity + 1 };
    const lines = existing
      ? current.lines.map((item) => item.variantId === line.variantId ? next : item)
      : [...current.lines, next];
    saveLines(current, lines);
    return true;
  });
}

export function changeQuantity(variantId: string, change: -1 | 1 | 'remove') {
  return withCurrentCart((current) => {
    const line = current.lines.find((item) => item.variantId === variantId);
    if (!line || (change === 1 && !canIncrease(line))) return;
    const quantity = change === 'remove' ? 0 : line.quantity + change;
    const lines = quantity === 0
      ? current.lines.filter((item) => item.variantId !== variantId)
      : current.lines.map((item) => item.variantId === variantId ? { ...item, quantity } : item);
    saveLines(current, lines);
  });
}

export function prepareCheckout(displayed: Cart, previousOrderKey: string | null, confirmedNewOrder: boolean) {
  return withCurrentCart<CheckoutPreparation>((current) => {
    if (current.revision !== displayed.revision || (displayed.lineage && current.lineage !== displayed.lineage)) {
      return { status: 'changed' };
    }
    if (displayed.version ? current.version !== displayed.version : !sameItems(current, displayed)) {
      return { status: 'changed' };
    }

    const legacyKey = isUuid(previousOrderKey) ? previousOrderKey : null;
    const key = current.version ?? (confirmedNewOrder ? crypto.randomUUID() : legacyKey);
    if (!key) return { status: 'legacy-unverified' };
    const lineage = current.lineage ?? crypto.randomUUID();
    if (!current.version || !current.lineage) save({ ...current, version: key, lineage });
    return { status: 'ready', attempt: { key, lineage, revision: current.revision } };
  });
}

function sameItems(left: Cart, right: Cart) {
  return left.lines.length === right.lines.length && left.lines.every((line, index) => {
    const previous = right.lines[index];
    return previous?.variantId === line.variantId && previous.quantity === line.quantity;
  });
}

export function recordOrder(attempt: CheckoutAttempt, orderId: string) {
  return withCurrentCart((current) => {
    if (current.lineage !== attempt.lineage) return;
    const clearsBag = current.version === attempt.key;
    const updatesReceipt = attempt.revision > current.lastOrderRevision;
    if (!clearsBag && !updatesReceipt) return;

    save({
      ...current,
      version: clearsBag ? null : current.version,
      lines: clearsBag ? empty.lines : current.lines,
      lastOrderId: updatesReceipt ? orderId : current.lastOrderId,
      lastOrderRevision: updatesReceipt ? attempt.revision : current.lastOrderRevision,
    });
  });
}

const getCart = () => cart;
const getEmptyCart = () => empty;
const getLines = () => cart.lines;
const getEmptyLines = () => empty.lines;
const getReady = () => ready;
const getNotReady = () => false;
const getZero = () => 0;
const getCount = () => cart.lines.reduce((total, line) => total + line.quantity, 0);
const getLastOrderId = () => cart.lastOrderId;
const getNoOrderId = () => null;

export function useCartSnapshot() {
  return useSyncExternalStore(subscribe, getCart, getEmptyCart);
}

export function useCart() {
  return useSyncExternalStore(subscribe, getLines, getEmptyLines);
}

export function useCartReady() {
  return useSyncExternalStore(subscribe, getReady, getNotReady);
}

export function useCartCount() {
  return useSyncExternalStore(subscribe, getCount, getZero);
}

export function useCartQuantity(variantId: string) {
  return useSyncExternalStore(subscribe, () => cart.lines.find((line) => line.variantId === variantId)?.quantity ?? 0, getZero);
}

export function useLastOrderId() {
  return useSyncExternalStore(subscribe, getLastOrderId, getNoOrderId);
}
