import { describe, expect, it } from 'vitest';
import {
  normalizeConfiguredBaseUrl,
  resolveConfiguredBaseUrl,
} from './url';

describe('configured URL normalization', () => {
  it('keeps complete HTTP(S) URLs stable', () => {
    expect(normalizeConfiguredBaseUrl('https://sub.example.com')).toBe('https://sub.example.com');
    expect(normalizeConfiguredBaseUrl('http://127.0.0.1:8791')).toBe('http://127.0.0.1:8791');
  });

  it('adds schemes for bare production and local hosts', () => {
    expect(normalizeConfiguredBaseUrl('testbk.medicago.top')).toBe('https://testbk.medicago.top');
    expect(normalizeConfiguredBaseUrl('localhost:8791')).toBe('http://localhost:8791');
    expect(normalizeConfiguredBaseUrl('127.0.0.1:8791')).toBe('http://127.0.0.1:8791');
  });

  it('tries later fallback candidates when an earlier value is invalid', () => {
    expect(resolveConfiguredBaseUrl('https://', 'fallback.example.com')).toBe('https://fallback.example.com');
  });

  it('does not treat relative paths as configured hostnames', () => {
    expect(normalizeConfiguredBaseUrl('/api/media/files/demo.png')).toBeNull();
  });
});
