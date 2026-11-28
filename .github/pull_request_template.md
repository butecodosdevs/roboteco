## Summary

<!-- What changes for members, staff or plugin authors, and why. One PR per feature. -->

-

**Breaking changes:** <!-- none, or what breaks and how to migrate -->

## Testing

<!-- Say what you ran and what it showed. Tests must be able to fail when the behaviour is wrong: assert outcomes (rows, messages sent, roles changed, refusals), not values the test set itself. -->

- [ ] `pnpm typecheck`, `pnpm lint` and `pnpm build` pass
-
- Tried on a live Discord server: <!-- yes, or not yet -->

## After merging

<!-- Remove the lines that don't apply. -->

- `pnpm db:migrate`
- `pnpm plugins:build`
- `pnpm deploy-commands`
- New bot permissions or intents:

## Checklist

- [ ] Every user-facing text is in all locales (`en-US`, `pt-BR`)
- [ ] Schema changes come with a generated migration that is compatible with the previous release
- [ ] New server or user data is deleted by `onGuildRemove` / `onUserErase`
- [ ] Docs and `AGENTS.md` updated where behaviour or conventions changed
