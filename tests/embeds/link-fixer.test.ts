import assert from 'node:assert/strict';
import { test } from 'node:test';
import '@/app.module';
import { EmbedsService } from '@/modules/embeds/embeds.service';

// EmbedsService.fix is a pure function, so these drive it directly, with no database or Discord.
const service = new EmbedsService();
const fix = (content: string) => service.fix(content).content;
const changed = (content: string) => service.fix(content).changed;

test('a link from each supported site is rewritten to its embeds.now form', () => {
  const cases: [string, string][] = [
    ['veja https://x.com/u/status/1', 'veja https://embeds.now/x.com/u/status/1'],
    ['https://twitter.com/u/status/1', 'https://embeds.now/twitter.com/u/status/1'],
    ['https://www.instagram.com/p/ABC/', 'https://embeds.now/instagram.com/p/ABC/'],
    ['https://vm.tiktok.com/XYZ/', 'https://embeds.now/vm.tiktok.com/XYZ/'],
    ['https://www.reddit.com/r/x/comments/1/t/', 'https://embeds.now/reddit.com/r/x/comments/1/t/'],
    ['https://open.spotify.com/track/HASH', 'https://embeds.now/open.spotify.com/track/HASH'],
    ['https://threads.net/@a/post/1', 'https://embeds.now/threads.net/@a/post/1'],
    ['https://bsky.app/profile/a/post/1', 'https://embeds.now/bsky.app/profile/a/post/1'],
    ['https://pin.it/abc', 'https://embeds.now/pin.it/abc'],
    ['https://www.facebook.com/x/posts/1', 'https://embeds.now/facebook.com/x/posts/1'],
  ];
  for (const [input, expected] of cases) {
    assert.deepEqual(service.fix(input), { changed: true, content: expected }, input);
  }
});

test('www. is dropped but meaningful subdomains, the query string and trailing punctuation are kept', () => {
  assert.equal(fix('https://x.com/u/1?t=5'), 'https://embeds.now/x.com/u/1?t=5');
  assert.equal(fix('https://mobile.twitter.com/a/1'), 'https://embeds.now/mobile.twitter.com/a/1');
  // A quote closing the sentence would be percent-encoded into the link if it weren't split off.
  assert.equal(fix('see "https://x.com/u/1"'), 'see "https://embeds.now/x.com/u/1"');
  assert.equal(fix('(https://x.com/u/1).'), '(https://embeds.now/x.com/u/1).');
});

test('unsupported hosts, already-fixed links and plain text are left unchanged', () => {
  for (const text of [
    'https://youtube.com/watch?v=1 and https://example.com/a',
    'https://embeds.now/x.com/a/1',
    'hello world, no links here',
  ]) {
    assert.deepEqual(service.fix(text), { changed: false, content: text });
  }
});

test('every supported link in a message is rewritten', () => {
  assert.equal(
    fix('olha https://x.com/a/1 e também https://www.tiktok.com/@u/video/9 agora'),
    'olha https://embeds.now/x.com/a/1 e também https://embeds.now/tiktok.com/@u/video/9 agora',
  );
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

  assert.equal(fix('`code` e https://x.com/u/2'), '`code` e https://embeds.now/x.com/u/2');
});
