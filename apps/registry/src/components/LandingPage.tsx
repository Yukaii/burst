import { useState, useEffect } from 'react';
import type { BurstCommand } from '@/src/lib/commands';
import {
  RegistryAuthConfig,
  RegistrySessionUser,
  getRegistryCommands,
  registryCommandsData,
  getMockScriptCode,
  getAuditReport,
  AuditReport,
} from '@/src/lib/registryApi';
import logoUrl from '@/assets/logo.svg';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Github } from './icons';
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  GitFork,
  Info,
  PackageCheck,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  Play,
  Check,
  Cpu,
  FileCode,
  ExternalLink,
  Eye,
  AlertTriangle,
  ChevronRight,
  X,
  Lock,
  Users,
  Sun,
  Moon
} from 'lucide-react';

const trustCopy: Record<BurstCommand['trustLevel'], string> = {
  verified: 'Verified',
  reviewed: 'Reviewed',
  community: 'Community',
  local: 'Local',
};

interface LandingPageProps {
  authLoading?: boolean;
  authConfig: RegistryAuthConfig | null;
  currentUser: RegistrySessionUser;
  onGitHubLogin: () => void | Promise<void>;
  onLogout: () => void | Promise<void>;
  onGoToDashboard: () => void;
  theme?: 'light' | 'dark';
  onThemeChange?: (theme: 'light' | 'dark') => void;
}

export function LandingPage({
  authLoading = false,
  authConfig,
  currentUser,
  onGitHubLogin,
  onLogout,
  onGoToDashboard,
  theme = 'dark',
  onThemeChange,
}: LandingPageProps) {
  const githubEnabled = authConfig?.githubEnabled ?? false;
  const isGuest = currentUser.handle === 'guest';
  const [commands, setCommands] = useState<BurstCommand[]>(registryCommandsData);
  const [activeIndex, setActiveIndex] = useState(0);

  // Hero Simulator State
  const [mockAddress, setMockAddress] = useState('github.com/facebook/react');
  const [simulatedQuery, setSimulatedQuery] = useState('');
  const [activeSimulatedIndex, setActiveSimulatedIndex] = useState(0);
  const [isSimulatedPaletteOpen, setIsSimulatedPaletteOpen] = useState(true);
  const [simulatedToast, setSimulatedToast] = useState<string | null>(null);
  const [simulatedToastType, setSimulatedToastType] = useState<'success' | 'info'>('success');
  const [simulatedClipboard, setSimulatedClipboard] = useState<string | null>(null);

  // Sandbox Sandbox State
  const [sandboxTab, setSandboxTab] = useState<'code' | 'sandbox'>('code');
  const [sandboxLogs, setSandboxLogs] = useState<string[]>([
    '// Click "Run Command in Sandbox" to trigger compilation and execution...'
  ]);
  const [isSandboxRunning, setIsSandboxRunning] = useState(false);
  const [sandboxSuccessToast, setSandboxSuccessToast] = useState<string | null>(null);

  // Manifest / Audit Inspector modal
  const [inspectingCommand, setInspectingCommand] = useState<BurstCommand | null>(null);
  const [inspectingAudit, setInspectingAudit] = useState<AuditReport | null>(null);
  const [inspectTab, setInspectTab] = useState<'audit' | 'manifest'>('audit');
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Catalog filtering states
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState<'all' | 'verified' | 'all_urls'>('all');

  useEffect(() => {
    let active = true;

    async function loadCommands() {
      try {
        const results = await getRegistryCommands();
        if (active && results.length > 0) {
          setCommands(results);
        }
      } catch (error) {
        console.error('Failed to load landing registry commands:', error);
      }
    }

    void loadCommands();

    return () => {
      active = false;
    };
  }, []);

  const featuredCommands = commands.slice(0, 4);
  const verifiedCount = commands.filter((command) => command.trustLevel === 'verified').length;
  const reviewedCount = commands.filter((command) => command.trustLevel === 'reviewed' || command.trustLevel === 'verified').length;

  // Fetch Audit report when inspecting a command
  useEffect(() => {
    if (!inspectingCommand) {
      setInspectingAudit(null);
      return;
    }
    
    let active = true;
    setLoadingAudit(true);
    
    async function loadAudit() {
      try {
        const audit = await getAuditReport(inspectingCommand.id, inspectingCommand.version || '1.0.0');
        if (active) {
          setInspectingAudit(audit || null);
        }
      } catch (err) {
        console.error('Failed to load audit report in modal:', err);
      } finally {
        if (active) setLoadingAudit(false);
      }
    }
    
    void loadAudit();
    return () => {
      active = false;
    };
  }, [inspectingCommand]);

  // Simulated Commands list for the hero simulator
  const filteredSimulatedCommands = featuredCommands.filter(cmd => {
    if (!simulatedQuery) return true;
    return cmd.title.toLowerCase().includes(simulatedQuery.toLowerCase()) || 
           cmd.description.toLowerCase().includes(simulatedQuery.toLowerCase()) ||
           cmd.website.toLowerCase().includes(simulatedQuery.toLowerCase());
  });

  const triggerMockCommand = (command: BurstCommand) => {
    if (command.id === 'copy-github-branch') {
      setSimulatedToast("Copied branch name 'main' to clipboard!");
      setSimulatedToastType('success');
      setSimulatedClipboard('main');
    } else if (command.id === 'markdown-link-builder') {
      setSimulatedToast("Copied link: [facebook/react](https://github.com/facebook/react)");
      setSimulatedToastType('success');
      setSimulatedClipboard('[facebook/react](https://github.com/facebook/react)');
    } else if (command.id === 'json-formatter-toast') {
      setSimulatedToast("Selected text: Valid JSON string formatted in alert.");
      setSimulatedToastType('success');
      setSimulatedClipboard('{\n  "status": "active"\n}');
    } else {
      setSimulatedToast(`Triggered: ${command.title}`);
      setSimulatedToastType('success');
    }
    
    const timer = setTimeout(() => {
      setSimulatedToast(null);
    }, 3500);
  };

  // Run simulated sandbox execution
  const runSandbox = () => {
    if (isSandboxRunning) return;
    setIsSandboxRunning(true);
    setSandboxLogs([
      '⏱️ [00:00.0] Initializing Burst Sandbox Runtime v1.0...',
    ]);
    setSandboxSuccessToast(null);
    
    const logsSequence = [
      { delay: 400, text: '🔍 [00:00.4] Checking permission requests: ["Read page DOM", "Write clipboard"]' },
      { delay: 800, text: '✅ [00:00.8] Sandbox isolation container spawned' },
      { delay: 1200, text: '🌐 [00:01.2] Loaded mock document context for "github.com/facebook/react"' },
      { delay: 1600, text: '🚀 [00:01.6] Executing copy-github-branch script entrypoint...' },
      { delay: 2000, text: '📋 [00:02.0] API call: navigator.clipboard.writeText("main")' },
      { delay: 2400, text: '💬 [00:02.4] API call: toast.success("Copied branch: main")' },
      { delay: 2800, text: '✨ [00:02.8] Execution complete. Code returned: void.' }
    ];
    
    logsSequence.forEach((item, index) => {
      setTimeout(() => {
        setSandboxLogs(prev => [...prev, item.text]);
        if (index === logsSequence.length - 1) {
          setIsSandboxRunning(false);
          setSandboxSuccessToast("Copied branch: main");
        }
      }, item.delay);
    });
  };

  const getManifestJson = (cmd: BurstCommand) => {
    return JSON.stringify({
      id: cmd.id,
      version: cmd.version || '1.0.0',
      title: cmd.title,
      description: cmd.description,
      matchPatterns: cmd.matchPatterns,
      permissions: cmd.permissions,
      publisher: cmd.publisher.handle,
      sourceUrl: cmd.sourceUrl
    }, null, 2);
  };

  // Filter registry commands for the explorer grid
  const filteredCatalogCommands = commands.filter((cmd) => {
    const searchString = catalogSearch.trim().toLowerCase();
    const matchesSearch = !searchString || [
      cmd.title,
      cmd.description,
      cmd.website,
      cmd.publisher.name,
      cmd.publisher.handle
    ].join(' ').toLowerCase().includes(searchString);

    if (!matchesSearch) return false;

    if (catalogCategory === 'verified') return cmd.trustLevel === 'verified';
    if (catalogCategory === 'all_urls') return cmd.matchPatterns.includes('<all_urls>');
    return true;
  });

  return (
    <div className={`relative h-screen min-h-screen overflow-y-auto bg-background text-foreground transition-colors duration-300 ${theme === 'dark' ? 'dark' : ''}`}>
      
      {/* Background blobs for rich dark mode aesthetics */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] dark:bg-indigo-500/15 animate-float-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[120px] dark:bg-cyan-500/10 animate-float-slow-reverse" />
      </div>

      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-20 px-6 py-6 pb-24">
        
        {/* Navigation Bar */}
        <nav className="flex items-center justify-between gap-4 border-b border-border/40 pb-5">
          <button
            type="button"
            className="flex min-w-0 items-center gap-3 border-0 bg-transparent p-0 text-left text-foreground cursor-pointer disabled:cursor-default"
            onClick={!isGuest ? onGoToDashboard : undefined}
            disabled={isGuest}
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 rounded-lg bg-indigo-500/20 blur-sm scale-110" />
              <img className="relative size-10 rounded-lg object-cover border border-white/10" src={logoUrl} alt="Burst Logo" />
            </div>
            <span className="flex min-w-0 flex-col gap-0.5">
              <strong className="text-sm font-semibold leading-none tracking-tight">Burst</strong>
              <span className="text-xs font-semibold leading-none text-muted-foreground">Registry</span>
            </span>
          </button>

          <div className="flex min-w-0 items-center justify-end gap-2">
            {onThemeChange && (
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
                className="text-muted-foreground hover:text-foreground rounded-lg shrink-0"
                title="Toggle visual theme"
              >
                {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
            )}
            {authLoading ? (
              <span className="text-xs font-medium text-muted-foreground animate-pulse">Checking credentials...</span>
            ) : !isGuest ? (
              <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-card/60 backdrop-blur-md p-1.5 shadow-sm">
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs font-medium bg-indigo-500/10 text-indigo-400">{currentUser.avatarInitials}</AvatarFallback>
                </Avatar>
                <div className="hidden min-w-0 flex-col pr-2 text-left sm:flex">
                  <span className="truncate text-xs font-semibold leading-tight text-foreground">{currentUser.name}</span>
                  <span className="truncate text-[10px] leading-tight text-muted-foreground">
                    {currentUser.handle.startsWith('@') ? currentUser.handle : `@${currentUser.handle}`}
                  </span>
                </div>
                <Button size="sm" onClick={onGoToDashboard}>Dashboard</Button>
                <Button size="sm" variant="ghost" className="hover:bg-destructive/10 hover:text-destructive" onClick={() => void onLogout()}>Log out</Button>
              </div>
            ) : (
              <Button size="default" onClick={() => void onGitHubLogin()} disabled={!githubEnabled} className="px-4 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all gap-2">
                <Github data-icon="inline-start" className="size-4" />
                Sign in with GitHub
              </Button>
            )}
          </div>
        </nav>

        {/* Hero Section */}
        <header className="flex flex-col items-center text-center gap-8 pt-4 animate-fade-in-up">
          <div className="flex flex-col items-center gap-6 max-w-3xl">
            <div className="inline-flex self-center items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-3.5 py-1 text-xs font-semibold text-indigo-500 dark:text-indigo-300">
              <Sparkles className="size-3.5 animate-pulse" />
              <span>Browser Extension Registry</span>
              <span className="h-3 w-[1px] bg-indigo-500/25" />
              <span className="text-[11px] text-muted-foreground">Make every website a palette</span>
            </div>
            
            <div className="flex flex-col gap-4 items-center">
              <h1 className="m-0 text-4xl font-extrabold leading-tight tracking-tight lg:text-6xl text-center">
                Make any website a <br />
                <span className="text-gradient-primary">Command Palette.</span>
              </h1>
              <p className="m-0 max-w-2xl text-base md:text-lg font-medium leading-relaxed text-muted-foreground text-center">
                Burst is a lightweight, local-first browser extension that helps you discover, install, fork, and publish website scripts as search-ready commands. Automate workflows directly in the browser DOM.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {!isGuest ? (
                <Button size="lg" onClick={onGoToDashboard} className="shadow-md bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-[1.02] transition-all">
                  Go to dashboard
                  <ArrowRight data-icon="inline-end" className="size-4" />
                </Button>
              ) : (
                <Button size="lg" onClick={() => void onGitHubLogin()} disabled={!githubEnabled || authLoading} className="shadow-md bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-[1.02] transition-all">
                  <Github data-icon="inline-start" />
                  Start with GitHub
                </Button>
              )}
              <Button size="lg" variant="outline" href="#catalog" className="hover:scale-[1.02] transition-all" onClick={(e) => {
                e.preventDefault();
                document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                Explore catalog
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>

            {isGuest && !githubEnabled && (
              <p className="m-0 flex items-center justify-center gap-2 text-xs font-medium text-amber-500 dark:text-amber-400">
                <Info className="size-4 shrink-0" />
                GitHub login is disabled. Explorable as Guest.
              </p>
            )}

            {/* Quick Metrics */}
            <div className="grid max-w-lg w-full grid-cols-3 gap-4 pt-6 justify-center border-t border-border/40">
              <div className="rounded-xl border border-border bg-card/40 p-3.5 backdrop-blur-sm">
                <span className="block text-xl font-bold leading-none text-indigo-500 dark:text-indigo-400">{commands.length}</span>
                <span className="mt-1 block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Commands</span>
              </div>
              <div className="rounded-xl border border-border bg-card/40 p-3.5 backdrop-blur-sm">
                <span className="block text-xl font-bold leading-none text-emerald-500 dark:text-emerald-400">{verifiedCount}</span>
                <span className="mt-1 block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Verified</span>
              </div>
              <div className="rounded-xl border border-border bg-card/40 p-3.5 backdrop-blur-sm">
                <span className="block text-xl font-bold leading-none text-sky-500 dark:text-sky-400">{reviewedCount}</span>
                <span className="mt-1 block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Audited</span>
              </div>
            </div>
          </div>

          {/* Interactive Browser + Palette Mockup */}
          <div className="relative w-full max-w-4xl rounded-2xl border border-border/80 bg-zinc-950/80 shadow-2xl p-0.5 backdrop-blur-sm overflow-hidden group mt-6 select-none">
            {/* Glossy overlay effect */}
            <div className="absolute inset-0 bg-linear-to-tr from-indigo-500/5 to-cyan-500/5 pointer-events-none" />
            
            {/* macOS window border header */}
            <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-red-500/80" />
                <div className="size-3 rounded-full bg-yellow-500/80" />
                <div className="size-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex h-6 w-52 items-center justify-center rounded bg-zinc-950 px-2 text-[11px] font-medium text-zinc-400 border border-zinc-800 select-none">
                <Search className="size-3 mr-1.5 text-zinc-500" />
                {mockAddress}
              </div>
              <div className="w-12" /> {/* spacer */}
            </div>

            {/* Browser Content Area */}
            <div className="relative min-h-[460px] bg-zinc-900/50 p-5 text-left font-sans text-xs text-zinc-300">
              
              {/* GitHub Mock Webpage Design */}
              <div className="flex flex-col gap-4 border border-zinc-800 bg-zinc-900/80 rounded-lg p-4 select-none opacity-50 transition-opacity group-hover:opacity-60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono text-zinc-400">
                    <span className="text-zinc-500">facebook</span>
                    <span>/</span>
                    <strong className="text-zinc-200">react</strong>
                    <span className="rounded-full border border-zinc-700 bg-zinc-800 px-1.5 text-[10px] text-zinc-400">Public</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px]">⭐ Star 220k</div>
                    <div className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px]">🍴 Fork 45k</div>
                  </div>
                </div>
                <p className="text-zinc-400 m-0 leading-normal">The library for web and native user interfaces.</p>
                <div className="flex items-center gap-2 border-t border-zinc-800/60 pt-3">
                  <span className="rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300 flex items-center gap-1.5">
                    <GitFork className="size-3" />
                    main
                  </span>
                  <span className="text-[11px] text-zinc-500">Latest commit 2 hours ago</span>
                </div>
              </div>

              {/* Command Palette Overlay Overlay */}
              {isSimulatedPaletteOpen && (
                <div className="absolute inset-x-8 top-12 rounded-xl border border-zinc-800 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-md animate-fade-in-up">
                  <div className="flex h-10 items-center justify-between border-b border-zinc-800 px-2 pb-2">
                    <div className="flex items-center gap-2 flex-1">
                      <Search className="size-4 text-indigo-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Search commands for github.com..."
                        value={simulatedQuery}
                        onChange={(e) => setSimulatedQuery(e.target.value)}
                        className="w-full border-0 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden focus:ring-0"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[9px] text-zinc-500">
                      <span>ESC</span>
                    </div>
                  </div>

                  {/* Commands listing inside simulated palette */}
                  <div className="mt-2 flex flex-col gap-1 max-h-[190px] overflow-y-auto pr-1">
                    {filteredSimulatedCommands.length > 0 ? (
                      filteredSimulatedCommands.map((cmd, index) => {
                        const isActive = index === activeSimulatedIndex;
                        return (
                          <button
                            key={cmd.id}
                            type="button"
                            onClick={() => {
                              setActiveSimulatedIndex(index);
                              triggerMockCommand(cmd);
                            }}
                            className={`flex items-center justify-between rounded-lg p-2.5 text-left border border-transparent transition-all cursor-pointer ${isActive ? 'bg-indigo-600/20 border-indigo-500/30 text-white' : 'bg-transparent text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'}`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="flex size-7 shrink-0 items-center justify-center rounded bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-300">
                                {cmd.publisher.avatarInitials}
                              </span>
                              <div className="min-w-0 flex-1">
                                <strong className="block text-xs font-semibold leading-normal">{cmd.title}</strong>
                                <span className="block text-[10px] text-zinc-500 truncate">{cmd.description}</span>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-zinc-500 font-medium shrink-0 ml-2">github.com</span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="py-4 text-center text-xs text-zinc-500">No matching commands found.</div>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between border-t border-zinc-900 pt-2 px-1 text-[10px] text-zinc-500">
                    <span>↑↓ to navigate, Enter to run</span>
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="size-3 text-indigo-400" />
                      Manifest Audited
                    </span>
                  </div>
                </div>
              )}

              {/* Toggle palette trigger inside mockup */}
              {!isSimulatedPaletteOpen && (
                <button
                  type="button"
                  onClick={() => setIsSimulatedPaletteOpen(true)}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-indigo-500 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Terminal className="size-3.5" />
                  Open Command Palette
                </button>
              )}

              {/* Close palette helper inside mockup */}
              {isSimulatedPaletteOpen && (
                <button
                  type="button"
                  onClick={() => setIsSimulatedPaletteOpen(false)}
                  className="absolute bottom-4 right-4 flex items-center justify-center size-6 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 cursor-pointer"
                  title="Close simulator palette"
                >
                  <X className="size-3.5" />
                </button>
              )}

              {/* Clipboard indicator inside mockup */}
              {simulatedClipboard && (
                <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg bg-zinc-950 border border-zinc-800/80 p-2 text-[10px] font-mono text-zinc-400">
                  <Check className="size-3 text-indigo-400" />
                  <span>Clipboard: <code>"{simulatedClipboard}"</code></span>
                </div>
              )}

              {/* Simulated Toast inside mockup */}
              {simulatedToast && (
                <div className="absolute right-4 top-16 z-55 flex items-center gap-2.5 rounded-lg border border-indigo-500/30 bg-indigo-950/90 p-3 text-xs text-indigo-300 shadow-2xl backdrop-blur-md animate-fade-in-up">
                  <CheckCircle2 className="size-4 text-indigo-400" />
                  <span>{simulatedToast}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Interactive Sandbox Section */}
        <section className="flex flex-col gap-6 rounded-2xl border border-border/80 bg-card/30 backdrop-blur-md p-6 lg:p-8">
          <div className="flex flex-col gap-2 max-w-2xl text-left">
            <Badge variant="outline" className="self-start text-indigo-500 border-indigo-500/20 bg-indigo-500/5">Command Playground</Badge>
            <h2 className="m-0 text-2xl font-bold tracking-tight lg:text-3xl">Compile & sandbox run custom commands</h2>
            <p className="m-0 text-sm text-muted-foreground leading-relaxed">
              Commands are authored in pure TypeScript and verified before execution. Toggle below to view the command source code or test run it inside the secure browser runtime sandbox.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr] items-stretch mt-3">
            
            {/* Editor Pane (Left) */}
            <div className="flex flex-col rounded-xl border border-border bg-zinc-950/90 shadow-lg overflow-hidden">
              <div className="flex items-center justify-between bg-zinc-900 px-4 py-2 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <FileCode className="size-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-zinc-300">copy-branch.ts</span>
                </div>
                <div className="flex gap-1.5">
                  <button 
                    type="button" 
                    onClick={() => setSandboxTab('code')}
                    className={`rounded px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer ${sandboxTab === 'code' ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Source Code
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setSandboxTab('sandbox')}
                    className={`rounded px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer ${sandboxTab === 'sandbox' ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Console Sandbox
                  </button>
                </div>
              </div>

              <div className="p-4 flex-1 text-left font-mono text-xs overflow-x-auto min-h-[220px]">
                {sandboxTab === 'code' ? (
                  <pre className="text-zinc-400 leading-relaxed leading-6 whitespace-pre">
                    <code>
                      <span className="text-purple-400">export default async function</span> <span className="text-blue-300">run</span>(<span className="text-orange-300">{"{ page, clipboard, toast }"}</span>) {"{"} {"\n"}
                      {"  "}<span className="text-zinc-500">// 1. Select the branch DOM element on GitHub</span>{"\n"}
                      {"  "}<span className="text-purple-400">const</span> branchEl = page.<span className="text-blue-300">querySelector</span>(<span className="text-emerald-300">'.branch-select-menu span'</span>);{"\n"}
                      {"  "}<span className="text-purple-400">const</span> branchName = branchEl?.textContent?.<span className="text-blue-300">trim</span>() || <span className="text-emerald-300">'main'</span>;{"\n"}
                      {"\n"}
                      {"  "}<span className="text-zinc-500">// 2. Copy the parsed value to system clipboard</span>{"\n"}
                      {"  "}<span className="text-purple-400">await</span> clipboard.<span className="text-blue-300">writeText</span>(branchName);{"\n"}
                      {"\n"}
                      {"  "}<span className="text-zinc-500">// 3. Dispatch security-compliant toast alert</span>{"\n"}
                      {"  "}toast.<span className="text-blue-300">success</span>(<span className="text-emerald-300">`Copied branch: ${"{"}branchName{"}"}`</span>);{"\n"}
                      {"}"}
                    </code>
                  </pre>
                ) : (
                  <div className="flex flex-col gap-2 h-full justify-between">
                    <div className="flex-1 flex flex-col gap-1.5 text-zinc-400 overflow-y-auto max-h-[170px] pr-1 scrollbar-thin">
                      {sandboxLogs.map((log, idx) => (
                        <div key={idx} className="leading-5 font-mono text-[11px] border-l-2 border-zinc-800 pl-2">
                          {log}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center border-t border-zinc-900 pt-3">
                      <Button size="sm" onClick={runSandbox} disabled={isSandboxRunning} className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">
                        <Play className="size-3.5 fill-current" />
                        {isSandboxRunning ? 'Running...' : 'Run Command in Sandbox'}
                      </Button>
                      {sandboxSuccessToast && (
                        <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 animate-fade-in-up">
                          <CheckCircle2 className="size-3.5" />
                          Simulated Toast: "{sandboxSuccessToast}"
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sandbox Security Policies (Right) */}
            <div className="flex flex-col rounded-xl border border-border bg-card/60 p-5 text-left justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <strong className="text-sm font-bold text-foreground">Sandbox Security & Capabilities</strong>
                <span className="text-xs text-muted-foreground leading-normal">
                  Commands require permission declarations in their manifest. The browser extension sandbox intercepts API triggers to block unsolicited activities.
                </span>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-lg border border-border/80 bg-background/50 p-2.5">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-indigo-400" />
                    Read Page DOM
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">Read-Only</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/80 bg-background/50 p-2.5">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-indigo-400" />
                    Write System Clipboard
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">Write-Only</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/80 bg-background/50 p-2.5">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-indigo-400" />
                    Display Toast Alerts
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">UI Alert</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/30 bg-background/20 p-2.5 opacity-50">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                    <Lock className="size-4 text-zinc-500" />
                    Outbound Network Connections
                  </span>
                  <span className="text-[10px] font-medium text-destructive uppercase">Blocked</span>
                </div>
              </div>

              <div className="border-t border-border/60 pt-3.5 flex items-center justify-between text-[11px] text-muted-foreground leading-normal">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="size-3.5 text-indigo-400" />
                  Passes strict Static Analysis
                </span>
                <button
                  type="button"
                  onClick={() => setSandboxTab(sandboxTab === 'code' ? 'sandbox' : 'code')}
                  className="text-indigo-500 hover:text-indigo-400 font-semibold cursor-pointer"
                >
                  Toggle view
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Persona/Demographics grid */}
        <section className="flex flex-col gap-10">
          <div className="flex flex-col gap-2 max-w-2xl text-left">
            <Badge variant="outline" className="self-start text-indigo-500 border-indigo-500/20 bg-indigo-500/5">Users & Use Cases</Badge>
            <h2 className="m-0 text-2xl font-bold tracking-tight lg:text-3xl">Built for every builder on the web</h2>
            <p className="m-0 text-sm text-muted-foreground leading-relaxed">
              From individual makers customizing local apps to enterprise teams distributing verified workflows, Burst brings powerful command control to any page.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            
            {/* Persona 1: Developers */}
            <Card className="hover:border-indigo-500/30 hover:shadow-lg transition-all text-left flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex size-10 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/5 text-indigo-500 mb-2">
                  <Cpu className="size-5" />
                </div>
                <CardTitle className="text-base font-bold text-foreground">Developers & Creators</CardTitle>
                <CardDescription className="text-xs">Build lightweight, local-first page automations in TypeScript.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pb-4">
                <ul className="m-0 p-0 pl-4 text-xs text-muted-foreground leading-relaxed flex flex-col gap-1.5 list-disc">
                  <li>Write scoped scripts with modern ESModule standard.</li>
                  <li>Access DOM, selections, clipboard, and notifications.</li>
                  <li>No extension build steps: load local scripts instantly.</li>
                </ul>
              </CardContent>
              <CardFooter className="bg-muted/30 border-t border-border/40 py-3 text-[11px] font-mono text-zinc-500 justify-between">
                <span>CLI Publish toolchain</span>
                <Code2 className="size-3.5 text-zinc-400" />
              </CardFooter>
            </Card>

            {/* Persona 2: Operators */}
            <Card className="hover:border-indigo-500/30 hover:shadow-lg transition-all text-left flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex size-10 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/5 text-indigo-500 mb-2">
                  <Terminal className="size-5" />
                </div>
                <CardTitle className="text-base font-bold text-foreground">Power Users & Operators</CardTitle>
                <CardDescription className="text-xs">Discover handy page shortkeys to replace complex workflows.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pb-4">
                <ul className="m-0 p-0 pl-4 text-xs text-muted-foreground leading-relaxed flex flex-col gap-1.5 list-disc">
                  <li>Domain-matched commands: auto-suggest active site tools.</li>
                  <li>Launch anywhere via global shortcut key.</li>
                  <li>Fork and customize public templates in seconds.</li>
                </ul>
              </CardContent>
              <CardFooter className="bg-muted/30 border-t border-border/40 py-3 text-[11px] font-mono text-zinc-500 justify-between">
                <span>Domain discovery UI</span>
                <Search className="size-3.5 text-zinc-400" />
              </CardFooter>
            </Card>

            {/* Persona 3: Teams */}
            <Card className="hover:border-indigo-500/30 hover:shadow-lg transition-all text-left flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex size-10 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/5 text-indigo-500 mb-2">
                  <Users className="size-5" />
                </div>
                <CardTitle className="text-base font-bold text-foreground">Teams & Organizations</CardTitle>
                <CardDescription className="text-xs">Distribute workspace commands safely under policy control.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pb-4">
                <ul className="m-0 p-0 pl-4 text-xs text-muted-foreground leading-relaxed flex flex-col gap-1.5 list-disc">
                  <li>Verify publisher signatures before page execution.</li>
                  <li>Check cryptographic manifests and audit ratings.</li>
                  <li>Configure internal registries for corporate compliance.</li>
                </ul>
              </CardContent>
              <CardFooter className="bg-muted/30 border-t border-border/40 py-3 text-[11px] font-mono text-zinc-500 justify-between">
                <span>Enterprise Registry</span>
                <ShieldCheck className="size-3.5 text-zinc-400" />
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* From Webpage to Workflow explanation */}
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-[0.8fr_1.2fr] items-center border-t border-border/40 pt-12">
          <div className="flex flex-col gap-3 text-left">
            <h2 className="m-0 text-2xl font-bold tracking-tight lg:text-3xl">From webpage to workflow</h2>
            <p className="m-0 text-sm text-muted-foreground leading-relaxed">
              Burst shifts the script customization paradigm. Declare permissions clearly, audit sources statically, and adapt code locally to make every webpage behave exactly how you need.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-left">
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/25 p-4">
              <div className="flex size-8 items-center justify-center rounded bg-indigo-500/5 border border-indigo-500/10 text-indigo-500">
                <Search className="size-4" />
              </div>
              <strong className="text-xs font-bold text-foreground">1. Find commands</strong>
              <p className="m-0 text-xs text-muted-foreground leading-normal">
                Query active tabs for scripts developed by your team or the open community.
              </p>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/25 p-4">
              <div className="flex size-8 items-center justify-center rounded bg-indigo-500/5 border border-indigo-500/10 text-indigo-500">
                <ShieldCheck className="size-4" />
              </div>
              <strong className="text-xs font-bold text-foreground">2. Audit the contract</strong>
              <p className="m-0 text-xs text-muted-foreground leading-normal">
                Review host matches, capability bounds, and publisher signatures.
              </p>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/25 p-4">
              <div className="flex size-8 items-center justify-center rounded bg-indigo-500/5 border border-indigo-500/10 text-indigo-500">
                <Code2 className="size-4" />
              </div>
              <strong className="text-xs font-bold text-foreground">3. Fork or customize</strong>
              <p className="m-0 text-xs text-muted-foreground leading-normal">
                Run verified packages directly, or fork source links to create your own branch.
              </p>
            </div>
          </div>
        </section>

        {/* Command Registry Catalog Catalog Grid */}
        <section className="flex flex-col gap-6 border-t border-border/40 pt-12" id="catalog">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-2 text-left">
              <Badge variant="outline" className="self-start text-indigo-500 border-indigo-500/20 bg-indigo-500/5">Command Catalog</Badge>
              <h2 className="m-0 text-2xl font-bold tracking-tight lg:text-3xl">Featured Web Commands</h2>
              <p className="m-0 text-sm text-muted-foreground">Examples from the registry illustrating safe browser automation.</p>
            </div>
            
            {/* Search filter in catalog */}
            <div className="flex flex-col sm:flex-row gap-2 max-w-sm w-full">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search catalog..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background pl-8 pr-3 text-xs focus-visible:outline-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Catalog categories filter pills */}
          <div className="flex flex-wrap gap-1.5 border-b border-border/30 pb-4">
            <button
              type="button"
              onClick={() => setCatalogCategory('all')}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all cursor-pointer ${catalogCategory === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-muted/40 hover:bg-muted text-muted-foreground'}`}
            >
              All Commands ({commands.length})
            </button>
            <button
              type="button"
              onClick={() => setCatalogCategory('verified')}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all cursor-pointer ${catalogCategory === 'verified' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-muted/40 hover:bg-muted text-muted-foreground'}`}
            >
              Verified Only ({commands.filter(c => c.trustLevel === 'verified').length})
            </button>
            <button
              type="button"
              onClick={() => setCatalogCategory('all_urls')}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all cursor-pointer ${catalogCategory === 'all_urls' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-muted/40 hover:bg-muted text-muted-foreground'}`}
            >
              Global utilities ({commands.filter(c => c.matchPatterns.includes('<all_urls>')).length})
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {filteredCatalogCommands.length > 0 ? (
              filteredCatalogCommands.map((command) => (
                <Card key={command.id} className="hover:border-indigo-500/30 hover:shadow-md transition-all text-left flex flex-col justify-between border-border/80">
                  <CardHeader className="border-b border-border/40 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-xs font-bold font-mono">
                        {command.publisher.avatarInitials}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-sm font-bold text-foreground">{command.title}</CardTitle>
                        <CardDescription className="truncate text-xs">by {command.publisher.name}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-3 flex-1">
                    <p className="m-0 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{command.description}</p>
                  </CardContent>
                  <CardFooter className="justify-between gap-3 pt-3">
                    <div className="flex min-w-0 gap-1.5">
                      <Badge variant={command.trustLevel === 'community' ? 'outline' : 'secondary'} className="text-[10px] py-0 px-1.5 h-5">{trustCopy[command.trustLevel]}</Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspectingCommand(command)}
                      className="text-xs font-semibold text-indigo-500 hover:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Eye className="size-3.5" />
                      Inspect Manifest
                    </button>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                No commands matching your criteria were found in the registry catalog.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Manifest & Safety Audit Modal Modal */}
      {inspectingCommand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl p-6 text-left flex flex-col gap-4 animate-fade-in-up">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border/80 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 font-bold font-mono">
                  {inspectingCommand.publisher.avatarInitials}
                </div>
                <div>
                  <h3 className="m-0 text-base font-bold text-foreground">{inspectingCommand.title}</h3>
                  <span className="text-xs text-muted-foreground">Version {inspectingCommand.version || '1.0.0'} • by {inspectingCommand.publisher.name}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingCommand(null)}
                className="rounded-full size-7 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer border-0 bg-transparent"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Tabs selector */}
            <div className="flex gap-2 border-b border-border/40 pb-2">
              <button
                type="button"
                onClick={() => setInspectTab('audit')}
                className={`text-xs font-bold pb-1.5 px-1 border-b-2 transition-all cursor-pointer ${inspectTab === 'audit' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                Security Audit Report
              </button>
              <button
                type="button"
                onClick={() => setInspectTab('manifest')}
                className={`text-xs font-bold pb-1.5 px-1 border-b-2 transition-all cursor-pointer ${inspectTab === 'manifest' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                Manifest JSON
              </button>
            </div>

            {/* Modal Content */}
            <div className="min-h-[220px] max-h-[350px] overflow-y-auto pr-1">
              {inspectTab === 'manifest' ? (
                <div className="rounded-xl border border-border bg-zinc-950 p-4 font-mono text-[11px] text-zinc-300 whitespace-pre overflow-x-auto">
                  <code>{getManifestJson(inspectingCommand)}</code>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {loadingAudit ? (
                    <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">Running security audit parser...</div>
                  ) : inspectingAudit ? (
                    <div className="flex flex-col gap-4">
                      
                      {/* Security Rating summary */}
                      <div className={`flex items-start gap-3 rounded-xl p-3 border ${inspectingAudit.status === 'pass' ? 'bg-emerald-500/5 border-emerald-500/25 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/5 border-amber-500/25 text-amber-600 dark:text-amber-400'}`}>
                        {inspectingAudit.status === 'pass' ? (
                          <ShieldCheck className="size-5 shrink-0 text-emerald-500" />
                        ) : (
                          <AlertTriangle className="size-5 shrink-0 text-amber-500" />
                        )}
                        <div className="text-xs">
                          <strong className="block font-bold mb-1">
                            {inspectingAudit.status === 'pass' ? 'Security Audit Passed' : 'Security Warning Raised'}
                          </strong>
                          <p className="m-0 leading-normal">{inspectingAudit.summary}</p>
                        </div>
                      </div>

                      {/* Detail Checks checklist */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                        {Object.entries(inspectingAudit.checks).map(([key, val]) => {
                          const valTyped = val as { status: 'pass' | 'warning' | 'fail'; detail: string };
                          const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                          return (
                            <div key={key} className="rounded-lg border border-border p-3 text-left">
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="text-[11px] font-bold text-foreground">{formattedKey}</span>
                                <Badge variant={valTyped.status === 'pass' ? 'secondary' : 'destructive'} className="text-[9px] py-0 px-1 h-4">
                                  {valTyped.status === 'pass' ? 'Pass' : 'Review'}
                                </Badge>
                              </div>
                              <p className="m-0 text-[10px] text-muted-foreground leading-normal">{valTyped.detail}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                      <AlertTriangle className="size-8 text-zinc-500" />
                      <span>Security report could not be compiled for this community template.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border/85 pt-3.5">
              <span className="text-[10px] text-muted-foreground">Audited on: {inspectingAudit?.auditedAt || 'Pending verification'}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setInspectingCommand(null)}>Close Inspector</Button>
                {inspectingCommand.sourceUrl && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={inspectingCommand.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                      <ExternalLink className="size-3.5" />
                      View Source
                    </a>
                  </Button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
