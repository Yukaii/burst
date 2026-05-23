import type { BurstCommand } from '@/src/lib/commands';

export const GIT_REGISTRIES_STORAGE_KEY = 'burst.gitRegistries.v1';

export type GitRegistry = {
  id: string;
  url: string;
  name: string;
  owner: string;
  repo: string;
  branch: string;
  commands: BurstCommand[];
};

export type ScriptUpdate = {
  type: 'official' | 'git' | 'fork';
  id: string;
  name: string;
  currentVersion: string;
  latestVersion: string;
  code: string;
  hasLocalChanges?: boolean;
  upstreamCodeAtFork?: string;
  manifestCommand?: BurstCommand;
};
