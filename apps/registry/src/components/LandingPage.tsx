import { useState, useEffect } from 'react';
import type { BurstCommand } from '@/src/lib/commands';
import { 
  RegistryAuthConfig, 
  RegistrySessionUser, 
  registryCommandsData 
} from '@/src/lib/registryApi';
import logoUrl from '@/assets/logo.svg';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { Github } from './icons';
import { 
  ArrowRight, 
  Search, 
  ShieldCheck, 
  Terminal, 
  Info, 
  Globe, 
  Code, 
  Sparkles 
} from 'lucide-react';

const trustCopy: Record<BurstCommand['trustLevel'], string> = {
  verified: 'Verified',
  reviewed: 'Reviewed',
  community: 'Community',
  local: 'Local',
};

const riskCopy: Record<BurstCommand['risk'], string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

interface LandingPageProps {
  authLoading?: boolean;
  authConfig: RegistryAuthConfig | null;
  currentUser: RegistrySessionUser;
  onGitHubLogin: () => void | Promise<void>;
  onLogout: () => void | Promise<void>;
  onGoToDashboard: () => void;
}

export function LandingPage({
  authLoading = false,
  authConfig,
  currentUser,
  onGitHubLogin,
  onLogout,
  onGoToDashboard,
}: LandingPageProps) {
  const featuredCommands = registryCommandsData.slice(0, 3);
  const verifiedCount = registryCommandsData.filter((command) => command.trustLevel === 'verified').length;
  const reviewedCount = registryCommandsData.filter((command) => command.trustLevel === 'reviewed' || command.trustLevel === 'verified').length;
  const commandCount = registryCommandsData.length;
  const githubEnabled = authConfig?.githubEnabled ?? false;
  const isGuest = currentUser.handle === 'guest';
  
  const landingStats = [
    { label: 'Public commands', value: commandCount.toString() },
    { label: 'Verified publishers', value: verifiedCount.toString() },
    { label: 'Audits passed', value: reviewedCount.toString() },
  ];

  const [mockActiveIndex, setMockActiveIndex] = useState(0);
  const [typedQuery, setTypedQuery] = useState('');

  const mockCommands = [
    {
      title: 'Search developer docs on MDN',
      subtitle: 'developer.mozilla.org • by @mozilla',
      trust: 'verified',
      risk: 'low',
      icon: <Globe className="size-4" />,
    },
    {
      title: 'Deploy serverless Worker API',
      subtitle: 'dash.cloudflare.com • by @cloudflare',
      trust: 'reviewed',
      risk: 'medium',
      icon: <Terminal className="size-4" />,
    },
    {
      title: 'Extract page tables to CSV',
      subtitle: 'Any webpage • by @community_dev',
      trust: 'community',
      risk: 'low',
      icon: <Code className="size-4" />,
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setMockActiveIndex((prev) => (prev + 1) % 3);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fullText = mockCommands[mockActiveIndex].title;
    let index = 0;
    setTypedQuery('');
    
    const interval = setInterval(() => {
      if (index < fullText.length) {
        setTypedQuery((prev) => prev + fullText.charAt(index));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [mockActiveIndex]);

  const landingHighlights = [
    {
      title: 'Contextual Intelligence',
      description: 'Find commands that automatically match the website you are currently browsing. Boost your workflow without searching manuals.',
      icon: <Globe className="size-5" />,
    },
    {
      title: 'Cryptographic Identity',
      description: 'Publishers verify their sessions through GitHub OAuth. Know exactly who built the code running in your context.',
      icon: <Github className="size-5" />,
    },
    {
      title: 'Automated Static Analysis',
      description: 'Every script is audited before indexing. Our runner checks declared permission manifests and flags potential vulnerabilities.',
      icon: <ShieldCheck className="size-5" />,
    },
  ];

  return (
    <div 
      className="h-screen overflow-y-auto min-h-screen p-12 px-6 pb-[120px] flex flex-col gap-[120px]"
      style={{
        background: 'radial-gradient(circle at 10% 10%, rgba(14, 165, 233, 0.12) 0%, transparent 45%), radial-gradient(circle at 90% 10%, rgba(99, 102, 241, 0.08) 0%, transparent 45%), linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)'
      }}
    >
      <nav className="max-w-[1200px] w-full mx-auto flex justify-between items-center">
        <div 
          className="flex items-center gap-3" 
          onClick={!isGuest ? onGoToDashboard : undefined} 
          style={{ cursor: !isGuest ? 'pointer' : 'default' }}
        >
          <img className="w-[42px] h-[42px] rounded-xl object-cover" src={logoUrl} alt="Burst Logo" />
          <div>
            <strong className="text-slate-900 text-lg font-extrabold leading-[1.1] tracking-tight block">Burst</strong>
            <em className="text-slate-500 text-xs font-semibold not-italic block mt-1">Registry</em>
          </div>
        </div>
        <div className="flex items-center gap-3.5">
          {authLoading ? (
            <div className="text-xs font-semibold text-muted-foreground">Loading...</div>
          ) : !isGuest ? (
            <div className="flex items-center gap-2.5 border border-border rounded-lg bg-card p-1.5 px-3">
              <Avatar className="size-8">
                <AvatarFallback className="bg-slate-100 text-slate-800 text-xs font-bold">
                  {currentUser.avatarInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-left justify-center min-w-0">
                <span className="text-foreground text-xs font-bold leading-tight block truncate">{currentUser.name}</span>
                <span className="text-muted-foreground text-[10px] font-semibold leading-tight block truncate">
                  {currentUser.handle.startsWith('@') ? currentUser.handle : `@${currentUser.handle}`}
                </span>
              </div>
              <Button size="sm" variant="default" onClick={onGoToDashboard}>
                Console
              </Button>
              <Button size="sm" variant="outline" className="logout-btn" onClick={() => void onLogout()}>
                Log out
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => void onGitHubLogin()} disabled={!githubEnabled}>
              <Github className="size-4" />
              Sign in with GitHub
            </Button>
          )}
        </div>
      </nav>

      <header className="max-w-[1200px] w-full mx-auto grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-16 items-start">
        <div className="flex flex-col gap-6 max-w-[620px]">
          <div className="inline-flex items-center gap-2 self-start border border-sky-500/15 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-bold px-3 py-1 uppercase tracking-wide">
            <Sparkles className="size-3.5 text-sky-500" />
            Trusted Command Registry
          </div>
          <h1 className="m-0 text-slate-900 text-4xl lg:text-[46px] font-black leading-[1.1] tracking-tight">Run powerful commands on any webpage, safely.</h1>
          <p className="m-0 text-slate-600 text-base lg:text-[17px] font-medium leading-relaxed">
            Burst is a modern browser extension framework that lets you build and run secure scripts on any webpage. Use the public registry to discover community scripts, compare publisher profiles, and audit static analysis results before anything touches your browser.
          </p>

          <div className="flex flex-wrap gap-3">
            {!isGuest ? (
              <Button onClick={onGoToDashboard}>
                Go to Console
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={() => void onGitHubLogin()} disabled={!githubEnabled || authLoading}>
                <Github className="size-4" />
                Continue with GitHub
              </Button>
            )}
            <Button variant="outline" onClick={onGoToDashboard}>
              Browse Catalog
              <ArrowRight className="size-4" />
            </Button>
          </div>
          {isGuest && !githubEnabled && (
            <p className="flex items-center gap-2 text-slate-500 text-xs font-semibold leading-normal">
              <Info className="size-4 flex-shrink-0" />
              GitHub sign-in is disabled in this environment. Set GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET to enable.
            </p>
          )}

          <div className="flex flex-wrap gap-8 lg:gap-12 mt-4">
            {landingStats.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1.5">
                <span className="text-slate-950 text-2xl font-black leading-none tracking-tight">{stat.value}</span>
                <span className="text-slate-500 text-xs font-semibold leading-none uppercase tracking-wider">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200/60 rounded-[20px] shadow-[0_10px_30px_-5px_rgba(15,23,42,0.03),0_25px_60px_-15px_rgba(15,23,42,0.08)] overflow-hidden flex flex-col w-full max-w-[440px] ml-auto lg:mx-auto self-center">
          <div className="mock-search-bar flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/50" style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(226, 232, 240, 0.6)', backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
            <Search className="w-4 h-4 text-slate-400 shrink-0" size={16} style={{ width: '16px', height: '16px', minWidth: '16px', flexShrink: 0, marginRight: '12px' }} />
            <div className="mock-search-input text-sm font-semibold text-slate-900 flex-1 bg-transparent border-none outline-none flex items-center min-w-0" style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <span className="truncate">{typedQuery}</span>
              <span className="mock-cursor" />
            </div>
          </div>

          <div className="p-2.5 flex flex-col gap-1">
            {mockCommands.map((cmd, i) => {
              const isActive = i === mockActiveIndex;
              const trustBadgeColor = 
                cmd.trust === 'verified' ? 'bg-emerald-50 text-emerald-600' :
                cmd.trust === 'reviewed' ? 'bg-blue-50 text-blue-600' :
                'bg-slate-100 text-slate-600';
              const riskBadgeColor = 
                cmd.risk === 'low' ? 'bg-green-50 text-green-600' :
                cmd.risk === 'medium' ? 'bg-amber-50 text-amber-600' :
                'bg-red-50 text-red-600';

              return (
                <button
                  key={cmd.title}
                  type="button"
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg border-none w-full cursor-pointer transition-all duration-150 ${isActive ? 'bg-slate-100' : 'bg-transparent hover:bg-slate-50'}`}
                  onClick={() => setMockActiveIndex(i)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors duration-150 ${isActive ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-500'}`}>
                      {cmd.icon}
                    </div>
                    <div className="flex flex-col text-left min-w-0">
                      <span className="text-[13px] font-bold text-slate-800 truncate">{cmd.title}</span>
                      <span className="text-[11px] text-slate-500 truncate">{cmd.subtitle}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${trustBadgeColor}`}>
                      {cmd.trust}
                    </span>
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${riskBadgeColor}`}>
                      {cmd.risk}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-5 py-3 bg-slate-50/50 border-t border-slate-100 text-[11px] text-slate-500 font-semibold">
            <span>Context-aware commands ready for review</span>
            <span>Verified before install</span>
          </div>
        </div>
      </header>

      <section className="max-w-[1200px] w-full mx-auto flex flex-col gap-[120px]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {landingHighlights.map((item) => (
            <div key={item.title} className="flex flex-col gap-4 border border-slate-200/50 rounded-[20px] bg-white p-6 shadow-[0_10px_30px_-10px_rgba(15,23,42,0.02)]">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-50 text-sky-600 shrink-0">
                {item.icon}
              </div>
              <h3 className="m-0 text-slate-900 text-sm font-extrabold leading-normal">{item.title}</h3>
              <p className="m-0 text-slate-500 text-[12px] font-medium leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-8" id="featured-commands">
          <div className="flex flex-col gap-2 max-w-[600px]">
            <h2 className="m-0 text-slate-900 text-2xl font-black leading-tight tracking-tight">Featured commands in the catalog</h2>
            <p className="m-0 text-slate-500 text-sm font-semibold leading-relaxed">Each command lists verified capabilities, publisher profiles, and static analysis risk flags.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredCommands.map((command) => (
              <div key={command.id} className="flex flex-col justify-between gap-6 border border-slate-200/50 rounded-[20px] bg-white p-6 shadow-[0_10px_30px_-10px_rgba(15,23,42,0.02)]">
                <div>
                  <div className="flex items-center gap-3.5 border-b border-slate-100 pb-4">
                    <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-sky-50 text-sky-600 text-sm font-extrabold border border-sky-100 shrink-0">
                      {command.publisher.avatarInitials}
                    </div>
                    <div className="flex flex-col min-w-0 text-left">
                      <strong className="text-slate-900 text-sm font-extrabold leading-tight truncate">{command.title}</strong>
                      <span className="text-slate-500 text-[11px] font-semibold mt-0.5">by {command.publisher.name}</span>
                    </div>
                  </div>
                  <p className="text-slate-600 text-[12.5px] font-medium leading-relaxed mt-4">{command.description}</p>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-6">
                  <div className="flex gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-slate-50 border border-slate-100 text-slate-500 tracking-wider">{trustCopy[command.trustLevel]}</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-slate-50 border border-slate-100 text-slate-500 tracking-wider">{riskCopy[command.risk]} Risk</span>
                  </div>
                  <span className="text-slate-500 text-[11px] font-semibold mt-0.5">{command.website}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
