import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrub } from '../src/scrub.js';

const cases = [
  ['AWS key', 'key AKIAIOSFODNN7EXAMPLE here', 'aws-access-key'],
  ['GitHub token', 'token ghp_abcdefghijklmnopqrstuvwxyz0123456789', 'github-token'],
  ['Anthropic key', 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz', 'anthropic-key'],
  ['Slack token', 'xoxb-1234567890-abcdefghij', 'slack-token'],
  ['Stripe key', 'sk_live_abcdefghijklmnop1234', 'stripe-key'],
  ['JWT', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.dozjgNryP4J3jVmNHl0w5N', 'jwt'],
  ['bearer', 'Authorization: Bearer abcdefghijklmnopqrstuv', 'bearer-token'],
  ['private key', '-----BEGIN RSA PRIVATE KEY-----\nMIIB\n-----END RSA PRIVATE KEY-----', 'private-key'],
];

for (const [name, input, kind] of cases) {
  test(`redacts ${name}`, () => {
    const out = scrub(input);
    assert.ok(out.includes(`[REDACTED:${kind}]`), out);
    const secret = input.match(/(AKIA|gh[pousr]_|sk-ant-|xox|sk_live_|eyJ|Bearer |-----BEGIN)[^\s]*/)?.[0] ?? input;
    assert.ok(!out.includes(secret.slice(0, 12)), out);
  });
}

test('redacts password assignments but keeps the key name', () => {
  assert.equal(scrub('password: hunter22xyz'), 'password: [REDACTED:value]');
  assert.equal(scrub('DB_PASSWORD="s3cretvalue"'), 'DB_PASSWORD="[REDACTED:value]"');
});

test('redacts credentials inside a URL but keeps the host', () => {
  assert.equal(scrub('postgres://app:pw1234@db.internal/x'), 'postgres://[REDACTED:url-credentials]@db.internal/x');
});

test('leaves ordinary notes unchanged', () => {
  const text = 'SameSite=None needed for cross-site cookies. Use sk tokens later? no. Token count is 3000.';
  assert.equal(scrub(text), text);
});
