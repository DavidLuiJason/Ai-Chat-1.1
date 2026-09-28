import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { AIAccount, Provider } from '../../types/index.ts';
import {
  Cpu,
  Plus,
  Trash2,
  Activity,
  MessageSquare,
  Key,
  Server,
  Layers,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  LogIn,
} from 'lucide-react';

interface AiToolsViewProps {
  onOpenAddAccount: (providerId?: string) => void;
  onOpenAddProvider?: () => void;
}

export const AiToolsView: React.FC<AiToolsViewProps> = ({
  onOpenAddAccount,
  onOpenAddProvider,
}) => {
  const {
    providers,
    accounts,
    removeAccount,
    removeProvider,
    runAvailabilityCheck,
    setDirectChatAccountId,
    setActiveNav,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'providers' | 'accounts'>('providers');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    accounts[0]?.id || null
  );
  const [testingAccountId, setTestingAccountId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    accountId: string;
    isOperational: boolean;
    latencyMs: number;
    details: string;
  } | null>(null);

  const connectedAccounts = accounts.filter((a) => a.connectionStatus === 'CONNECTED');

  const handleTestAvailability = async (account: AIAccount) => {
    setTestingAccountId(account.id);
    setTestResult(null);
    try {
      const result = await runAvailabilityCheck(account.id, '');
      setTestResult({
        accountId: account.id,
        isOperational: result.isOperational,
        latencyMs: result.latencyMs,
        details: result.details,
      });
    } catch (err: any) {
      setTestResult({
        accountId: account.id,
        isOperational: false,
        latencyMs: 0,
        details: err?.message || 'Availability test failed',
      });
    } finally {
      setTestingAccountId(null);
    }
  };

  const handleStartDirectChat = (accId: string) => {
    setDirectChatAccountId(accId);
    setActiveNav('direct-chats');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/40">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 shrink-0 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
            Fleet Architecture
          </div>
          <h1 className="text-base font-bold text-slate-900">AI Tools & Connected Accounts</h1>
        </div>

        <div className="flex items-center gap-2">
          {onOpenAddProvider && (
            <button
              onClick={onOpenAddProvider}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-slate-500" />
              <span>+ Add AI Tool</span>
            </button>
          )}

          <button
            onClick={() => onOpenAddAccount()}
            className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Connect Account</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 flex gap-4 text-xs shrink-0">
        <button
          onClick={() => setActiveTab('providers')}
          className={`py-2.5 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'providers'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Available Providers</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
            {providers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('accounts')}
          className={`py-2.5 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'accounts'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Connected Accounts</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
            {accounts.length}
          </span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {activeTab === 'providers' ? (
          /* Available Providers Section */
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-slate-900 mb-0.5">
                  Extensible Provider Catalog
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Providers in this catalog define supported models and connection adapters.
                  Connecting an account requires legitimate authentication and creates an isolated,
                  sequentially numbered account instance.
                </p>
              </div>

              {onOpenAddProvider && (
                <button
                  onClick={onOpenAddProvider}
                  className="px-3 py-1.5 shrink-0 ml-4 text-xs font-medium text-slate-800 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add AI Tool</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {providers.map((prov) => {
                const accountsUnderProvider = accounts.filter(
                  (a) => a.providerId === prov.id && !a.isRemoved
                );
                const isUnsupported = prov.status === 'NOT_SUPPORTED';

                return (
                  <div
                    key={prov.id}
                    className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{prov.name}</span>
                            {prov.isCustom && (
                              <span className="text-[9px] px-1 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                                Custom
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">{prov.vendor}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
                              isUnsupported
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            {isUnsupported ? 'Not Supported' : 'Available'}
                          </span>

                          {prov.isCustom && (
                            <button
                              onClick={() => {
                                if (confirm(`Remove custom provider "${prov.name}" from catalog?`)) {
                                  removeProvider(prov.id);
                                }
                              }}
                              className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 cursor-pointer"
                              title="Remove Provider"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 leading-normal">
                        {prov.description}
                      </p>

                      {/* Connection Methods & Status */}
                      <div className="space-y-1 text-[11px] pt-1">
                        <div className="text-slate-500 font-medium flex items-center justify-between">
                          <span>Supported Connection Methods:</span>
                          <span className="font-mono text-slate-400 text-[10px]">
                            {accountsUnderProvider.length} active account
                            {accountsUnderProvider.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {prov.connectionMethods && prov.connectionMethods.length > 0 ? (
                            prov.connectionMethods.map((cm) => (
                              <span
                                key={cm.id}
                                className={`px-2 py-0.5 rounded text-[10px] border flex items-center gap-1 ${
                                  cm.isAvailable
                                    ? 'bg-slate-50 text-slate-700 border-slate-200'
                                    : 'bg-amber-50/60 text-amber-800 border-amber-200/80'
                                }`}
                                title={cm.configNotice || cm.description}
                              >
                                <span>{cm.name}</span>
                                {cm.requiresConfig && (
                                  <span className="text-[9px] text-amber-600">(Requires Config)</span>
                                )}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              {prov.supportedAuth.join(' · ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        {isUnsupported
                          ? 'Connection method not currently supported'
                          : prov.adapterType === 'google_genai'
                          ? 'Google GenAI SDK Adapter'
                          : prov.adapterType === 'openai_adapter'
                          ? 'OpenAI Endpoint Adapter'
                          : prov.adapterType === 'anthropic_adapter'
                          ? 'Anthropic Endpoint Adapter'
                          : 'Standard Provider Adapter'}
                      </span>

                      <button
                        onClick={() => onOpenAddAccount(prov.id)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1 ${
                          isUnsupported
                            ? 'text-slate-500 hover:text-slate-700 bg-slate-100'
                            : 'text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <span>Connect</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Connected Accounts Section */
          accounts.length === 0 ? (
            <div className="max-w-md mx-auto text-center py-12 px-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">No Connected AI Accounts</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Connect an AI account using real provider credentials. Account identities are strictly
                sequential (e.g. <code>ChatGPT 1</code>, <code>Google AI Studio 1</code>) and numbers
                are never reused even if accounts are removed.
              </p>
              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  onClick={() => onOpenAddAccount()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  Connect Your First Account
                </button>
                <button
                  onClick={() => setActiveTab('providers')}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  View Providers
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {accounts.map((acc) => {
                  const prov = providers.find((p) => p.id === acc.providerId);
                  const isTesting = testingAccountId === acc.id;
                  const isSelected = selectedAccountId === acc.id;

                  return (
                    <div
                      key={acc.id}
                      onClick={() => setSelectedAccountId(acc.id)}
                      className={`p-4 bg-white rounded-xl border transition-all cursor-pointer space-y-3 ${
                        isSelected
                          ? 'border-slate-900 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-mono text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <Cpu className="w-3.5 h-3.5 text-slate-500" />
                            <span>{acc.canonicalName}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {prov?.name || acc.providerId} · Account #{acc.identityNumber}
                          </div>
                        </div>

                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                            acc.connectionStatus === 'CONNECTED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {acc.connectionStatus}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 line-clamp-2">
                        {acc.friendlyDescription || 'General workforce agent'}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {acc.capabilities.map((cap, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestAvailability(acc);
                          }}
                          disabled={isTesting}
                          className="text-[11px] font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer disabled:text-slate-300"
                        >
                          <Activity
                            className={`w-3 h-3 ${isTesting ? 'animate-pulse text-amber-500' : ''}`}
                          />
                          <span>{isTesting ? 'Pinging...' : 'Test Ping'}</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartDirectChat(acc.id);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-900 rounded hover:bg-slate-100 cursor-pointer"
                            title="Direct Chat"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                confirm(
                                  `Disconnect and remove ${acc.canonicalName}? Complete history will be preserved as "${acc.canonicalName} [Account removed]".`
                                )
                              ) {
                                removeAccount(acc.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer"
                            title="Disconnect Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Inline test result */}
                      {testResult && testResult.accountId === acc.id && (
                        <div
                          className={`p-2 rounded text-[11px] border ${
                            testResult.isOperational
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-red-50 text-red-800 border-red-200'
                          }`}
                        >
                          <div className="font-semibold">
                            {testResult.isOperational ? 'Ping Succeeded' : 'Ping Failed'} (
                            {testResult.latencyMs}ms)
                          </div>
                          <div className="text-[10px] mt-0.5">{testResult.details}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
