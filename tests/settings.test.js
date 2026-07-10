import { describe, it, expect } from 'vitest';
import {
  parseConfig,
  parseSiteConfig,
  serializeConfig,
  serializeSiteConfig,
} from '../src/frontend/lib/settings.js';

const SAMPLE_CONFIG = `export const SITE = {
  name: 'Bright Smile Dental',
  shortName: 'Bright Smile',
  url: 'https://brightsmiledental.com',
  phone: '+1-555-123-4567',
  email: 'hello@brightsmiledental.com',
  description: 'A family-friendly dental clinic.',
  address: {
    street: '123 Smile Avenue',
    city: 'Springfield',
    region: 'IL',
    postalCode: '62701',
    country: 'US',
  },
  geo: { lat: 39.7817, lng: -89.6501 },
  hours: [
    { days: 'Mon – Thu', hours: '8:00 AM – 6:00 PM' },
    { days: 'Fri', hours: '8:00 AM – 4:00 PM' },
  ],
  social: {
    facebook: 'https://facebook.com/brightsmiledental',
    instagram: 'https://instagram.com/brightsmiledental',
  },
  foundedYear: 2008,
  priceRange: '\\$\\$',
} as const;

export const NAV = {
  servicesLabel: 'Services',
};
`;

describe('parseConfig', () => {
  it('parses the SITE export', () => {
    const result = parseConfig(SAMPLE_CONFIG);
    expect(result.SITE).toBeDefined();
    expect(result.SITE.name).toBe('Bright Smile Dental');
  });

  it('parses nested objects', () => {
    const result = parseConfig(SAMPLE_CONFIG);
    expect(result.SITE.address.city).toBe('Springfield');
    expect(result.SITE.geo.lat).toBe(39.7817);
  });

  it('parses arrays of objects', () => {
    const result = parseConfig(SAMPLE_CONFIG);
    expect(Array.isArray(result.SITE.hours)).toBe(true);
    expect(result.SITE.hours).toHaveLength(2);
    expect(result.SITE.hours[0].days).toBe('Mon – Thu');
  });

  it('throws on invalid config', () => {
    expect(() => parseConfig('no export here')).toThrow('Could not find');
  });
});

describe('parseSiteConfig', () => {
  it('returns the SITE object directly', () => {
    const settings = parseSiteConfig(SAMPLE_CONFIG);
    expect(settings.name).toBe('Bright Smile Dental');
    expect(settings.address.city).toBe('Springfield');
  });
});

describe('serializeConfig', () => {
  it('produces valid TypeScript', () => {
    const output = serializeConfig('SITE', { name: 'Test', url: 'https://test.com' });
    expect(output).toContain('export const SITE = {');
    expect(output).toContain("name: 'Test'");
    expect(output).toContain('} as const;');
  });

  it('handles nested objects', () => {
    const output = serializeConfig('SITE', {
      address: { city: 'Springfield', region: 'IL' },
    });
    expect(output).toContain('address:');
    expect(output).toContain("city: 'Springfield'");
  });

  it('handles arrays of objects', () => {
    const output = serializeConfig('SITE', {
      hours: [{ days: 'Mon', hours: '9-5' }],
    });
    expect(output).toContain('hours:');
    expect(output).toContain("days: 'Mon'");
  });
});

describe('serializeSiteConfig', () => {
  it('preserves content after the main export', () => {
    const result = serializeSiteConfig(SAMPLE_CONFIG, { name: 'Updated' }, 'SITE');
    expect(result).toContain("name: 'Updated'");
    expect(result).toContain('export const NAV');
    expect(result).toContain("servicesLabel: 'Services'");
  });

  it('roundtrips parse → serialize → parse', () => {
    const original = parseSiteConfig(SAMPLE_CONFIG);
    const serialized = serializeSiteConfig(SAMPLE_CONFIG, original, 'SITE');
    const reparsed = parseSiteConfig(serialized);

    expect(reparsed.name).toBe(original.name);
    expect(reparsed.url).toBe(original.url);
    expect(reparsed.address.city).toBe(original.address.city);
    expect(reparsed.geo.lat).toBe(original.geo.lat);
    expect(reparsed.hours).toHaveLength(original.hours.length);
    expect(reparsed.social.facebook).toBe(original.social.facebook);
    expect(reparsed.foundedYear).toBe(original.foundedYear);
  });
});

describe('generic config (non-SITE)', () => {
  const genericConfig = `export const CONFIG = {
  title: 'My Blog',
  postsPerPage: 10,
  enableComments: true,
};
`;

  it('parses any export name', () => {
    const result = parseConfig(genericConfig);
    expect(result.CONFIG).toBeDefined();
    expect(result.CONFIG.title).toBe('My Blog');
    expect(result.CONFIG.postsPerPage).toBe(10);
    expect(result.CONFIG.enableComments).toBe(true);
  });

  it('serializes with any export name', () => {
    const output = serializeConfig('CONFIG', {
      title: 'My Blog',
      postsPerPage: 10,
      enableComments: true,
    });
    expect(output).toContain('export const CONFIG = {');
    expect(output).toContain('postsPerPage: 10');
    expect(output).toContain('enableComments: true');
  });
});
