import { Terminal, X } from 'lucide-react';

export interface HandshakeLog {
  id: string;
  timestamp: string;
  direction: 'in' | 'out';
  type: string;
  payload: any;
}

interface BridgeLogsConsoleProps {
  logs: HandshakeLog[];
  onClearLogs: () => void;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}

export function BridgeLogsConsole({
  logs,
  onClearLogs,
  isOpen,
  onToggle
}: BridgeLogsConsoleProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {isOpen ? (
        <div className="w-[380px] h-[400px] bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="px-4 py-3 bg-slate-950 border-b border-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Terminal className="size-4 text-sky-500 animate-pulse" />
              <span className="text-xs font-bold tracking-tight">Bridge Handshake Monitor</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={onClearLogs}
                className="px-2 py-0.5 rounded text-[10px] text-slate-400 hover:text-white hover:bg-slate-800/60 bg-transparent border-0 cursor-pointer font-semibold transition-all"
                title="Clear logs"
              >
                Clear
              </button>
              <button
                onClick={() => onToggle(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 bg-transparent border-0 cursor-pointer transition-all"
                title="Close console"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 p-3 overflow-y-auto font-mono text-[10px] flex flex-col gap-2 bg-slate-950/80">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center gap-2">
                <Terminal className="size-6 opacity-30 text-sky-500" />
                <span className="font-semibold">No packets exchanged yet.</span>
                <span className="text-[9px] max-w-[220px] opacity-80 leading-normal">
                  Try installing, pinning, or uninstalling a command to trigger messages.
                </span>
              </div>
            ) : (
              logs.map((log) => {
                const isOut = log.direction === 'out';
                return (
                  <div key={log.id} className="p-2 rounded bg-slate-900/60 border border-slate-800/40 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[9px]">
                      <span className={`font-bold uppercase tracking-wider px-1 py-0.2 rounded ${
                        isOut ? 'bg-sky-500/10 text-sky-400' : 'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {isOut ? '→ Sent' : '← Received'}
                      </span>
                      <span className="text-slate-500">{log.timestamp}</span>
                    </div>
                    <div className="text-slate-300 font-semibold truncate" title={log.type}>
                      {log.type}
                    </div>
                    <pre className="text-slate-500 text-[9px] overflow-x-auto max-h-[80px] p-1 bg-slate-950/40 rounded border border-slate-900">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
