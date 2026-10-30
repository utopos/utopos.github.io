## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Dependencies

- Package manager is pnpm (not npm). Use `pnpm update`, `pnpm outdated`.
- Keep `typescript` pinned to `^6`. TypeScript 7 breaks `astro check` ("does not currently support TypeScript 7.0"). `pnpm update --latest` will bump it to 7, so re-pin with `pnpm add -D typescript@^6` afterwards. Revisit once `@astrojs/ts-content-mapper` (TS 7.1+ support) is stable.
- After dependency updates, verify with `pnpm astro check` and `pnpm astro build`.
