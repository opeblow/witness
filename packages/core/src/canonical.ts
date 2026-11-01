/**
 * Canonical JSON serialisation.
 *
 * Two parties that hold the same value must produce the same bytes, otherwise a
 * signature made by one cannot be checked by the other. The rules are a strict
 * subset of RFC 8785 (JCS) that avoids its hardest case, floating point:
 *
 * - object keys are sorted by UTF-16 code unit order, the order JSON.stringify
 *   and JCS both use;
 * - only safe integers are allowed as numbers;
 * - no whitespace;
 * - `undefined`, functions, symbols, bigints and non-plain objects are rejected
 *   instead of being silently dropped.
 */
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export class CanonicalJsonError extends Error {
  override readonly name = 'CanonicalJsonError';
}

export function canonicalize(value: unknown): string {
  return write(value, '$');
}

function write(value: unknown, path: string): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isSafeInteger(value)) {
        throw new CanonicalJsonError(`${path}: only safe integers are allowed, got ${value}`);
      }
      return Object.is(value, -0) ? '0' : String(value);
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map((item, i) => write(item, `${path}[${i}]`)).join(',')}]`;
      }
      const proto = Object.getPrototypeOf(value) as unknown;
      if (proto !== Object.prototype && proto !== null) {
        throw new CanonicalJsonError(`${path}: only plain objects are allowed`);
      }
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record).sort();
      const members: string[] = [];
      for (const key of keys) {
        const member = record[key];
        if (member === undefined) {
          throw new CanonicalJsonError(`${path}.${key}: undefined is not allowed`);
        }
        members.push(`${JSON.stringify(key)}:${write(member, `${path}.${key}`)}`);
      }
      return `{${members.join(',')}}`;
    }
    default:
      throw new CanonicalJsonError(`${path}: unsupported type ${typeof value}`);
  }
}
