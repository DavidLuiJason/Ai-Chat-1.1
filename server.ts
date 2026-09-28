import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
];

async function pingGeminiClient(client: GoogleGenAI): Promise<{ success: boolean; model?: string; error?: string }> {
  let lastErr: any = null;
  for (const model of FALLBACK_MODELS) {
    try {
      const resp = await client.models.generateContent({
        model,
        contents: 'PING',
      });
      if (resp) {
        return { success: true, model };
      }
    } catch (err: any) {
      lastErr = err;
      const errStr = typeof err === 'string' ? err : JSON.stringify(err);
      // If error is high demand (503), try next model
      if (errStr.includes('503') || errStr.includes('demand') || err?.status === 503) {
        continue;
      }
      // If auth failure (401/403/invalid key), stop immediately
      if (errStr.includes('API_KEY_INVALID') || errStr.includes('401') || errStr.includes('403')) {
        return { success: false, error: err?.message || 'Invalid API credentials.' };
      }
    }
  }
  return { success: false, error: lastErr?.message || 'All models unavailable during verification.' };
}

const geminiApiKey = process.env.GEMINI_API_KEY;
let serverGeminiClient: GoogleGenAI | null = null;
if (geminiApiKey) {
  serverGeminiClient = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// 1. Provider status endpoint
app.get('/api/providers/status', (_req, res) => {
  res.json({
    googleAiStudio: {
      hasServerKey: !!process.env.GEMINI_API_KEY,
      status: process.env.GEMINI_API_KEY ? 'READY' : 'NOT_CONFIGURED',
      model: 'gemini-3.8-flash',
    },
    googleOAuth: {
      isConfigured: false,
      notice: 'Google sign-in requires OAuth configuration.',
    },
    openAI: {
      hasEnvKey: !!process.env.OPENAI_API_KEY,
    },
    anthropic: {
      hasEnvKey: !!process.env.ANTHROPIC_API_KEY,
    },
    version: '2.1.0',
    timestamp: new Date().toISOString(),
  });
});

// 2. Real provider verification endpoint
app.post('/api/providers/verify', async (req, res) => {
  const { providerId, authType, apiKey, customEndpointUrl } = req.body;

  // Handle Google OAuth
  if (authType === 'google_oauth') {
    return res.status(400).json({
      success: false,
      error: 'Google sign-in requires OAuth configuration.',
      code: 'CONFIG_REQUIRED',
    });
  }

  // Handle Provider OAuth
  if (authType === 'provider_oauth') {
    return res.status(400).json({
      success: false,
      error: 'Provider OAuth connection method not currently supported in this environment.',
      code: 'NOT_SUPPORTED',
    });
  }

  // Google AI Studio
  if (providerId === 'google-ai-studio') {
    if (authType === 'server_environment') {
      if (!serverGeminiClient) {
        return res.status(400).json({
          success: false,
          error: 'GEMINI_API_KEY is not configured in the server environment.',
          code: 'AUTH_REQUIRED',
        });
      }
      const pingResult = await pingGeminiClient(serverGeminiClient);
      if (pingResult.success) {
        return res.json({
          success: true,
          providerId,
          model: pingResult.model || 'gemini-3.8-flash',
          verifiedAt: new Date().toISOString(),
        });
      } else {
        return res.status(502).json({
          success: false,
          error: `Google AI Studio verification failed: ${pingResult.error}`,
          code: 'CONNECTION_ERROR',
        });
      }
    } else if (authType === 'api_key' || apiKey) {
      if (!apiKey || apiKey.trim().length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Gemini API key is required.',
          code: 'AUTH_REQUIRED',
        });
      }
      const client = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const pingResult = await pingGeminiClient(client);
      if (pingResult.success) {
        return res.json({
          success: true,
          providerId,
          model: pingResult.model || 'gemini-3.8-flash',
          verifiedAt: new Date().toISOString(),
        });
      } else {
        return res.status(401).json({
          success: false,
          error: `API Key verification failed: ${pingResult.error}`,
          code: 'INVALID_CREDENTIALS',
        });
      }
    }
  }

  // Gemini Direct
  if (providerId === 'gemini') {
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'Gemini API Key is required for connection.',
        code: 'AUTH_REQUIRED',
      });
    }
    const client = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
    const pingResult = await pingGeminiClient(client);
    if (pingResult.success) {
      return res.json({
        success: true,
        providerId,
        model: pingResult.model || 'gemini-3.8-flash',
        verifiedAt: new Date().toISOString(),
      });
    } else {
      return res.status(401).json({
        success: false,
        error: `Gemini verification failed: ${pingResult.error}`,
        code: 'INVALID_CREDENTIALS',
      });
    }
  }

  // ChatGPT (OpenAI)
  if (providerId === 'chatgpt') {
    if (!apiKey || apiKey.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Valid OpenAI API key (sk-...) is required.',
        code: 'AUTH_REQUIRED',
      });
    }
    try {
      const openAiRes = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
      });
      if (openAiRes.ok) {
        return res.json({
          success: true,
          providerId,
          model: 'gpt-4o',
          verifiedAt: new Date().toISOString(),
        });
      } else {
        const errJson = await openAiRes.json().catch(() => ({}));
        return res.status(401).json({
          success: false,
          error: errJson?.error?.message || 'OpenAI API key verification failed: 401 Unauthorized.',
          code: 'INVALID_CREDENTIALS',
        });
      }
    } catch (err: any) {
      return res.status(502).json({
        success: false,
        error: `Network error connecting to OpenAI: ${err?.message || 'Unreachable'}`,
        code: 'CONNECTION_ERROR',
      });
    }
  }

  // Claude (Anthropic)
  if (providerId === 'claude') {
    if (!apiKey || apiKey.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Valid Anthropic API key (sk-ant-...) is required.',
        code: 'AUTH_REQUIRED',
      });
    }
    try {
      const claudeRes = await fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: {
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
        },
      });
      if (claudeRes.ok) {
        return res.json({
          success: true,
          providerId,
          model: 'claude-3-7-sonnet',
          verifiedAt: new Date().toISOString(),
        });
      } else {
        const errJson = await claudeRes.json().catch(() => ({}));
        return res.status(401).json({
          success: false,
          error: errJson?.error?.message || 'Anthropic API key verification failed: 401 Unauthorized.',
          code: 'INVALID_CREDENTIALS',
        });
      }
    } catch (err: any) {
      return res.status(502).json({
        success: false,
        error: `Network error connecting to Anthropic: ${err?.message || 'Unreachable'}`,
        code: 'CONNECTION_ERROR',
      });
    }
  }

  // Custom Endpoint URL ping
  if (customEndpointUrl) {
    try {
      const customRes = await fetch(customEndpointUrl, {
        method: 'GET',
        headers: apiKey ? { Authorization: `Bearer ${apiKey.trim()}` } : {},
      });
      if (customRes.ok || customRes.status === 200 || customRes.status === 204) {
        return res.json({
          success: true,
          providerId,
          model: 'custom-endpoint',
          verifiedAt: new Date().toISOString(),
        });
      } else {
        return res.status(customRes.status).json({
          success: false,
          error: `Custom endpoint returned status ${customRes.status}: ${customRes.statusText}`,
          code: 'CONNECTION_ERROR',
        });
      }
    } catch (err: any) {
      return res.status(502).json({
        success: false,
        error: `Could not connect to custom endpoint URL: ${err?.message || 'Network failure'}`,
        code: 'CONNECTION_ERROR',
      });
    }
  }

  // Unsupported or arbitrary provider without implemented adapter
  return res.status(400).json({
    success: false,
    error: `Connection method not currently supported for provider "${providerId}".`,
    code: 'NOT_SUPPORTED',
  });
});

// Real OpenAI generation endpoint
app.post('/api/openai/generate', async (req, res) => {
  const { prompt, systemInstruction, apiKey } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(401).json({ error: 'OpenAI API key is required.' });
  }
  try {
    const messages = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key.trim()}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
      }),
    });
    const data = await openAiRes.json();
    if (!openAiRes.ok) {
      return res.status(openAiRes.status).json({
        error: data?.error?.message || 'OpenAI generation failed.',
      });
    }
    const text = data?.choices?.[0]?.message?.content || '';
    return res.json({ text, model: 'gpt-4o' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Error communicating with OpenAI' });
  }
});

// 3. Generation endpoint with model fallback
app.post('/api/gemini/generate', async (req, res) => {
  try {
    const { prompt, systemInstruction, customApiKey } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const client = customApiKey
      ? new GoogleGenAI({
          apiKey: customApiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        })
      : serverGeminiClient;

    if (!client) {
      return res.status(503).json({
        error: 'No active Google AI Studio client or key available.',
        notConnected: true,
      });
    }

    const modelsToTry = FALLBACK_MODELS;
    let lastError: any = null;
    let responseText = '';
    let successModel = '';

    for (const model of modelsToTry) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: prompt,
          config: systemInstruction ? { systemInstruction } : undefined,
        });
        if (response.text) {
          responseText = response.text;
          successModel = model;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} failed, trying fallback:`, err?.message || err);
      }
    }

    if (responseText) {
      return res.json({
        text: responseText,
        model: successModel,
      });
    }

    res.status(500).json({
      error: lastError?.message || 'Error generating content from Gemini',
    });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    res.status(500).json({
      error: error?.message || 'Error generating content from Gemini',
    });
  }
});

// Vite middlewares for dev or static for prod
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Chat server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
