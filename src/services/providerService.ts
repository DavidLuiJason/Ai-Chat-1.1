import { Provider, AIAccount, AuthType, ConnectionStatus, AvailabilityStatus } from '../types/index.ts';
import { ProviderRegistry, DEFAULT_PROVIDERS, VerificationResult } from './providerRegistry.ts';

export const INITIAL_PROVIDERS: Provider[] = DEFAULT_PROVIDERS;

const SEQUENCE_STORAGE_KEY = 'aichat_provider_sequences_v2';

/**
 * Gets the next automatic account number for a provider.
 * Follows the strict rule:
 * - "ChatGPT 1", "ChatGPT 2", "ChatGPT 3"...
 * - NEVER reuse account numbers even if previous accounts are deleted!
 * - Number is an identity, NOT a quality ranking.
 */
export function getNextSequentialNumber(providerId: string): number {
  try {
    const raw = localStorage.getItem(SEQUENCE_STORAGE_KEY);
    const sequences: Record<string, number> = raw ? JSON.parse(raw) : {};
    const currentMax = sequences[providerId] || 0;
    const nextNum = currentMax + 1;
    sequences[providerId] = nextNum;
    localStorage.setItem(SEQUENCE_STORAGE_KEY, JSON.stringify(sequences));
    return nextNum;
  } catch (err) {
    console.error('Error generating sequence number:', err);
    return 1;
  }
}

/**
 * Strict rule: NEVER reuse account numbers even if previous accounts are deleted.
 * Number is an identity, NOT a quality ranking.
 */
export const getNextAccountNumber = getNextSequentialNumber;

export function peekNextSequentialNumber(providerId: string): number {
  try {
    const raw = localStorage.getItem(SEQUENCE_STORAGE_KEY);
    const sequences: Record<string, number> = raw ? JSON.parse(raw) : {};
    const currentMax = sequences[providerId] || 0;
    return currentMax + 1;
  } catch {
    return 1;
  }
}

export function generateCanonicalName(providerName: string, identityNumber: number): string {
  return `${providerName} ${identityNumber}`;
}

export type { VerificationResult };

/**
 * Real provider verification via ProviderRegistry adapter. Never fakes success.
 */
export async function verifyProviderConnection(params: {
  providerId: string;
  authType: AuthType;
  apiKey?: string;
  customEndpointUrl?: string;
}): Promise<VerificationResult> {
  const adapter = ProviderRegistry.getAdapter(params.providerId);
  return adapter.connect(params);
}

/**
 * Ping an account to check its live availability based on genuine API response.
 */
export async function pingAccountAvailability(account: AIAccount): Promise<{
  isOperational: boolean;
  status: AvailabilityStatus;
  latencyMs: number;
  details: string;
}> {
  if (account.connectionStatus !== 'CONNECTED') {
    return {
      isOperational: false,
      status: 'AUTHENTICATION_REQUIRED',
      latencyMs: 0,
      details: 'Account is not in CONNECTED state.',
    };
  }

  const adapter = ProviderRegistry.getAdapter(account.providerId);
  return adapter.checkStatus(account);
}

/**
 * Real AI generation call for active workforce execution using genuine provider adapter.
 */
export async function executeProviderPrompt(params: {
  account: AIAccount;
  prompt: string;
  systemInstruction?: string;
}): Promise<{ text: string; error?: string }> {
  const { account, prompt, systemInstruction } = params;

  if (account.connectionStatus !== 'CONNECTED') {
    return {
      text: '',
      error: `Cannot generate: ${account.canonicalName} is ${account.connectionStatus}. Real credentials required.`,
    };
  }

  const adapter = ProviderRegistry.getAdapter(account.providerId);
  return adapter.sendMessage({ account, prompt, systemInstruction });
}
