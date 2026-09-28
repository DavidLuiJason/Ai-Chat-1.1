import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { AuthType, Provider } from '../../types/index.ts';
import {
  peekNextSequentialNumber,
  generateCanonicalName,
} from '../../services/providerService.ts';
import {
  ShieldAlert,
  CheckCircle2,
  Loader2,
  X,
  Key,
  Server,
  Cpu,
  LogIn,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProviderId?: string;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  isOpen,
  onClose,
  defaultProviderId,
}) => {
  const { providers, connectAccount } = useApp();

  const [selectedProviderId, setSelectedProviderId] = useState(
    defaultProviderId || (providers[0]?.id ?? 'google-ai-studio')
  );

  // Sync selected provider if defaultProviderId changes or modal reopens
  useEffect(() => {
    if (defaultProviderId && providers.some((p) => p.id === defaultProviderId)) {
      setSelectedProviderId(defaultProviderId);
    } else if (providers.length > 0 && !providers.some((p) => p.id === selectedProviderId)) {
      setSelectedProviderId(providers[0].id);
    }
  }, [defaultProviderId, isOpen, providers]);

  const currentProvider: Provider =
    providers.find((p) => p.id === selectedProviderId) || providers[0] || {
      id: 'google-ai-studio',
      name: 'Google AI Studio',
      vendor: 'Google',
      description: '',
      supportedModes: ['api'],
      supportedAuth: ['server_environment', 'api_key'],
      iconKey: 'google-ai-studio',
      authInstructions: '',
      status: 'AVAILABLE',
    };

  const [selectedAuthType, setSelectedAuthType] = useState<AuthType>(() => {
    if (currentProvider.supportedAuth.includes('server_environment')) {
      return 'server_environment';
    }
    return currentProvider.supportedAuth[0] || 'api_key';
  });

  const [apiKey, setApiKey] = useState('');
  const [customEndpointUrl, setCustomEndpointUrl] = useState(currentProvider.customEndpointUrl || '');
  const [friendlyDesc, setFriendlyDesc] = useState('');
  const [customCapabilities, setCustomCapabilities] = useState(
    (currentProvider.capabilities || ['Reasoning', 'Code Analysis', 'Workflow Execution']).join(', ')
  );

  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  useEffect(() => {
    setVerificationError(null);
    setVerificationSuccess(false);
    if (currentProvider.supportedAuth.includes('server_environment')) {
      setSelectedAuthType('server_environment');
    } else if (currentProvider.supportedAuth.includes('api_key')) {
      setSelectedAuthType('api_key');
    } else if (currentProvider.supportedAuth.includes('google_oauth')) {
      setSelectedAuthType('google_oauth');
    } else {
      setSelectedAuthType(currentProvider.supportedAuth[0] || 'api_key');
    }

    if (currentProvider.capabilities) {
      setCustomCapabilities(currentProvider.capabilities.join(', '));
    }
    if (currentProvider.customEndpointUrl) {
      setCustomEndpointUrl(currentProvider.customEndpointUrl);
    }
  }, [selectedProviderId]);

  if (!isOpen) return null;

  const peekNumber = peekNextSequentialNumber(currentProvider.id);
  const previewCanonicalName = generateCanonicalName(currentProvider.name, peekNumber);

  const isUnsupportedProvider = currentProvider.status === 'NOT_SUPPORTED';

  const handleProviderChange = (provId: string) => {
    setSelectedProviderId(provId);
    setApiKey('');
    setVerificationError(null);
    setVerificationSuccess(false);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationError(null);
    setIsVerifying(true);

    if (isUnsupportedProvider) {
      setIsVerifying(false);
      setVerificationError(
        `Connection method not currently supported for provider "${currentProvider.name}". No active adapter is available.`
      );
      return;
    }

    if (selectedAuthType === 'google_oauth') {
      setIsVerifying(false);
      setVerificationError('Google sign-in requires OAuth configuration.');
      return;
    }

    if (selectedAuthType === 'provider_session') {
      setIsVerifying(false);
      setVerificationError(
        'Connection method not currently supported in this environment (requires OAuth Client ID configuration).'
      );
      return;
    }

    const caps = customCapabilities
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const result = await connectAccount({
        providerId: currentProvider.id,
        authType: selectedAuthType,
        apiKey: apiKey.trim() || undefined,
        customEndpointUrl: customEndpointUrl.trim() || undefined,
        friendlyDescription: friendlyDesc.trim() || undefined,
        capabilities: caps.length > 0 ? caps : undefined,
      });

      if (!result.success) {
        setVerificationError(
          result.error || 'Connection failed: invalid credentials or unreachable endpoint.'
        );
        setIsVerifying(false);
        return;
      }

      setVerificationSuccess(true);
      setTimeout(() => {
        setIsVerifying(false);
        setVerificationSuccess(false);
        onClose();
      }, 700);
    } catch (err: any) {
      setVerificationError(err?.message || 'Unexpected connection error occurred.');
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Account Onboarding
            </div>
            <h3 className="text-sm font-semibold text-slate-900">
              Connect Account: {currentProvider.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConnect} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Provider Selection Carousel */}
          <div>
            <label className="block font-medium text-slate-700 mb-1.5">
              Target AI Provider
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {providers.map((p) => {
                const isSelected = p.id === selectedProviderId;
                const isUnsupp = p.status === 'NOT_SUPPORTED';
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderChange(p.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'
                    }`}
                  >
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className={`text-[10px] truncate ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                      {p.vendor}
                    </div>
                    {isUnsupp && (
                      <span className={`text-[9px] px-1 py-0.2 rounded mt-1 inline-block ${
                        isSelected ? 'bg-slate-800 text-amber-300' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        Not Supported
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Canonical Identity Notice */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-semibold text-slate-500 uppercase tracking-wider">
                Permanent Canonical Identity
              </span>
              <span className="text-slate-400 text-[10px]">Sequential (Never reused)</span>
            </div>
            <div className="font-mono text-sm font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-slate-600" />
              <span>{previewCanonicalName}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">
              Assigned strictly sequentially. Historical messages will preserve this identity even if
              disconnected.
            </p>
          </div>

          {/* Provider Status Warning if Unsupported */}
          {isUnsupportedProvider ? (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5 text-amber-800">
              <div className="font-semibold flex items-center gap-1.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Connection method not currently supported</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-700">
                No active adapter is currently implemented for <strong>{currentProvider.name}</strong>.
                The application does not simulate or pretend connections work without legitimate
                infrastructure.
              </p>
            </div>
          ) : (
            /* Authentication Mechanism Selection */
            <div>
              <label className="block font-medium text-slate-700 mb-1.5">
                Authentication Method
              </label>
              <div className="space-y-2">
                {/* 1. Server Environment Key */}
                {currentProvider.supportedAuth.includes('server_environment') && (
                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      selectedAuthType === 'server_environment'
                        ? 'border-slate-900 bg-slate-50 text-slate-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="authType"
                      value="server_environment"
                      checked={selectedAuthType === 'server_environment'}
                      onChange={() => setSelectedAuthType('server_environment')}
                      className="mt-0.5 text-slate-900"
                    />
                    <div>
                      <div className="font-semibold flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-slate-600" />
                        <span>Server Environment Secret (GEMINI_API_KEY)</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Uses runtime secret injected into the environment. Verified live with Gemini API.
                      </div>
                    </div>
                  </label>
                )}

                {/* 2. Google OAuth / Sign-in */}
                {currentProvider.supportedAuth.includes('google_oauth') && (
                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      selectedAuthType === 'google_oauth'
                        ? 'border-slate-900 bg-slate-50 text-slate-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="authType"
                      value="google_oauth"
                      checked={selectedAuthType === 'google_oauth'}
                      onChange={() => setSelectedAuthType('google_oauth')}
                      className="mt-0.5 text-slate-900"
                    />
                    <div className="flex-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <LogIn className="w-3.5 h-3.5 text-slate-600" />
                        <span>Google Sign-In / OAuth</span>
                      </div>
                      <div className="text-[11px] text-amber-700 bg-amber-50/70 p-1.5 rounded mt-1 border border-amber-200/60 flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                        <span>Google sign-in requires OAuth configuration.</span>
                      </div>
                    </div>
                  </label>
                )}

                {/* 3. Provider Session / OAuth */}
                {currentProvider.supportedAuth.includes('provider_session') && (
                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      selectedAuthType === 'provider_session'
                        ? 'border-slate-900 bg-slate-50 text-slate-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="authType"
                      value="provider_session"
                      checked={selectedAuthType === 'provider_session'}
                      onChange={() => setSelectedAuthType('provider_session')}
                      className="mt-0.5 text-slate-900"
                    />
                    <div className="flex-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <LogIn className="w-3.5 h-3.5 text-slate-600" />
                        <span>Provider OAuth / SSO Session</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Connection method not currently supported in this environment (requires OAuth Client ID).
                      </div>
                    </div>
                  </label>
                )}

                {/* 4. API Key (Optional / Direct) */}
                {currentProvider.supportedAuth.includes('api_key') && (
                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      selectedAuthType === 'api_key'
                        ? 'border-slate-900 bg-slate-50 text-slate-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="authType"
                      value="api_key"
                      checked={selectedAuthType === 'api_key'}
                      onChange={() => setSelectedAuthType('api_key')}
                      className="mt-0.5 text-slate-900"
                    />
                    <div>
                      <div className="font-semibold flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-slate-600" />
                        <span>API Key / Bearer Token (Optional)</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Direct provider API key verified live against the provider endpoint before connecting.
                      </div>
                    </div>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* API Key Input Field */}
          {selectedAuthType === 'api_key' && !isUnsupportedProvider && (
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                {currentProvider.name} API Key
              </label>
              <input
                type="password"
                required
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setVerificationError(null);
                }}
                placeholder={
                  currentProvider.id === 'chatgpt'
                    ? 'sk-...'
                    : currentProvider.id === 'claude'
                    ? 'sk-ant-...'
                    : currentProvider.id === 'grok'
                    ? 'xai-...'
                    : 'Enter API key...'
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
              <div className="text-[10px] text-slate-400 mt-1">
                API keys are tested live via provider adapter. Invalid keys will be rejected.
              </div>
            </div>
          )}

          {/* Optional Friendly Role */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Role / Working Specialization (Optional)
            </label>
            <input
              type="text"
              value={friendlyDesc}
              onChange={(e) => setFriendlyDesc(e.target.value)}
              placeholder="e.g. Lead Architect, Verification Specialist"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </div>

          {/* Capabilities */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Capabilities (Comma-separated)
            </label>
            <input
              type="text"
              value={customCapabilities}
              onChange={(e) => setCustomCapabilities(e.target.value)}
              placeholder="e.g. Architecture, Code Synthesis, Verification"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </div>

          {/* Honest Error Display */}
          {verificationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-red-700">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div>
                <div className="font-semibold text-xs">Connection Verification Failed</div>
                <div className="text-[11px] mt-0.5 leading-relaxed">{verificationError}</div>
                <div className="text-[10px] text-red-500 mt-1">
                  Account will NOT be marked connected without authentic verification.
                </div>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {verificationSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-emerald-800">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <div className="font-semibold text-xs">Verified and Connected Successfully</div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isVerifying}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isVerifying || isUnsupportedProvider}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-2"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : isUnsupportedProvider ? (
                <span>Not Supported</span>
              ) : (
                <span>Verify & Connect</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
