import type { AccountInfo, TranslateProduct } from '../common/types';
import { apiFetch } from './client';

export async function fetchAccount(): Promise<AccountInfo> {
  return apiFetch<AccountInfo>('/api/extension/account');
}

export async function fetchProducts(): Promise<{ items: TranslateProduct[] }> {
  return apiFetch<{ items: TranslateProduct[] }>('/api/extension/products');
}

export async function createCheckout(productCode: string): Promise<{ checkout_url?: string; subscribe_url?: string }> {
  return apiFetch('/api/extension/checkout', {
    method: 'POST',
    body: JSON.stringify({ product_code: productCode }),
  });
}
