import type { CommandIcon, CommandRisk } from './commands';

export type BurstCommandManifest = {
  schemaVersion: 1;
  id: string;
  title: string;
  description: string;
  website: string;
  matchPatterns: string[];
  publisher: {
    name: string;
    handle: string;
    avatarInitials: string;
  };
  icon: CommandIcon;
  permissions: string[];
  source: {
    type: 'git' | 'archive';
    url: string;
    integrity?: string;
  };
  runtime: {
    entrypoint: string;
    capabilities: Array<'page-dom' | 'selection' | 'clipboard-write' | 'toast'>;
  };
  version: string;
  risk: CommandRisk;
};

export type ManifestValidationResult = {
  ok: boolean;
  manifest?: BurstCommandManifest;
  errors: string[];
};

export const burstCommandManifestSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://burst.dev/schemas/burst.command.schema.json',
  title: 'Burst command manifest',
  type: 'object',
  required: [
    'schemaVersion',
    'id',
    'title',
    'description',
    'website',
    'matchPatterns',
    'publisher',
    'icon',
    'permissions',
    'source',
    'runtime',
    'version',
    'risk',
  ],
  additionalProperties: false,
  properties: {
    schemaVersion: { const: 1 },
    id: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{2,63}$' },
    title: { type: 'string', minLength: 3, maxLength: 80 },
    description: { type: 'string', minLength: 12, maxLength: 240 },
    website: { type: 'string', minLength: 1 },
    matchPatterns: {
      type: 'array',
      minItems: 1,
      items: { type: 'string', minLength: 1 },
    },
    publisher: {
      type: 'object',
      required: ['name', 'handle', 'avatarInitials'],
      additionalProperties: false,
      properties: {
        name: { type: 'string', minLength: 1 },
        handle: { type: 'string', pattern: '^@[a-z0-9][a-z0-9-]{1,31}$' },
        avatarInitials: { type: 'string', minLength: 1, maxLength: 3 },
      },
    },
    icon: {
      oneOf: [
        {
          type: 'object',
          required: ['type'],
          additionalProperties: false,
          properties: { type: { const: 'favicon' }, host: { type: 'string' } },
        },
        {
          type: 'object',
          required: ['type', 'value'],
          additionalProperties: false,
          properties: { type: { enum: ['initials', 'emoji'] }, value: { type: 'string', minLength: 1 } },
        },
        {
          type: 'object',
          required: ['type', 'src'],
          additionalProperties: false,
          properties: { type: { enum: ['url', 'asset'] }, src: { type: 'string', minLength: 1 } },
        },
      ],
    },
    permissions: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
    },
    source: {
      type: 'object',
      required: ['type', 'url'],
      additionalProperties: false,
      properties: {
        type: { enum: ['git', 'archive'] },
        url: { type: 'string', format: 'uri' },
        integrity: { type: 'string' },
      },
    },
    runtime: {
      type: 'object',
      required: ['entrypoint', 'capabilities'],
      additionalProperties: false,
      properties: {
        entrypoint: { type: 'string', minLength: 1 },
        capabilities: {
          type: 'array',
          items: { enum: ['page-dom', 'selection', 'clipboard-write', 'toast'] },
        },
      },
    },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    risk: { enum: ['low', 'medium', 'high'] },
  },
} as const;

export const sampleCommandManifests = [
  {
    schemaVersion: 1,
    id: 'copy-github-branch',
    title: 'Copy GitHub branch name',
    description: 'Copies the active GitHub branch name to the clipboard.',
    website: 'github.com',
    matchPatterns: ['github.com/*'],
    publisher: {
      name: 'Burst Examples',
      handle: '@burst-examples',
      avatarInitials: 'BE',
    },
    icon: { type: 'favicon', host: 'github.com' },
    permissions: ['Read page DOM', 'Write clipboard'],
    source: {
      type: 'git',
      url: 'https://github.com/burst/examples/tree/main/copy-github-branch',
    },
    runtime: {
      entrypoint: 'src/index.ts',
      capabilities: ['page-dom', 'clipboard-write', 'toast'],
    },
    version: '0.1.0',
    risk: 'medium',
  },
] satisfies BurstCommandManifest[];

export const sampleManifestValidationResults = sampleCommandManifests.map((manifest) => ({
  id: manifest.id,
  result: validateCommandManifest(manifest),
}));

export function validateCommandManifest(value: unknown): ManifestValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ['Manifest must be a JSON object.'] };
  }

  expectLiteral(value.schemaVersion, 1, 'schemaVersion', errors);
  expectSlug(value.id, 'id', errors);
  expectText(value.title, 'title', errors, 3, 80);
  expectText(value.description, 'description', errors, 12, 240);
  expectText(value.website, 'website', errors, 1);
  expectStringArray(value.matchPatterns, 'matchPatterns', errors, { minItems: 1 });
  validatePublisher(value.publisher, errors);
  validateIcon(value.icon, errors);
  expectStringArray(value.permissions, 'permissions', errors);
  validateSource(value.source, errors);
  validateRuntime(value.runtime, errors);
  expectSemver(value.version, 'version', errors);
  expectOneOf(value.risk, ['low', 'medium', 'high'], 'risk', errors);
  validatePackageFields(value, errors);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, manifest: value as BurstCommandManifest, errors: [] };
}

function validatePublisher(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push('publisher must be an object.');
    return;
  }

  expectText(value.name, 'publisher.name', errors, 1);
  expectPattern(value.handle, /^@[a-z0-9][a-z0-9-]{1,31}$/, 'publisher.handle', errors);
  expectText(value.avatarInitials, 'publisher.avatarInitials', errors, 1, 3);
}

function validateIcon(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push('icon must be an object.');
    return;
  }

  if (value.type === 'favicon') {
    if ('host' in value && typeof value.host !== 'string') errors.push('icon.host must be a string.');
    return;
  }

  if (value.type === 'initials' || value.type === 'emoji') {
    expectText(value.value, 'icon.value', errors, 1);
    return;
  }

  if (value.type === 'url' || value.type === 'asset') {
    expectText(value.src, 'icon.src', errors, 1);
    return;
  }

  errors.push('icon.type must be favicon, initials, emoji, url, or asset.');
}

function validateSource(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push('source must be an object.');
    return;
  }

  expectOneOf(value.type, ['git', 'archive'], 'source.type', errors);
  expectUrl(value.url, 'source.url', errors);
  if ('integrity' in value) expectIntegrity(value.integrity, 'source.integrity', errors);
}

function validateRuntime(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push('runtime must be an object.');
    return;
  }

  expectText(value.entrypoint, 'runtime.entrypoint', errors, 1);
  if (typeof value.entrypoint === 'string') expectEntrypoint(value.entrypoint, 'runtime.entrypoint', errors);
  expectStringArray(value.capabilities, 'runtime.capabilities', errors);
  if (Array.isArray(value.capabilities)) {
    value.capabilities.forEach((capability, index) => {
      expectOneOf(capability, ['page-dom', 'selection', 'clipboard-write', 'toast'], `runtime.capabilities[${index}]`, errors);
    });
  }
}

function validatePackageFields(value: Record<string, unknown>, errors: string[]) {
  if (!isRecord(value.source)) return;

  if (value.source.type === 'archive' && typeof value.source.integrity === 'undefined') {
    errors.push('source.integrity is required for archive packages.');
  }
}

function expectLiteral(value: unknown, literal: unknown, field: string, errors: string[]) {
  if (value !== literal) errors.push(`${field} must be ${String(literal)}.`);
}

function expectSlug(value: unknown, field: string, errors: string[]) {
  expectPattern(value, /^[a-z0-9][a-z0-9-]{2,63}$/, field, errors);
}

function expectSemver(value: unknown, field: string, errors: string[]) {
  expectPattern(value, /^\d+\.\d+\.\d+$/, field, errors);
}

function expectText(value: unknown, field: string, errors: string[], minLength: number, maxLength = Infinity) {
  if (typeof value !== 'string') {
    errors.push(`${field} must be a string.`);
    return;
  }

  const length = value.trim().length;
  if (length < minLength) errors.push(`${field} must be at least ${minLength} characters.`);
  if (length > maxLength) errors.push(`${field} must be at most ${maxLength} characters.`);
}

function expectStringArray(
  value: unknown,
  field: string,
  errors: string[],
  options: { minItems?: number } = {},
) {
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array.`);
    return;
  }

  if (options.minItems && value.length < options.minItems) {
    errors.push(`${field} must include at least ${options.minItems} item.`);
  }

  value.forEach((item, index) => {
    if (typeof item !== 'string' || item.trim().length === 0) {
      errors.push(`${field}[${index}] must be a non-empty string.`);
    }
  });
}

function expectPattern(value: unknown, pattern: RegExp, field: string, errors: string[]) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    errors.push(`${field} has an invalid format.`);
  }
}

function expectOneOf<T extends string>(value: unknown, allowed: T[], field: string, errors: string[]) {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    errors.push(`${field} must be one of: ${allowed.join(', ')}.`);
  }
}

function expectUrl(value: unknown, field: string, errors: string[]) {
  if (typeof value !== 'string') {
    errors.push(`${field} must be a URL string.`);
    return;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      errors.push(`${field} must use https.`);
    }
  } catch {
    errors.push(`${field} must be a valid URL.`);
  }
}

function expectIntegrity(value: unknown, field: string, errors: string[]) {
  if (typeof value !== 'string' || !/^sha256-[A-Za-z0-9+/=]+$/.test(value)) {
    errors.push(`${field} must use sha256-<base64>.`);
  }
}

function expectEntrypoint(value: string, field: string, errors: string[]) {
  if (value.startsWith('/') || value.split('/').includes('..')) {
    errors.push(`${field} must be a relative package path without parent traversal.`);
  }

  if (!/\.(mjs|js|ts|tsx)$/.test(value)) {
    errors.push(`${field} must point to a JavaScript or TypeScript module.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
