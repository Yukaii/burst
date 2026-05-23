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
    <div className="landing-shell">
      <nav className="landing-nav">
        <div className="landing-brand" onClick={!isGuest ? onGoToDashboard : undefined} style={{ cursor: !isGuest ? 'pointer' : 'default' }}>
          <img className="brand-logo-img" src={logoUrl} alt="Burst Logo" />
          <div>
            <strong>Burst</strong>
            <em>Registry</em>
          </div>
        </div>
        <div className="landing-nav-actions">
          {authLoading ? (
            <div className="landing-nav-loading">Loading...</div>
          ) : !isGuest ? (
            <div className="landing-nav-user">
              <Avatar className="size-8">
                <AvatarFallback className="bg-slate-100 text-slate-800 text-xs font-bold">
                  {currentUser.avatarInitials}
                </AvatarFallback>
              </Avatar>
              <div className="landing-nav-user-info">
                <span className="landing-nav-username">{currentUser.name}</span>
                <span className="landing-nav-handle">
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

      <header className="landing-hero">
        <div className="landing-hero-copy">
          <div className="landing-kicker">
            <Sparkles className="size-3.5 text-sky-500" />
            Trusted Command Registry
          </div>
          <h1>Run powerful commands on any webpage, safely.</h1>
          <p>
            Burst is a modern browser extension framework that lets you build and run secure scripts on any webpage. Use the public registry to discover community scripts, compare publisher profiles, and audit static analysis results before anything touches your browser.
          </p>

          <div className="landing-actions">
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
            <p className="landing-auth-note">
              <Info className="size-4 flex-shrink-0" />
              GitHub sign-in is disabled in this environment. Set GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET to enable.
            </p>
          )}

          <div className="landing-meta">
            {landingStats.map((stat) => (
              <div key={stat.label} className="landing-stat">
                <span className="landing-stat-value">{stat.value}</span>
                <span className="landing-stat-label">{stat.label}</span>
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

      <section className="landing-surface">
        <div className="feature-grid">
          {landingHighlights.map((item) => (
            <div key={item.title} className="feature-card">
              <div className="feature-icon-container">
                {item.icon}
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </div>

        <div className="featured-commands" id="featured-commands">
          <div className="section-header">
            <h2>Featured commands in the catalog</h2>
            <p>Each command lists verified capabilities, publisher profiles, and static analysis risk flags.</p>
          </div>
          <div className="featured-grid">
            {featuredCommands.map((command) => (
              <div key={command.id} className="featured-card">
                <div>
                  <div className="featured-header">
                    <div className="featured-avatar-fallback">
                      {command.publisher.avatarInitials}
                    </div>
                    <div className="featured-info">
                      <strong className="featured-title">{command.title}</strong>
                      <span className="featured-publisher">by {command.publisher.name}</span>
                    </div>
                  </div>
                  <p className="featured-desc">{command.description}</p>
                </div>
                <div className="featured-meta">
                  <div className="featured-badges">
                    <span className="featured-tag">{trustCopy[command.trustLevel]}</span>
                    <span className="featured-tag">{riskCopy[command.risk]} Risk</span>
                  </div>
                  <span className="featured-publisher" style={{ fontSize: '11px' }}>{command.website}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
