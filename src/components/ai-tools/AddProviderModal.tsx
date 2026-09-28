import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { Provider, ProviderAdapterType, ConnectionMethodType, ConnectionMethod } from '../../types/index.ts';
import { X, Layers, Cpu, Check, AlertCircle } from 'lucide-react';

interface AddProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddProviderModal: React.FC<AddProviderModalProps> = ({ isOpen, onClose }) => {
  const { addProvider } = useApp();

  const [name, setName] = useState('');
  const [vendor, setVendor] = useState('');
  const [description, setDescription] = useState('');
  const [adapterType, setAdapterType] = useState<ProviderAdapterType>('unsupported');
  const [customEndpointUrl, setCustomEndpointUrl] = useState('');
  const [selectedMethods, setSelectedMethods] = useState<ConnectionMethodType[]>(['api_key']);
  const [capabilities, setCapabilities] = useState('Reasoning, Code Synthesis, Analysis');

  if (!isOpen) return null;

  const handleToggleMethod = (method: ConnectionMethodType) => {
    if (selectedMethods.includes(method)) {
      setSelectedMethods(selectedMethods.filter((m) => m !== method));
    } else {
      setSelectedMethods([...selectedMethods, method]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const provId = `prov-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    const caps = capabilities
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const isCustomEndpoint = adapterType === 'custom_endpoint' && customEndpointUrl.trim().length > 0;
    const resolvedAdapterType: ProviderAdapterType = isCustomEndpoint ? 'custom_endpoint' : 'unsupported';
    const status = isCustomEndpoint ? 'AVAILABLE' : 'NOT_SUPPORTED';

    const connectionMethods: ConnectionMethod[] = selectedMethods.map((type) => {
      if (type === 'api_key') {
        return {
          id: `method-${type}`,
          type,
          name: `${name.trim()} API Key`,
          description: `Direct credential for ${name.trim()}`,
          isAvailable: isCustomEndpoint,
          availabilityDetails: isCustomEndpoint ? 'Live custom endpoint check' : 'Connection method not currently supported',
          configNotice: isCustomEndpoint ? undefined : 'Adapter not currently implemented for this provider.',
        };
      }
      if (type === 'provider_oauth' || type === 'google_oauth') {
        return {
          id: `method-${type}`,
          type,
          name: `${name.trim()} OAuth / SSO`,
          description: `Single sign-on connection with ${name.trim()}`,
          isAvailable: false,
          requiresConfig: true,
          configNotice: 'Connection method not currently supported in this environment.',
        };
      }
      return {
        id: `method-${type}`,
        type,
        name: `${name.trim()} Session`,
        description: `Session-based authentication for ${name.trim()}`,
        isAvailable: false,
        requiresConfig: true,
        configNotice: 'Connection method not currently supported.',
      };
    });

    const newProvider: Provider = {
      id: provId,
      name: name.trim(),
      vendor: vendor.trim() || 'Independent AI Provider',
      description:
        description.trim() ||
        `${name.trim()} integration registered in the extensible provider catalog.`,
      adapterType: resolvedAdapterType,
      supportedModes: ['api', 'external'],
      supportedAuth: selectedMethods.map((m) => (m === 'provider_oauth' ? 'provider_session' : m as any)),
      connectionMethods,
      iconKey: 'custom',
      authInstructions:
        resolvedAdapterType === 'unsupported'
          ? 'Connection method not currently supported for this provider.'
          : 'Connect via custom endpoint API key.',
      capabilities: caps.length > 0 ? caps : ['General Analysis'],
      isCustom: true,
      customEndpointUrl: isCustomEndpoint ? customEndpointUrl.trim() : undefined,
      status,
      statusDetails:
        status === 'NOT_SUPPORTED'
          ? 'Connection method not currently supported'
          : 'Ready for endpoint connection',
    };

    addProvider(newProvider);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Extensible Catalog
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Add AI Tool / Provider Definition</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-lg flex items-start gap-2 text-blue-800">
            <Layers className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              Adding a provider registers a <strong>provider definition</strong> in the catalog. It does
              <strong> not</strong> create an account. Accounts exist only after real authentication.
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Provider / Model Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mistral Large, DeepSeek R1, Llama 3.3"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Vendor / Organization
            </label>
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="e.g. Mistral AI, DeepSeek, Meta"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the model architecture, strengths, and intended role."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1.5">
              Provider Adapter / Integration Mode
            </label>
            <div className="space-y-2">
              <label
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  adapterType === 'unsupported'
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="adapterType"
                  value="unsupported"
                  checked={adapterType === 'unsupported'}
                  onChange={() => setAdapterType('unsupported')}
                  className="mt-0.5 text-slate-900"
                />
                <div>
                  <div className="font-semibold text-slate-900">
                    Catalog Entry (Adapter Not Yet Implemented)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Will appear in catalog as <code>Not Supported</code>. Prevents fake connections
                    and clearly communicates integration state.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  adapterType === 'custom_endpoint'
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="adapterType"
                  value="custom_endpoint"
                  checked={adapterType === 'custom_endpoint'}
                  onChange={() => setAdapterType('custom_endpoint')}
                  className="mt-0.5 text-slate-900"
                />
                <div>
                  <div className="font-semibold text-slate-900">Custom HTTP / REST Endpoint</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Live verification against a specified API endpoint URL.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {adapterType === 'custom_endpoint' && (
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Custom Endpoint URL
              </label>
              <input
                type="url"
                required
                value={customEndpointUrl}
                onChange={(e) => setCustomEndpointUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>
          )}

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Supported Connection Methods
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'api_key', label: 'API Key' },
                { id: 'provider_oauth', label: 'OAuth / Single Sign-On' },
                { id: 'session_auth', label: 'Browser Session' },
              ].map((m) => {
                const isChecked = selectedMethods.includes(m.id as ConnectionMethodType);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleToggleMethod(m.id as ConnectionMethodType)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isChecked
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3" />}
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Declared Capabilities (Comma-separated)
            </label>
            <input
              type="text"
              value={capabilities}
              onChange={(e) => setCapabilities(e.target.value)}
              placeholder="e.g. Reasoning, Code Synthesis, Analysis"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Save Provider Definition</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
