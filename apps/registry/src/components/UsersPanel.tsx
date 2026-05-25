import { useState, useEffect } from 'react';
import type { 
  RegistrySessionUser, 
  PublisherProfile 
} from '@/src/lib/registryApi';
import { 
  getRegistryUsers, 
  updateRegistryUser 
} from '@/src/lib/registryApi';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  Search, 
  RefreshCw, 
  Users, 
  ExternalLink 
} from 'lucide-react';

interface UsersPanelProps {
  currentUser: RegistrySessionUser;
  onCurrentUserUpdate: (user: PublisherProfile) => void;
}

export function UsersPanel({
  currentUser,
  onCurrentUserUpdate,
}: UsersPanelProps) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<PublisherProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHandle, setSelectedHandle] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: '',
    bio: '',
    verified: false,
    verifiedSources: '',
    role: 'publisher' as 'admin' | 'publisher' | 'member',
  });

  const selectedUser = users.find((user) => user.handle === selectedHandle) ?? null;
  const canEditAll = currentUser.handle !== 'guest' && currentUser.role === 'admin';
  const canEditSelected = Boolean(selectedUser) && (canEditAll || selectedUser?.handle === currentUser.handle);
  const selectedRole = selectedUser?.role ?? 'publisher';
  const selectedAccess = canEditAll ? 'Admin access' : canEditSelected ? 'Self edit' : 'Read only';

  useEffect(() => {
    let active = true;
    setLoading(true);

    async function fetchUsers() {
      try {
        const results = await getRegistryUsers(query);
        if (!active) return;
        setUsers(results);
        setSelectedHandle((prev) => {
          if (prev && results.some((user) => user.handle === prev)) {
            return prev;
          }
          return results[0]?.handle || '';
        });
      } catch (err) {
        if (!active) return;
        console.error('Failed to fetch registry users:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchUsers();

    return () => {
      active = false;
    };
  }, [query]);

  useEffect(() => {
    if (!selectedUser) return;
    setDraft({
      name: selectedUser.name,
      bio: selectedUser.bio,
      verified: selectedUser.verified,
      verifiedSources: selectedUser.verifiedSources.join('\n'),
      role: selectedUser.role ?? 'publisher',
    });
  }, [selectedUser?.handle]);

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    setNotice(null);

    try {
      const updated = await updateRegistryUser(selectedUser.handle, {
        name: draft.name.trim(),
        bio: draft.bio.trim(),
        verified: draft.verified,
        verifiedSources: draft.verifiedSources
          .split('\n')
          .map((source) => source.trim())
          .filter(Boolean),
        role: draft.role,
      });

      setUsers((prev) => prev.map((user) => (user.handle === updated.handle ? updated : user)));
      if (updated.handle === currentUser.handle) {
        onCurrentUserUpdate(updated);
      }
      setNotice(`Successfully saved profile changes for ${updated.handle.startsWith('@') ? updated.handle : `@${updated.handle}`}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-3 gap-6 items-start w-full min-w-0 overflow-y-auto pr-1 pb-1">
      {/* Directory sidebar */}
      <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[650px]">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/60 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-3.5 pointer-events-none" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search publisher directory..."
              className="pl-9 font-medium bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 focus-visible:ring-sky-500"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Directory Listing</span>
            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">{users.length} publishers</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <RefreshCw className="size-5 animate-spin text-sky-500" />
              <span className="text-xs font-semibold">Loading publishers...</span>
            </div>
          ) : users.length > 0 ? (
            users.map((user) => {
              const isSelected = selectedHandle === user.handle;
              const roleColors = {
                admin: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
                publisher: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20',
                member: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/40',
              }[user.role || 'publisher'];

              return (
                <button
                  key={user.handle}
                  type="button"
                  className={`w-full px-4 py-3 flex items-start gap-3 text-left border-none transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-sky-500/5 dark:bg-sky-500/10 shadow-[inset_3px_0_0_0_#0ea5e9]'
                      : 'bg-transparent hover:bg-slate-50/50 dark:hover:bg-slate-900/40'
                  }`}
                  onClick={() => {
                    setSelectedHandle(user.handle);
                    setNotice(null);
                  }}
                >
                  <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-extrabold text-xs text-slate-700 dark:text-slate-300 shrink-0">
                    {user.avatarInitials}
                  </div>
                  <div className="flex flex-col min-w-0 pr-1">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                      {user.name}
                      {user.verified && (
                        <span className="text-[10px] text-emerald-500" title="Verified">✓</span>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                      {user.handle.startsWith('@') ? user.handle : `@${user.handle}`}
                    </span>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`px-2 py-0.5 rounded text-[8px] leading-none font-extrabold uppercase ${roleColors}`}>
                        {user.role || 'publisher'}
                      </span>
                      <span className="text-[9px] font-semibold text-slate-400">{user.publishedCommandsCount} actions</span>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center text-slate-400">
              <Users className="size-7 opacity-30 mb-1.5" />
              <strong className="text-xs font-bold text-slate-800 dark:text-slate-200">No publishers found</strong>
              <span className="text-[11px] text-slate-400 max-w-[200px] leading-normal">Try searching another publisher name.</span>
            </div>
          )}
        </div>
      </div>

      {/* Editor detail panel */}
      <div className="lg:col-span-2 flex flex-col gap-6 w-full min-w-0">
        {selectedUser ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            {/* Publisher Hero */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="size-14 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center font-extrabold text-lg border border-sky-500/20 shrink-0">
                  {selectedUser.avatarInitials}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">{selectedUser.name}</h2>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block truncate mt-0.5">
                    {selectedUser.handle.startsWith('@') ? selectedUser.handle : `@${selectedUser.handle}`}
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge variant="secondary" className="font-bold text-[9px] px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {selectedRole}
                    </Badge>
                    <Badge variant="outline" className="font-bold text-[9px] px-2.5 py-1 rounded-full uppercase tracking-wider border-slate-200 dark:border-slate-800 text-slate-500">
                      {selectedAccess}
                    </Badge>
                    <Badge variant={selectedUser.verified ? 'default' : 'outline'} className={`font-bold text-[9px] px-2.5 py-1 rounded-full uppercase tracking-wider ${selectedUser.verified ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-none' : 'border-slate-200 dark:border-slate-800 text-slate-500'}`}>
                      {selectedUser.verified ? 'Verified' : 'Community'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Mini stats cards */}
              <div className="flex gap-3 text-right">
                <div className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900/60 text-left min-w-[100px]">
                  <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Published</span>
                  <strong className="text-sm font-bold text-slate-900 dark:text-white block mt-0.5">{selectedUser.publishedCommandsCount}</strong>
                </div>
                <div className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900/60 text-left min-w-[110px]">
                  <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Joined</span>
                  <strong className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-1 truncate">
                    {new Date(selectedUser.joinedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
                  </strong>
                </div>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-5 gap-6">
              {/* Form columns */}
              <div className="md:col-span-3 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">Display name</span>
                  <Input
                    value={draft.name}
                    onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                    disabled={!canEditSelected}
                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl font-medium"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">Role</span>
                  <select
                    value={draft.role}
                    onChange={(event) => setDraft((prev) => ({ ...prev, role: event.target.value as typeof draft.role }))}
                    disabled={!canEditAll}
                    className="h-8.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1.5 text-[13px] font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50"
                  >
                    <option value="publisher">Publisher</option>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">Biography</span>
                  <Textarea
                    rows={3}
                    value={draft.bio}
                    onChange={(event) => setDraft((prev) => ({ ...prev, bio: event.target.value }))}
                    disabled={!canEditSelected}
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl font-medium"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">Verified sources (one per line)</span>
                  <Textarea
                    rows={3}
                    value={draft.verifiedSources}
                    onChange={(event) => setDraft((prev) => ({ ...prev, verifiedSources: event.target.value }))}
                    disabled={!canEditAll && selectedUser.handle !== currentUser.handle}
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl font-mono font-medium"
                  />
                </div>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/20 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={draft.verified}
                    onChange={() => setDraft((prev) => ({ ...prev, verified: !prev.verified }))}
                    disabled={!canEditAll}
                    className="size-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500 disabled:opacity-50"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900 dark:text-white leading-none">Verified publisher badge</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Gives verified badge on registry search and commands list.</span>
                  </div>
                </label>
              </div>

              {/* Sidebar metadata column */}
              <div className="md:col-span-2 flex flex-col gap-5 bg-slate-50 dark:bg-slate-900/40 p-4 border-l border-slate-100 dark:border-slate-800/40 rounded-xl">
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Identity Context</h3>
                  <div className="flex flex-col gap-2 mt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 block">GitHub linked username</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono mt-0.5 block truncate">
                        {selectedUser.githubLogin ? `@${selectedUser.githubLogin}` : 'Not linked'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Registry profile url</span>
                      <span className="text-xs font-bold text-sky-500 mt-0.5 block truncate">
                        {selectedUser.profileUrl ? (
                          <a href={selectedUser.profileUrl} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                            {selectedUser.profileUrl.replace('https://', '')}
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
                    <strong className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      {selectedUser.verified ? 'Verified publisher' : 'Community contributor'}
                    </strong>
                    <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 mt-1">
                      {selectedUser.verified
                        ? 'This account has passed verification. Commands published by this account will automatically receive a "Verified" trust rating if the source origin matches their verified claims.'
                        : 'This is a community account. Commands will receive a "Community" trust level by default until reviewed by an admin.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Form actions / notifications */}
            <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-4">
              <div className="flex-1">
                {notice && (
                  <div className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${
                    notice.includes('Success') || notice.includes('Saved')
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
                disabled={saving || !canEditSelected}
                className="font-semibold h-7.5 px-4"
              >
                {saving ? 'Saving changes...' : 'Save profile changes'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-sm">
            <Users className="size-10 text-slate-300 dark:text-slate-700 mb-3" />
            <strong className="text-sm font-bold text-slate-800 dark:text-slate-200">No publisher selected</strong>
            <span className="text-xs text-slate-400 dark:text-slate-500 mt-1">Select a publisher profile from the directory sidebar.</span>
          </div>
        )}
      </div>
    </div>
  );
}
