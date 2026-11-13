<div align="center">

<img src="public/icons/icon-128.png" alt="" width="96">

# Instagram Downloader (shbernal fork)

Download Instagram and Threads photos and videos, with a keyboard shortcut.

[![License][license-badge]][license]
[![Upstream][upstream-badge]][upstream]

---

[What this fork adds](#what-this-fork-adds) • [Install](#install) • [Docs](#docs) • [Lineage](#lineage)

---

</div>

![Download buttons on an Instagram post](https://github.com/TheKonka/instagram-download-browser-extension/assets/22173084/98b823d7-c873-4290-a230-949e8d6f3b6f)

A browser extension that adds download buttons to posts, reels, stories, highlights and profiles on Instagram, and to posts on Threads.
Optional buttons open the media in a new tab or download a whole carousel as a zip.

This fork tracks [TheKonka/instagram-download-browser-extension][upstream] and adds a few changes for daily use in Zen and other Firefox-based browsers.

## What this fork adds

- Press `d` to download the post, reel or story nearest the center of the screen. It does nothing while you type in a comment, search box or DM.
- Its own Firefox add-on ID, `instagram-download@shbernal`, signed as an unlisted add-on on AMO. It installs as a separate add-on from upstream's.
- `pnpm build:*` exits when the build finishes. `pnpm dev:*` watches for changes.
- `scripts/zen-release.sh` bumps the version, builds, signs and opens the signed `.xpi` in Zen.

Everything else behaves like upstream.

## Install

The fork has no store listing, so you build it and load it yourself.

```bash
pnpm install
```

```bash
pnpm build:ff
```

In Firefox, open `about:debugging#/runtime/this-firefox`, choose "Load Temporary Add-on" and pick `dist/firefox/manifest.json`.
Firefox removes temporary add-ons when it closes. For a permanent install, sign the build with [`scripts/zen-release.sh`](docs/release.md).

For Chrome, run `pnpm build:chrome` and load `dist/chrome` as an unpacked extension from `chrome://extensions`.

Firefox opens the options page on first install. Grant access to `instagram.com` and `threads.com` there, or no buttons appear.

## Docs

- [docs/fork.md](docs/fork.md): branches, syncing with upstream, sending fixes upstream
- [docs/release.md](docs/release.md): signing and installing a release in Zen
- [docs/architecture.md](docs/architecture.md): how the extension finds media and downloads it

## Lineage

[Konka][upstream] wrote the extension, starting from [Instagram_Download_Button](https://github.com/y252328/Instagram_Download_Button).
Fixes from this fork that help everyone go upstream as pull requests.

[license]: LICENSE
[license-badge]: https://img.shields.io/github/license/shbernal/instagram-download-browser-extension?style=for-the-badge&color=7aa2f7&labelColor=1a1b26
[upstream]: https://github.com/TheKonka/instagram-download-browser-extension
[upstream-badge]: https://img.shields.io/badge/upstream-TheKonka-bb9af7?style=for-the-badge&logo=github&logoColor=bb9af7&labelColor=1a1b26
