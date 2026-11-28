import assert from 'node:assert/strict';
import { test } from 'node:test';
import '@/app.module';
import { EmbedsService } from '@/modules/embeds/embeds.service';

// EmbedsService.fix is a pure function: it rewrites supported links to their embeds.now form and
// leaves everything else untouched. These tests drive it directly, with no database or Discord.
const service = new EmbedsService();
const fix = (content: string) => service.fix(content).content;
const changed = (content: string) => service.fix(content).changed;

test('a link from each supported site is rewritten to its embeds.now form', () => {
  assert.ok(fix('veja https://x.com/u/status/1').includes('embeds.now/x.com/u/status/1'));
  assert.ok(fix('https://twitter.com/u/status/1').includes('embeds.now/twitter.com/u/status/1'));
  assert.ok(fix('https://www.instagram.com/p/ABC/').includes('embeds.now/instagram.com/p/ABC/'));
  assert.ok(fix('https://vm.tiktok.com/XYZ/').includes('embeds.now/vm.tiktok.com/XYZ/'));
  assert.ok(fix('https://www.reddit.com/r/x/comments/1/t/').includes('embeds.now/reddit.com/r/x/comments/1/t/'));
  assert.ok(fix('https://open.spotify.com/track/HASH').includes('embeds.now/open.spotify.com/track/HASH'));
  assert.ok(fix('https://threads.net/@a/post/1').includes('embeds.now/threads.net/@a/post/1'));
  assert.ok(fix('https://bsky.app/profile/a/post/1').includes('embeds.now/bsky.app/profile/a/post/1'));
  assert.ok(fix('https://pin.it/abc').includes('embeds.now/pin.it/abc'));
  assert.ok(fix('https://www.facebook.com/x/posts/1').includes('embeds.now/facebook.com/x/posts/1'));
});

test('www. is dropped but meaningful subdomains, the query string and trailing punctuation are kept', () => {
  assert.ok(fix('https://x.com/u/1?t=5').includes('embeds.now/x.com/u/1?t=5'), 'query string kept');
  assert.ok(fix('(https://x.com/u/1).').includes('embeds.now/x.com/u/1).'), 'trailing punctuation stays outside the link');
  assert.ok(fix('https://open.spotify.com/track/H').includes('embeds.now/open.spotify.com/'), 'open. subdomain kept');
  assert.ok(fix('https://mobile.twitter.com/a/1').includes('embeds.now/mobile.twitter.com/a/1'), 'mobile. subdomain kept');
});

test('unsupported hosts, already-fixed links and plain text are left unchanged', () => {
  const unsupported = 'https://youtube.com/watch?v=1 and https://example.com/a';
  assert.equal(fix(unsupported), unsupported);
  assert.equal(fix('https://embeds.now/x.com/a/1'), 'https://embeds.now/x.com/a/1');
  assert.equal(changed('hello world, no links here'), false);
});

test('every supported link in a message is rewritten', () => {
  const out = fix('olha https://x.com/a/1 e também https://www.tiktok.com/@u/video/9 agora');
  assert.ok(out.includes('embeds.now/x.com/a/1'));
  assert.ok(out.includes('embeds.now/tiktok.com/@u/video/9'));
});

test('a link the member suppressed with <...> is left alone', () => {
  const wrapped = 'sem preview: <https://x.com/u/1>';
  assert.equal(fix(wrapped), wrapped);
  assert.equal(changed(wrapped), false);
});

test('links inside code (fenced or inline) are left as typed', () => {
  const inline = 'use `https://x.com/u/1` assim';
  assert.equal(fix(inline), inline);
  assert.equal(changed(inline), false);

  const fenced = '```\nhttps://x.com/u/1\n```';
  assert.equal(fix(fenced), fenced);

  // A link outside the code span is still fixed, even when a code span is present.
  const mixed = '`code` e https://x.com/u/2';
  assert.ok(fix(mixed).includes('embeds.now/x.com/u/2'));
});
