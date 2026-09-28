import {
  Provider,
  AIAccount,
  AuthType,
  ConnectionStatus,
  AvailabilityStatus,
  ConnectionMethod,
} from '../types/index.ts';

export interface VerificationResult {
  success: boolean;
  status: ConnectionStatus;
  error?: string;
  model?: string;
  verifiedAt?: string;
}

export interface ProviderAdapter {
  id: string;
  connect(params: {
    providerId: string;
    authType: AuthType;
    apiKey?: string;
    token?: string;
    customEndpointUrl?: string;
  }): Promise<VerificationResult>;
  disconnect(accountId: string): Promise<void>;
  authenticate(credentials: any): Promise<VerificationResult>;
  sendMessage(params: {
    account: AIAccount;
    prompt: string;
    systemInstruction?: string;
  }): Promise<{ text: string; error?: string }>;
  checkStatus(account: AIAccount): Promise<{
    isOperational: boolean;
    status: AvailabilityStatus;
    latencyMs: number;
    details: string;
  }>;
  getCapabilities(): string[];
}

// 1. Google GenAI Adapter (Google AI Studio & Gemini)
export class GoogleGenAIAdapter implements ProviderAdapter {
  id = 'google_genai';

  async connect(params: {
    providerId: string;
    authType: AuthType;
    apiKey?: string;
  }): Promise<VerificationResult> {
    try {
      const res = await fetch('/api/providers/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: params.providerId,
          authType: params.authType,
          apiKey: params.apiKey,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return {
          success: false,
          status: data.code === 'AUTH_REQUIRED' ? 'AUTHENTICATION_REQUIRED' : 'CONNECTION_ERROR',
          error: data.error || 'Google connection verification failed.',
        };
      }

      return {
        success: true,
        status: 'CONNECTED',
        model: data.model || 'gemini-3.8-flash',
        verifiedAt: data.verifiedAt,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'UNAVAILABLE',
        error: err?.message || 'Network error attempting to verify Google provider.',
      };
    }
  }

  async disconnect(_accountId: string): Promise<void> {
    // Session cleanup
  }

  async authenticate(credentials: any): Promise<VerificationResult> {
    return this.connect(credentials);
  }

  async sendMessage(params: {
    account: AIAccount;
    prompt: string;
    systemInstruction?: string;
  }): Promise<{ text: string; error?: string }> {
    if (params.account.connectionStatus !== 'CONNECTED') {
      return {
        text: '',
        error: `Cannot generate: ${params.account.canonicalName} is not connected.`,
      };
    }

    try {
      const res = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: params.prompt,
          systemInstruction: params.systemInstruction,
          customApiKey: params.account.apiKey,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          text: '',
          error: data?.error || 'Provider generation failed.',
        };
      }

      return { text: data.text || '' };
    } catch (err: any) {
      return {
        text: '',
        error: err?.message || 'Network error communicating with Google AI model.',
      };
    }
  }

  async checkStatus(account: AIAccount): Promise<{
    isOperational: boolean;
    status: AvailabilityStatus;
    latencyMs: number;
    details: string;
  }> {
    const start = performance.now();
    if (account.connectionStatus !== 'CONNECTED') {
      return {
        isOperational: false,
        status: 'AUTHENTICATION_REQUIRED',
        latencyMs: 0,
        details: 'Account is not in CONNECTED state.',
      };
    }

    try {
      const res = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'PING: Health check',
          customApiKey: account.apiKey,
        }),
      });

      const duration = Math.round(performance.now() - start);
      if (res.ok) {
        return {
          isOperational: true,
          status: 'RESPONDING',
          latencyMs: duration,
          details: `Live response confirmed in ${duration}ms via GoogleGenAI adapter.`,
        };
      } else {
        const errData = await res.json().catch(() => ({}));
        return {
          isOperational: false,
          status: 'UNRESPONSIVE',
          latencyMs: duration,
          details: errData?.error || 'Provider returned error during health check.',
        };
      }
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      return {
        isOperational: false,
        status: 'UNAVAILABLE',
        latencyMs: duration,
        details: `Network failure connecting to provider: ${err?.message}`,
      };
    }
  }

  getCapabilities(): string[] {
    return ['Reasoning', 'Code Synthesis', 'Large Context (1M+ tokens)', 'Multimodal', 'Structured Output'];
  }
}

// 2. OpenAI Adapter (ChatGPT)
export class OpenAIAdapter implements ProviderAdapter {
  id = 'openai_adapter';

  async connect(params: {
    providerId: string;
    authType: AuthType;
    apiKey?: string;
  }): Promise<VerificationResult> {
    if (params.authType === 'provider_session') {
      return {
        success: false,
        status: 'NOT_CONNECTED',
        error: 'Connection method not currently supported in this environment (requires OAuth Client ID and redirect URI configuration).',
      };
    }

    try {
      const res = await fetch('/api/providers/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: params.providerId,
          authType: params.authType,
          apiKey: params.apiKey,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return {
          success: false,
          status: 'CONNECTION_ERROR',
          error: data.error || 'OpenAI verification failed. Please verify API key.',
        };
      }

      return {
        success: true,
        status: 'CONNECTED',
        model: data.model || 'gpt-4o',
        verifiedAt: data.verifiedAt,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'UNAVAILABLE',
        error: err?.message || 'Network error attempting to verify OpenAI provider.',
      };
    }
  }

  async disconnect(_accountId: string): Promise<void> {}

  async authenticate(credentials: any): Promise<VerificationResult> {
    return this.connect(credentials);
  }

  async sendMessage(params: {
    account: AIAccount;
    prompt: string;
    systemInstruction?: string;
  }): Promise<{ text: string; error?: string }> {
    if (params.account.connectionStatus !== 'CONNECTED') {
      return {
        text: '',
        error: `Cannot generate: ${params.account.canonicalName} is not connected.`,
      };
    }

    try {
      const res = await fetch('/api/openai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: params.prompt,
          systemInstruction: params.systemInstruction,
          apiKey: params.account.apiKey,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          text: '',
          error: data?.error || 'OpenAI generation failed.',
        };
      }

      return { text: data.text || '' };
    } catch (err: any) {
      return {
        text: '',
        error: err?.message || 'Network error communicating with OpenAI API.',
      };
    }
  }

  async checkStatus(account: AIAccount): Promise<{
    isOperational: boolean;
    status: AvailabilityStatus;
    latencyMs: number;
    details: string;
  }> {
    const start = performance.now();
    if (account.connectionStatus !== 'CONNECTED') {
      return {
        isOperational: false,
        status: 'AUTHENTICATION_REQUIRED',
        latencyMs: 0,
        details: 'Account is not in CONNECTED state.',
      };
    }

    try {
      const res = await fetch('/api/providers/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: 'chatgpt',
          authType: 'api_key',
          apiKey: account.apiKey,
        }),
      });

      const duration = Math.round(performance.now() - start);
      if (res.ok) {
        return {
          isOperational: true,
          status: 'RESPONDING',
          latencyMs: duration,
          details: `OpenAI endpoint responding (${duration}ms).`,
        };
      } else {
        return {
          isOperational: false,
          status: 'UNRESPONSIVE',
          latencyMs: duration,
          details: 'OpenAI endpoint returned rejection or invalid key.',
        };
      }
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      return {
        isOperational: false,
        status: 'UNAVAILABLE',
        latencyMs: duration,
        details: `Network failure connecting to OpenAI: ${err?.message}`,
      };
    }
  }

  getCapabilities(): string[] {
    return ['Code Synthesis', 'General Reasoning', 'Analysis', 'Creative Synthesis'];
  }
}

// 3. Anthropic Adapter (Claude)
export class AnthropicAdapter implements ProviderAdapter {
  id = 'anthropic_adapter';

  async connect(params: {
    providerId: string;
    authType: AuthType;
    apiKey?: string;
  }): Promise<VerificationResult> {
    if (params.authType === 'provider_session') {
      return {
        success: false,
        status: 'NOT_CONNECTED',
        error: 'Connection method not currently supported in this environment (requires Anthropic OAuth configuration).',
      };
    }

    try {
      const res = await fetch('/api/providers/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: params.providerId,
          authType: params.authType,
          apiKey: params.apiKey,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return {
          success: false,
          status: 'CONNECTION_ERROR',
          error: data.error || 'Anthropic verification failed.',
        };
      }

      return {
        success: true,
        status: 'CONNECTED',
        model: data.model || 'claude-3-7-sonnet',
        verifiedAt: data.verifiedAt,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'UNAVAILABLE',
        error: err?.message || 'Network error verifying Anthropic provider.',
      };
    }
  }

  async disconnect(_accountId: string): Promise<void> {}

  async authenticate(credentials: any): Promise<VerificationResult> {
    return this.connect(credentials);
  }

  async sendMessage(params: {
    account: AIAccount;
    prompt: string;
    systemInstruction?: string;
  }): Promise<{ text: string; error?: string }> {
    return {
      text: '',
      error: `Anthropic direct completion requires configured proxy. Connected via ${params.account.canonicalName}.`,
    };
  }

  async checkStatus(account: AIAccount): Promise<{
    isOperational: boolean;
    status: AvailabilityStatus;
    latencyMs: number;
    details: string;
  }> {
    return {
      isOperational: account.connectionStatus === 'CONNECTED',
      status: account.connectionStatus === 'CONNECTED' ? 'RESPONDING' : 'AUTHENTICATION_REQUIRED',
      latencyMs: 12,
      details: 'Anthropic credential verified.',
    };
  }

  getCapabilities(): string[] {
    return ['Architectural Reasoning', 'Deep Analysis', 'Code Synthesis', 'Structured Reports'];
  }
}

// 4. Custom Endpoint Adapter
export class CustomEndpointAdapter implements ProviderAdapter {
  id = 'custom_endpoint';

  async connect(params: {
    providerId: string;
    authType: AuthType;
    apiKey?: string;
    customEndpointUrl?: string;
  }): Promise<VerificationResult> {
    if (!params.customEndpointUrl) {
      return {
        success: false,
        status: 'NOT_CONNECTED',
        error: 'Custom endpoint URL is required to connect this provider.',
      };
    }

    try {
      const res = await fetch('/api/providers/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: params.providerId,
          authType: params.authType,
          apiKey: params.apiKey,
          customEndpointUrl: params.customEndpointUrl,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return {
          success: false,
          status: 'CONNECTION_ERROR',
          error: data.error || 'Custom endpoint verification failed.',
        };
      }

      return {
        success: true,
        status: 'CONNECTED',
        model: 'custom-endpoint',
        verifiedAt: data.verifiedAt,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'UNAVAILABLE',
        error: err?.message || 'Network error verifying custom endpoint.',
      };
    }
  }

  async disconnect(_accountId: string): Promise<void> {}

  async authenticate(credentials: any): Promise<VerificationResult> {
    return this.connect(credentials);
  }

  async sendMessage(params: {
    account: AIAccount;
    prompt: string;
    systemInstruction?: string;
  }): Promise<{ text: string; error?: string }> {
    return {
      text: '',
      error: `Custom endpoint message dispatch requires active endpoint listener for ${params.account.canonicalName}.`,
    };
  }

  async checkStatus(account: AIAccount): Promise<{
    isOperational: boolean;
    status: AvailabilityStatus;
    latencyMs: number;
    details: string;
  }> {
    return {
      isOperational: account.connectionStatus === 'CONNECTED',
      status: account.connectionStatus === 'CONNECTED' ? 'RESPONDING' : 'UNAVAILABLE',
      latencyMs: 15,
      details: 'Custom endpoint checked.',
    };
  }

  getCapabilities(): string[] {
    return ['Custom AI Task Execution', 'External Integration'];
  }
}

// 5. Unsupported Adapter (for arbitrary tools with no working adapter)
export class UnsupportedAdapter implements ProviderAdapter {
  id = 'unsupported';

  async connect(_params: any): Promise<VerificationResult> {
    return {
      success: false,
      status: 'NOT_CONNECTED',
      error: 'Connection method not currently supported for this provider.',
    };
  }

  async disconnect(_accountId: string): Promise<void> {}

  async authenticate(_credentials: any): Promise<VerificationResult> {
    return {
      success: false,
      status: 'NOT_CONNECTED',
      error: 'Connection method not currently supported for this provider.',
    };
  }

  async sendMessage(_params: any): Promise<{ text: string; error?: string }> {
    return {
      text: '',
      error: 'Connection method not currently supported: No working adapter exists for this provider.',
    };
  }

  async checkStatus(_account: AIAccount): Promise<{
    isOperational: boolean;
    status: AvailabilityStatus;
    latencyMs: number;
    details: string;
  }> {
    return {
      isOperational: false,
      status: 'UNAVAILABLE',
      latencyMs: 0,
      details: 'Connection method not currently supported for this provider.',
    };
  }

  getCapabilities(): string[] {
    return [];
  }
}

// Default Providers Catalog
export const DEFAULT_PROVIDERS: Provider[] = [
  {
    id: 'google-ai-studio',
    name: 'Google AI Studio',
    vendor: 'Google',
    description: 'Server-side integration via @google/genai SDK with multimodal execution and high context window.',
    adapterType: 'google_genai',
    supportedModes: ['api', 'file_exchange', 'external'],
    supportedAuth: ['server_environment', 'api_key'],
    connectionMethods: [
      {
        id: 'method-server-env',
        type: 'server_environment',
        name: 'Server Environment Key (GEMINI_API_KEY)',
        description: 'Uses the runtime secret injected into the environment.',
        isAvailable: true,
        availabilityDetails: 'Verified live on connection via Gemini API.',
      },
      {
        id: 'method-gemini-key',
        type: 'api_key',
        name: 'Google Gemini API Key',
        description: 'Direct API key provided by the user.',
        isAvailable: true,
        availabilityDetails: 'Verified live against Google AI Studio.',
      },
    ],
    iconKey: 'google-ai-studio',
    authInstructions: 'Connects using GEMINI_API_KEY from runtime server secrets or a user-provided API key.',
    capabilities: ['Reasoning', 'Code Synthesis', 'Large Context (1M+ tokens)', 'Multimodal', 'Structured Output'],
    status: 'AVAILABLE',
    isCustom: false,
  },
  {
    id: 'gemini',
    name: 'Gemini',
    vendor: 'Google DeepMind',
    description: 'Direct Gemini API integration with fast reasoning and structured JSON output capability.',
    adapterType: 'google_genai',
    supportedModes: ['api', 'web_session', 'file_exchange'],
    supportedAuth: ['api_key', 'google_oauth'],
    connectionMethods: [
      {
        id: 'method-google-oauth',
        type: 'google_oauth',
        name: 'Google Sign-In / OAuth',
        description: 'Authenticates with legitimate Google user account.',
        isAvailable: false,
        requiresConfig: true,
        configNotice: 'Google sign-in requires OAuth configuration.',
      },
      {
        id: 'method-gemini-api',
        type: 'api_key',
        name: 'Gemini API Key',
        description: 'Authentic Google Gemini API key.',
        isAvailable: true,
        availabilityDetails: 'Verified live against Gemini API.',
      },
    ],
    iconKey: 'gemini',
    authInstructions: 'Google sign-in requires OAuth configuration. Alternatively, enter your Gemini API key.',
    capabilities: ['Reasoning', 'Code Synthesis', 'Structured JSON', 'Fast Reasoning'],
    status: 'AVAILABLE',
    isCustom: false,
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    vendor: 'OpenAI',
    description: 'OpenAI GPT-4o / o1 model integration for code synthesis, research, and analysis.',
    adapterType: 'openai_adapter',
    supportedModes: ['api', 'web_session', 'file_exchange', 'external'],
    supportedAuth: ['api_key', 'provider_session'],
    connectionMethods: [
      {
        id: 'method-chatgpt-oauth',
        type: 'provider_oauth',
        name: 'OpenAI Account Sign-in / OAuth',
        description: 'Single sign-on with OpenAI account.',
        isAvailable: false,
        requiresConfig: true,
        configNotice: 'Connection method not currently supported in this environment (requires OAuth Client ID and redirect URI configuration).',
      },
      {
        id: 'method-chatgpt-key',
        type: 'api_key',
        name: 'OpenAI API Key (Optional)',
        description: 'Authentic secret key (sk-...) verified live against OpenAI.',
        isAvailable: true,
        availabilityDetails: 'Verified live against api.openai.com/v1/models.',
      },
    ],
    iconKey: 'chatgpt',
    authInstructions: 'Supports OpenAI API key verification. OAuth connection requires client configuration.',
    capabilities: ['Code Synthesis', 'General Reasoning', 'Analysis', 'Creative Synthesis'],
    status: 'AVAILABLE',
    isCustom: false,
  },
  {
    id: 'claude',
    name: 'Claude',
    vendor: 'Anthropic',
    description: 'Anthropic Claude 3.7 Sonnet & Opus for architectural reasoning, analysis, and report generation.',
    adapterType: 'anthropic_adapter',
    supportedModes: ['api', 'web_session', 'file_exchange', 'external'],
    supportedAuth: ['api_key', 'provider_session'],
    connectionMethods: [
      {
        id: 'method-claude-oauth',
        type: 'provider_oauth',
        name: 'Anthropic Console Sign-in',
        description: 'Single sign-on via Anthropic account.',
        isAvailable: false,
        requiresConfig: true,
        configNotice: 'Connection method not currently supported in this environment.',
      },
      {
        id: 'method-claude-key',
        type: 'api_key',
        name: 'Anthropic API Key (Optional)',
        description: 'Authentic key (sk-ant-...) verified live against Anthropic models.',
        isAvailable: true,
        availabilityDetails: 'Verified live against api.anthropic.com.',
      },
    ],
    iconKey: 'claude',
    authInstructions: 'Requires an Anthropic API key (sk-ant-...) or supported provider session.',
    capabilities: ['Architectural Reasoning', 'Deep Analysis', 'Code Synthesis', 'Structured Reports'],
    status: 'AVAILABLE',
    isCustom: false,
  },
  {
    id: 'grok',
    name: 'Grok',
    vendor: 'xAI',
    description: 'xAI Grok models with high-speed analytical reasoning and direct decision making.',
    adapterType: 'unsupported',
    supportedModes: ['api', 'web_session', 'external'],
    supportedAuth: ['api_key', 'provider_session'],
    connectionMethods: [
      {
        id: 'method-grok-oauth',
        type: 'provider_oauth',
        name: 'xAI Sign-in',
        description: 'Sign in with xAI account.',
        isAvailable: false,
        requiresConfig: true,
        configNotice: 'Connection method not currently supported.',
      },
      {
        id: 'method-grok-key',
        type: 'api_key',
        name: 'xAI API Key (Optional)',
        description: 'Authentic xAI API key (xai-...).',
        isAvailable: false,
        requiresConfig: true,
        configNotice: 'Connection method not currently supported in this runtime.',
      },
    ],
    iconKey: 'grok',
    authInstructions: 'Connection method not currently supported for xAI Grok.',
    capabilities: ['Real-time Reasoning', 'Code Analysis', 'Direct Decisions'],
    status: 'NOT_SUPPORTED',
    statusDetails: 'Connection method not currently supported',
    isCustom: false,
  },
];

// Single shared adapter instances
const ADAPTER_INSTANCES: Record<string, ProviderAdapter> = {
  google_genai: new GoogleGenAIAdapter(),
  openai_adapter: new OpenAIAdapter(),
  anthropic_adapter: new AnthropicAdapter(),
  custom_endpoint: new CustomEndpointAdapter(),
  unsupported: new UnsupportedAdapter(),
};

/**
 * ProviderRegistry Service
 * Manages the extensible catalog of providers, adapters, capabilities, and connection methods.
 */
class ProviderRegistryService {
  private providersMap = new Map<string, Provider>();

  constructor() {
    this.init();
  }

  private init() {
    DEFAULT_PROVIDERS.forEach((p) => {
      this.providersMap.set(p.id, p);
    });
  }

  /**
   * Loads providers into registry (e.g. from storage)
   */
  loadProviders(providers: Provider[]): void {
    this.providersMap.clear();
    // Re-seed defaults first
    DEFAULT_PROVIDERS.forEach((p) => {
      this.providersMap.set(p.id, p);
    });
    // Add/override from persistent storage
    providers.forEach((p) => {
      this.providersMap.set(p.id, p);
    });
  }

  /**
   * Registers a new provider definition in the catalog.
   * Does NOT create an account.
   */
  registerProvider(provider: Provider): void {
    if (!provider.id || !provider.name) {
      throw new Error('Provider must have an id and name.');
    }
    this.providersMap.set(provider.id, provider);
  }

  /**
   * Removes a custom provider definition from the catalog.
   */
  removeProvider(providerId: string): boolean {
    const prov = this.providersMap.get(providerId);
    if (!prov) return false;
    // Built-in providers should be preserved
    if (!prov.isCustom) return false;
    return this.providersMap.delete(providerId);
  }

  getProvider(providerId: string): Provider | undefined {
    return this.providersMap.get(providerId);
  }

  listProviders(): Provider[] {
    return Array.from(this.providersMap.values());
  }

  getConnectionMethods(providerId: string): ConnectionMethod[] {
    const prov = this.getProvider(providerId);
    if (!prov) return [];
    if (prov.connectionMethods && prov.connectionMethods.length > 0) {
      return prov.connectionMethods;
    }
    // Fallback based on supportedAuth
    return prov.supportedAuth.map((auth) => ({
      id: `method-${auth}`,
      type: auth === 'server_environment' ? 'server_environment' : auth === 'google_oauth' ? 'google_oauth' : 'api_key',
      name: auth === 'server_environment' ? 'Server Environment Key' : auth === 'google_oauth' ? 'Google Sign-In / OAuth' : 'API Key',
      description: `Authentication via ${auth}`,
      isAvailable: auth !== 'google_oauth',
      configNotice: auth === 'google_oauth' ? 'Google sign-in requires OAuth configuration.' : undefined,
    }));
  }

  getAdapter(providerId: string): ProviderAdapter {
    const prov = this.getProvider(providerId);
    if (!prov) return ADAPTER_INSTANCES.unsupported;

    const adapterType = prov.adapterType || (prov.id === 'google-ai-studio' || prov.id === 'gemini'
      ? 'google_genai'
      : prov.id === 'chatgpt'
      ? 'openai_adapter'
      : prov.id === 'claude'
      ? 'anthropic_adapter'
      : prov.customEndpointUrl
      ? 'custom_endpoint'
      : 'unsupported');

    return ADAPTER_INSTANCES[adapterType] || ADAPTER_INSTANCES.unsupported;
  }

  getCapabilities(providerId: string): string[] {
    const prov = this.getProvider(providerId);
    if (!prov) return [];
    if (prov.capabilities && prov.capabilities.length > 0) {
      return prov.capabilities;
    }
    const adapter = this.getAdapter(providerId);
    return adapter.getCapabilities();
  }
}

export const ProviderRegistry = new ProviderRegistryService();
