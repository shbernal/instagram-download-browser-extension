import { assetKey, collectPosts, isComplete, mediaAssetKeys, slimMedia, type MediaNode } from '../../media';

/** Find a post by shortcode in the background's response index, then in the page's own JSON. */
export async function lookupPost(code: string): Promise<MediaNode | null> {
    try {
        const { media_index } = await chrome.storage.local.get(['media_index']);
        const hit = new Map<string, MediaNode>(media_index).get(code);
        if (hit) return hit;
    } catch (e) {
        console.warn('media_index lookup failed', e);
    }
    return findPostInPageScripts(code);
}

/**
 * On a full page load the first post arrives inside server-rendered
 * `<script type="application/json">` blobs instead of an XHR, so the background never sees it.
 */
function findPostInPageScripts(code: string): MediaNode | null {
    const needle = `"code":"${code}"`;
    for (const script of document.querySelectorAll<HTMLScriptElement>('script[type="application/json"]')) {
        const text = script.textContent;
        if (!text || !text.includes(needle)) continue;
        try {
            const post = collectPosts(JSON.parse(text)).find((p) => p.code === code && isComplete(p));
            if (post) return slimMedia(post);
        } catch {
            // not JSON we understand
        }
    }
    return null;
}

/** Area of `el` actually on screen, after clipping by every overflow-hidden ancestor and the viewport. */
function visibleArea(el: Element): number {
    const r = el.getBoundingClientRect();
    let left = Math.max(r.left, 0);
    let top = Math.max(r.top, 0);
    let right = Math.min(r.right, window.innerWidth);
    let bottom = Math.min(r.bottom, window.innerHeight);
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
        const ar = a.getBoundingClientRect();
        left = Math.max(left, ar.left);
        top = Math.max(top, ar.top);
        right = Math.min(right, ar.right);
        bottom = Math.min(bottom, ar.bottom);
        if (right <= left || bottom <= top) return 0;
    }
    return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function elementUrls(el: HTMLImageElement | HTMLVideoElement): (string | null)[] {
    if (el instanceof HTMLVideoElement) return [el.getAttribute('poster')];
    const fromSrcset = (el.getAttribute('srcset') ?? '').split(',').map((s) => s.trim().split(/\s+/)[0]);
    return [el.currentSrc, el.getAttribute('src'), ...fromSrcset];
}

/**
 * Which carousel slide is on screen: match the file name of each rendered `<img>` / `<video poster>`
 * against the slides' image candidates, and pick the match with the largest visible area.
 * Returns -1 when nothing matches, so callers can fall back to reading the carousel dots.
 */
export function findVisibleCarouselIndex(container: HTMLElement, post: MediaNode): number {
    if (!Array.isArray(post.carousel_media)) return -1;
    const keyToIndex = new Map<string, number>();
    post.carousel_media.forEach((child, i) => mediaAssetKeys(child).forEach((k) => keyToIndex.set(k, i)));

    let best = -1;
    let bestArea = 0;
    for (const el of container.querySelectorAll<HTMLImageElement | HTMLVideoElement>('img, video')) {
        let index: number | undefined;
        for (const url of elementUrls(el)) {
            const key = assetKey(url);
            if (key && keyToIndex.has(key)) {
                index = keyToIndex.get(key);
                break;
            }
        }
        if (index === undefined) continue;
        const area = visibleArea(el);
        if (area > bestArea) {
            best = index;
            bestArea = area;
        }
    }
    return best;
}
