import { useState, useEffect } from 'react';
import type { BurstCommand } from '@/src/lib/commands';
import {
  RegistryAuthConfig,
  RegistrySessionUser,
  getRegistryCommands,
  registryCommandsData,
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
  Info,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';

const trustCopy: Record<BurstCommand['trustLevel'], string> = {
  verified: 'Verified',
  reviewed: 'Reviewed',
  community: 'Community',
  local: 'Local',
};

const riskCopy: Record<BurstCommand['risk'], string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
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
  const githubEnabled = authConfig?.githubEnabled ?? false;
  const isGuest = currentUser.handle === 'guest';
  const [commands, setCommands] = useState<BurstCommand[]>(registryCommandsData);
  const [activeIndex, setActiveIndex] = useState(0);

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

  const featuredCommands = commands.slice(0, 3);
  const activeCommand = featuredCommands[activeIndex % Math.max(featuredCommands.length, 1)];
  const verifiedCount = commands.filter((command) => command.trustLevel === 'verified').length;
  const reviewedCount = commands.filter((command) => command.trustLevel === 'reviewed' || command.trustLevel === 'verified').length;

  useEffect(() => {
    if (featuredCommands.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % featuredCommands.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [featuredCommands.length]);

  const landingStats = [
    { label: 'Commands', value: commands.length.toString() },
    { label: 'Verified', value: verifiedCount.toString() },
    { label: 'Reviewed', value: reviewedCount.toString() },
  ];

  const landingHighlights = [
    {
      title: 'Website-aware discovery',
      description: 'Find commands by site, publisher, permission, and use case from the live registry catalog.',
      icon: Search,
    },
    {
      title: 'Publisher identity',
      description: 'Profiles and GitHub-backed sessions make command ownership easier to inspect before install.',
      icon: Github,
    },
    {
      title: 'Static analysis signals',
      description: 'Trust, risk, and declared permissions are surfaced before a command runs in the browser.',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="h-screen min-h-screen overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-16 px-6 py-6 pb-20">
        <nav className="flex items-center justify-between gap-4">
          <button
            type="button"
            className="flex min-w-0 items-center gap-3 border-0 bg-transparent p-0 text-left text-foreground disabled:cursor-default"
            onClick={!isGuest ? onGoToDashboard : undefined}
            disabled={isGuest}
          >
            <img className="size-10 rounded-lg object-cover" src={logoUrl} alt="Burst Logo" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <strong className="text-sm font-semibold leading-none">Burst</strong>
              <span className="text-xs font-medium leading-none text-muted-foreground">Registry</span>
            </span>
          </button>

          <div className="flex min-w-0 items-center justify-end gap-2">
            {authLoading ? (
              <span className="text-xs font-medium text-muted-foreground">Loading...</span>
            ) : !isGuest ? (
              <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-card p-1.5">
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs font-medium">{currentUser.avatarInitials}</AvatarFallback>
                </Avatar>
                <div className="hidden min-w-0 flex-col pr-1 text-left sm:flex">
                  <span className="truncate text-xs font-medium leading-tight text-foreground">{currentUser.name}</span>
                  <span className="truncate text-[11px] leading-tight text-muted-foreground">
                    {currentUser.handle.startsWith('@') ? currentUser.handle : `@${currentUser.handle}`}
                  </span>
                </div>
                <Button size="sm" onClick={onGoToDashboard}>Dashboard</Button>
                <Button size="sm" variant="ghost" onClick={() => void onLogout()}>Log out</Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => void onGitHubLogin()} disabled={!githubEnabled}>
                <Github data-icon="inline-start" />
                Sign in
              </Button>
            )}
          </div>
        </nav>

        <header className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:gap-12">
          <div className="flex max-w-2xl flex-col gap-6 pt-6">
            <Badge variant="secondary" className="self-start">
              <Sparkles data-icon="inline-start" />
              Trusted command registry
            </Badge>
            <div className="flex flex-col gap-4">
              <h1 className="m-0 text-4xl font-semibold leading-tight tracking-normal lg:text-5xl">Run webpage commands with inspectable trust signals.</h1>
              <p className="m-0 max-w-xl text-base font-medium leading-relaxed text-muted-foreground">
                Burst helps you discover browser commands, review publisher identity, and inspect risk signals before installing anything from the registry.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {!isGuest ? (
                <Button size="lg" onClick={onGoToDashboard}>
                  Go to dashboard
                  <ArrowRight data-icon="inline-end" />
                </Button>
              ) : (
                <Button size="lg" onClick={() => void onGitHubLogin()} disabled={!githubEnabled || authLoading}>
                  <Github data-icon="inline-start" />
                  Continue with GitHub
                </Button>
              )}
              <Button size="lg" variant="outline" onClick={onGoToDashboard}>
                Browse catalog
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>

            {isGuest && !githubEnabled ? (
              <p className="m-0 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Info className="size-4 shrink-0" />
                GitHub sign-in is disabled in this environment.
              </p>
            ) : null}

            <div className="grid max-w-md grid-cols-3 gap-3 pt-2">
              {landingStats.map((stat) => (
                <div key={stat.label} className="rounded-lg border border-border bg-card p-3">
                  <span className="block text-lg font-semibold leading-none">{stat.value}</span>
                  <span className="mt-1 block text-[11px] font-medium text-muted-foreground">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          <Card className="w-full self-center">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Terminal className="size-4 text-muted-foreground" />
                Registry preview
              </CardTitle>
              <CardDescription>Live examples loaded from the command catalog.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate font-medium">{activeCommand?.title || 'Search commands'}</span>
              </div>

              <div className="flex flex-col gap-1">
                {featuredCommands.map((command, index) => {
                  const isActive = index === activeIndex % Math.max(featuredCommands.length, 1);
                  return (
                    <button
                      key={command.id}
                      type="button"
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border border-transparent p-3 text-left transition-colors ${isActive ? 'bg-muted text-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
                      onClick={() => setActiveIndex(index)}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-xs font-semibold text-foreground">
                          {command.publisher.avatarInitials}
                        </span>
                        <span className="min-w-0">
                          <strong className="block truncate text-sm font-medium">{command.title}</strong>
                          <span className="block truncate text-xs text-muted-foreground">{command.website} by {command.publisher.handle.startsWith('@') ? command.publisher.handle : `@${command.publisher.handle}`}</span>
                        </span>
                      </span>
                      <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                        <Badge variant={command.trustLevel === 'community' ? 'outline' : 'secondary'}>{trustCopy[command.trustLevel]}</Badge>
                        <Badge variant={command.risk === 'high' ? 'destructive' : 'outline'}>{riskCopy[command.risk]}</Badge>
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
            <CardFooter className="justify-between text-xs text-muted-foreground">
              <span>Context-aware catalog</span>
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="size-3.5" />
                Review before install
              </span>
            </CardFooter>
          </Card>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {landingHighlights.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} size="sm">
                <CardHeader>
                  <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
                    <Icon className="size-4" />
                  </div>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </section>

        <section className="flex flex-col gap-5" id="featured-commands">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 className="m-0 text-2xl font-semibold leading-tight tracking-normal">Featured commands</h2>
            <p className="m-0 text-sm font-medium leading-relaxed text-muted-foreground">These cards are populated from the current registry command data.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {featuredCommands.map((command) => (
              <Card key={command.id}>
                <CardHeader className="border-b">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-sm font-semibold">
                      {command.publisher.avatarInitials}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-sm">{command.title}</CardTitle>
                      <CardDescription className="truncate">by {command.publisher.name}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="m-0 line-clamp-4 text-sm leading-relaxed text-muted-foreground">{command.description}</p>
                </CardContent>
                <CardFooter className="justify-between gap-3">
                  <div className="flex min-w-0 gap-1.5">
                    <Badge variant={command.trustLevel === 'community' ? 'outline' : 'secondary'}>{trustCopy[command.trustLevel]}</Badge>
                    <Badge variant={command.risk === 'high' ? 'destructive' : 'outline'}>{riskCopy[command.risk]}</Badge>
                  </div>
                  <span className="truncate text-xs font-medium text-muted-foreground">{command.website}</span>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
