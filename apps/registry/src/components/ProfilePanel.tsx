import { useState, useEffect } from 'react';
import type { 
  RegistrySessionUser, 
  PublisherProfile 
} from '@/src/lib/registryApi';
import type { BurstCommand } from '@/src/lib/commands';
import { getRegistryUser, updateRegistryUser } from '@/src/lib/registryApi';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  User, 
  ExternalLink, 
  ShieldCheck, 
  Terminal, 
  Sparkles 
} from 'lucide-react';

interface ProfilePanelProps {
  currentUser: RegistrySessionUser;
  onCurrentUserUpdate: (user: PublisherProfile) => void;
  commands: BurstCommand[];
  setActiveCommandId: (id: string | null) => void;
  setIsInspectorOpen: (open: boolean) => void;
  setNavTab: (tab: 'Discover' | 'Publish' | 'Profile' | 'Users' | 'Audits' | 'Settings') => void;
}

export function ProfilePanel({
  currentUser,
  onCurrentUserUpdate,
  commands,
  setActiveCommandId,
  setIsInspectorOpen,
  setNavTab,
}: ProfilePanelProps) {
  const isGuest = currentUser.handle === 'guest';
  const profileHandle = currentUser.handle;
  const displayHandle = profileHandle.startsWith('@') ? profileHandle : `@${profileHandle}`;

  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profile, setProfile] = useState<PublisherProfile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  
  const [draft, setDraft] = useState({
    name: '',
    bio: '',
    verifiedSources: '',
  });

  useEffect(() => {
    if (isGuest) {
      setProfile(null);
      return;
    }

    let active = true;
    setLoadingProfile(true);
    setNotice(null);

    async function loadProfile() {
      try {
        const loadedProfile = await getRegistryUser(profileHandle);
        if (!active) return;
        const nextProfile = loadedProfile ?? (currentUser as PublisherProfile);
        setProfile(nextProfile);
        setDraft({
          name: nextProfile.name || '',
          bio: nextProfile.bio || '',
          verifiedSources: (nextProfile.verifiedSources || []).join('\n'),
        });
      } catch (err) {
        if (!active) return;
        const fallbackProfile = currentUser as PublisherProfile;
        setProfile(fallbackProfile);
        setDraft({
          name: fallbackProfile.name || '',
          bio: fallbackProfile.bio || '',
          verifiedSources: (fallbackProfile.verifiedSources || []).join('\n'),
        });
        setNotice(err instanceof Error ? err.message : 'Failed to load profile details');
      } finally {
        if (active) setLoadingProfile(false);
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [currentUser, isGuest, profileHandle]);

  // Filter commands published by this user
  const myCommands = commands.filter(
    (cmd) => cmd.publisher.handle === profileHandle
  );

  const handleSave = async () => {
    if (isGuest) return;
    setSaving(true);
    setNotice(null);

    try {
      const updated = await updateRegistryUser(profileHandle, {
        name: draft.name.trim(),
        bio: draft.bio.trim(),
        verifiedSources: draft.verifiedSources
          .split('\n')
          .map((source) => source.trim())
          .filter(Boolean),
      });

      setProfile(updated);
      onCurrentUserUpdate(updated);
      setNotice('Successfully saved profile changes.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to save profile changes');
    } finally {
      setSaving(false);
    }
  };

  if (isGuest) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-sm">
        <User className="size-10 text-slate-400 dark:text-slate-500 mb-3" />
        <strong className="text-sm font-bold text-slate-800 dark:text-slate-200">Guest Session</strong>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm leading-relaxed">
          You are currently browsing the registry as a guest. Please sign in with GitHub to customize your profile, publish commands, or gain access to the publisher dashboard.
        </p>
        </div>
      </div>
    );
  }

  const publisher = profile ?? (currentUser as PublisherProfile);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-3 gap-6 items-start w-full min-w-0 overflow-y-auto pr-1 pb-1">
      {/* Edit Profile Form */}
      <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center font-extrabold text-lg border border-sky-500/20 shrink-0">
              {publisher.avatarInitials}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">{publisher.name}</h2>
              <span className="text-xs text-slate-400 dark:text-slate-500 block truncate mt-0.5">{displayHandle}</span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge variant="secondary" className="font-bold text-[9px] px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {publisher.role || 'publisher'}
                </Badge>
                <Badge variant={publisher.verified ? 'default' : 'outline'} className={`font-bold text-[9px] px-2.5 py-1 rounded-full uppercase tracking-wider ${publisher.verified ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-none' : 'border-slate-200 dark:border-slate-800 text-slate-500'}`}>
                  {publisher.verified ? 'Verified' : 'Community'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex gap-3 text-right">
            <div className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900/60 text-left min-w-[100px]">
              <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Published</span>
              <strong className="text-sm font-bold text-slate-900 dark:text-white block mt-0.5">{publisher.publishedCommandsCount}</strong>
            </div>
            <div className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900/60 text-left min-w-[110px]">
              <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Joined</span>
              <strong className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-1 truncate">
                {new Date(publisher.joinedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
              </strong>
            </div>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">Display name</span>
            <Input
              value={draft.name}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Your full name or display name"
              className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl font-medium"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">Biography</span>
            <Textarea
              rows={4}
              value={draft.bio}
              onChange={(event) => setDraft((prev) => ({ ...prev, bio: event.target.value }))}
              placeholder="Tell others about yourself, what you build, and your development experience."
              className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl font-medium"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">Verified sources (one per line)</span>
            <Textarea
              rows={3}
              value={draft.verifiedSources}
              onChange={(event) => setDraft((prev) => ({ ...prev, verifiedSources: event.target.value }))}
              placeholder="e.g. github.com/username&#10;yourdomain.com"
              className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl font-mono font-medium"
            />
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-4">
          <div className="flex-1">
            {notice && (
              <div className={`text-xs font-bold px-3 py-1.5 rounded-lg border inline-block ${
                notice.includes('Success')
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
              }`}>
                {notice}
              </div>
            )}
          </div>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loadingProfile}
            className="font-semibold h-8 px-4"
          >
            {saving ? 'Saving changes...' : loadingProfile ? 'Loading profile...' : 'Save profile changes'}
          </Button>
        </div>
      </div>

      {/* Profile Details & Published Commands */}
      <div className="lg:col-span-1 flex flex-col gap-6 w-full min-w-0">
        <div className="bg-slate-50 dark:bg-slate-950/40 p-5 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Identity Details</h3>
            <div className="flex flex-col gap-3 mt-1">
              <div>
                <span className="text-[10px] text-slate-400 block">GitHub account</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono mt-0.5 block truncate">
                  {publisher.githubLogin ? `@${publisher.githubLogin}` : 'Not linked'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Profile URL</span>
                <span className="text-xs font-bold text-sky-500 mt-0.5 block truncate">
                  {publisher.profileUrl ? (
                    <a href={publisher.profileUrl} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                      {publisher.profileUrl.replace('https://', '')}
                      <ExternalLink className="size-3" />
                    </a>
                  ) : 'Not available'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 border-t border-slate-200/50 dark:border-slate-800/40 pt-4">
            <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Verification Status</h3>
            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/60 rounded-xl mt-1">
              <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                <ShieldCheck className={`size-4 ${publisher.verified ? 'text-emerald-500' : 'text-slate-400'}`} />
                <strong className="text-xs font-bold">
                  {publisher.verified ? 'Verified publisher' : 'Community contributor'}
                </strong>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 mt-1.5">
                {publisher.verified
                  ? 'This account has passed verification. Commands published by this account will automatically receive a "Verified" trust rating if the source origin matches their verified claims.'
                  : 'This is a community account. Commands will receive a "Community" trust level by default until reviewed by an admin.'}
              </p>
            </div>
          </div>
        </div>

        {/* My Actions List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Terminal className="size-4 text-sky-500" />
              My Published Actions
            </h3>
            <Badge variant="outline" className="font-extrabold text-[9px] px-2 py-1 rounded-full border-slate-200 dark:border-slate-800 text-slate-500">
              {myCommands.length}
            </Badge>
          </div>

          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
            {myCommands.length > 0 ? (
              myCommands.map((cmd) => (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={() => {
                    setActiveCommandId(cmd.id);
                    setIsInspectorOpen(true);
                    setNavTab('Discover');
                  }}
                  className="w-full text-left p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-sky-500/5 dark:hover:bg-sky-500/10 hover:border-sky-500/20 dark:hover:border-sky-500/20 transition-all flex items-center justify-between gap-3 cursor-pointer shrink-0"
                >
                  <div className="min-w-0 flex flex-col">
                    <strong className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">{cmd.title}</strong>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-mono truncate">{cmd.id}</span>
                  </div>
                  <Sparkles className="size-3.5 text-sky-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))
            ) : (
              <div className="text-center py-6 text-slate-400 flex flex-col items-center gap-1.5">
                <span className="text-[11px] leading-relaxed">No actions published yet.</span>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-7 px-3 rounded-lg border-slate-200 dark:border-slate-800 text-sky-500 hover:text-sky-600"
                  onClick={() => setNavTab('Publish')}
                >
                  Publish your first command
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
