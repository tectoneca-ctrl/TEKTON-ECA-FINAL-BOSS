# Frontend deployment

Live website: https://tekton-eca-final-boss.pages.dev
Source: https://github.com/tectoneca-ctrl/TEKTON-ECA-FINAL-BOSS

## Current setup: Cloudflare Pages Direct Upload

This project uses Direct Upload through the authenticated Wrangler CLI. GitHub stores the source, but a GitHub push does not automatically update this website. Build and upload again to publish changes.

| Setting | Value |
| --- | --- |
| Pages project | `tekton-eca-final-boss` |
| Production branch | `main` |
| Framework | React / Vite |
| Project root | Repository root |
| Build command | `npm run build` |
| Upload directory | `dist` |
| Production URL | https://tekton-eca-final-boss.pages.dev |

The existing `tectonv10` Pages project is separate from this deployment.

## Publish an update

Run these commands from the intended project folder (currently `C:\Users\adria\Downloads\tekton-eca (12)`). Wrangler must be installed and logged into the Cloudflare account that owns the Pages project. Use `wrangler login` if authentication is needed; keep credentials out of this repository.

```powershell
npm ci
npm run build
wrangler pages deploy dist --project-name tekton-eca-final-boss --branch main
```

Continue to the upload only if the build succeeds. `npm run build` checks TypeScript and creates the production files in `dist/`. The upload replaces the site's production version and returns a unique deployment URL. The stable production URL stays the same.

To check the build locally before uploading:

```powershell
npm run preview
```

Commit and push source changes separately so GitHub stays current. Do not commit `dist/`, `node_modules/`, credentials, or private environment files.

## First deployment

- Date: 2026-11-14
- Application source commit: `6517b567470648c5a742d2f65249d2dad7ac7870`
- Deployment URL: https://ad82eeae.tekton-eca-final-boss.pages.dev
- TypeScript and Vite production build passed before upload.

## Automatic deployments later

A Direct Upload Pages project cannot be converted into a built-in Git integration project. For Cloudflare's built-in GitHub integration, create a separate Pages project and connect the repository with build command `npm run build` and output directory `dist`. Alternatively, a separately configured CI workflow can build and upload to this Direct Upload project. Neither automation is configured now.

## Current backend status

This is still the browser-storage demo. Users and business records are stored in localStorage, and uploaded files are stored in IndexedDB. Hosting the frontend does not create shared records or production authentication. Data already saved in a local development browser is not copied to the live website by this deployment.

Supabase has not been integrated yet. No Supabase environment variables are required by the current build. When that integration is implemented, configure the project URL and publishable key in the build environment; never put database passwords, secret keys, or service-role keys in VITE_ variables.

References: [Build settings](https://developers.cloudflare.com/pages/configuration/build-configuration/), [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/), [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).
