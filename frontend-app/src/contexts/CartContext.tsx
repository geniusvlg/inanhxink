import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { CartItem } from '../services/api';

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getOrCreateSessionId(): string {
  const key = 'cart_session_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

/** Unique key per cart line — includes variant so different variants are separate entries. */
function entryKey(productId: number, variantId?: number | null): string {
  return variantId != null ? `${productId}|v${variantId}` : `${productId}`;
}

// Cart item in context (without uploaded image_urls / note — added at checkout Step 2)
export interface CartEntry {
  product_id:    number;
  product_name:  string;
  variant_id?:   number | null;
  variant_name?: string | null;
  unit_price:    number;
  quantity:      number;
  max_upload_images?: number;
  /** Thumbnail to show in drawer — NOT sent to backend (that's image_urls set in Step 2). */
  thumbnail?:    string;
}

export function startBuyNowCheckout(entry: CartEntry): void {
  localStorage.setItem('buy_now_checkout', JSON.stringify({
    sessionId: generateUUID(),
    items:     [entry],
  }));
}

// ── Context ───────────────────────────────────────────────────────────────────

interface CartContextValue {
  items:       CartEntry[];
  sessionId:   string;
  totalItems:  number;
  subtotal:    number;

  addItem:     (entry: Omit<CartEntry, 'quantity'> & { quantity?: number }) => void;
  removeItem:  (productId: number, variantId?: number | null) => void;
  updateQty:   (productId: number, qty: number, variantId?: number | null) => void;
  clearCart:   () => void;
  resetSession:() => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'cart_items';

// ── Provider ──────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string>(() => getOrCreateSessionId());
  const [items, setItems] = useState<CartEntry[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartEntry[]) : [];
    } catch {
      return [];
    }
  });

  // Persist cart to localStorage on every change.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((entry: Omit<CartEntry, 'quantity'> & { quantity?: number }) => {
    setItems(prev => {
      const key = entryKey(entry.product_id, entry.variant_id);
      const existing = prev.find(it => entryKey(it.product_id, it.variant_id) === key);
      if (existing) {
        return prev.map(it =>
          entryKey(it.product_id, it.variant_id) === key
            ? { ...it, quantity: it.quantity + (entry.quantity ?? 1) }
            : it,
        );
      }
      return [...prev, { ...entry, quantity: entry.quantity ?? 1 }];
    });
  }, []);

  const removeItem = useCallback((productId: number, variantId?: number | null) => {
    const key = entryKey(productId, variantId);
    setItems(prev => prev.filter(it => entryKey(it.product_id, it.variant_id) !== key));
  }, []);

  const updateQty = useCallback((productId: number, qty: number, variantId?: number | null) => {
    if (qty < 1) return;
    const key = entryKey(productId, variantId);
    setItems(prev =>
      prev.map(it => (entryKey(it.product_id, it.variant_id) === key ? { ...it, quantity: qty } : it)),
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const resetSession = useCallback(() => {
    const newId = generateUUID();
    localStorage.setItem('cart_session_id', newId);
    setSessionId(newId);
    clearCart();
  }, [clearCart]);

  const totalItems = items.reduce((s, it) => s + it.quantity, 0);
  const subtotal   = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);

  // Convert CartEntry[] → CartItem[] for api.ts (image_urls and note are filled at Step 2)
  const toApiItems = (): CartItem[] =>
    items.map(it => ({
      product_id:   it.product_id,
      product_name: it.product_name,
      variant_id:   it.variant_id ?? undefined,
      variant_name: it.variant_name ?? undefined,
      quantity:     it.quantity,
      unit_price:   it.unit_price,
      image_urls:   [],
      note:         '',
    }));

  void toApiItems; // used externally via cartEntriesToApiItems

  return (
    <CartContext.Provider value={{
      items, sessionId, totalItems, subtotal,
      addItem, removeItem, updateQty, clearCart, resetSession,
    }}>
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

// Exported helper for CheckoutPage Step 2 to convert cart items to API payload items.
export function cartEntriesToApiItems(
  entries: CartEntry[],
  customisations: Record<string, { image_urls: string[]; note: string }>,
): CartItem[] {
  return entries.map(it => {
    const key = entryKey(it.product_id, it.variant_id);
    return {
      product_id:   it.product_id,
      product_name: it.product_name,
      variant_id:   it.variant_id ?? undefined,
      variant_name: it.variant_name ?? undefined,
      quantity:     it.quantity,
      unit_price:   it.unit_price,
      image_urls:   customisations[key]?.image_urls ?? [],
      note:         customisations[key]?.note ?? '',
    };
  });
}
