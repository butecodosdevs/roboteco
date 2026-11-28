const linkPattern = /https?:\/\/[^\s<>`"]+/gi;
// A link at the end of a sentence picks up the sentence's punctuation or markdown.
const trailing = /[.,!?;:)\]}>'"|*_~]+$/;

/** Every http(s) link in the text, normalized by the URL parser, in order of appearance. */
export function findLinks(text: string): string[] {
  const links: string[] = [];

  for (const [match] of text.matchAll(linkPattern)) {
    const url = URL.parse(match.replace(trailing, ''));
    if (url) links.push(url.href);
  }

  return links;
}
