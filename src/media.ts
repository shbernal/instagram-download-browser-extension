// Shape-based extraction of Instagram media objects.
//
// Instead of reading data from fixed GraphQL paths (which break whenever Instagram renames a root
// key such as `xdt_api__v1__...`), walk any JSON payload and keep every object that looks like a
// post: it has a shortcode and media URLs. Shared by the background scripts and the content script.

export interface MediaCandidate {
    url: string;
    width?: number;
    height?: number;
}

export interface MediaNode {
    pk?: string | number;
    id?: string;
    code?: string;
    media_type?: number;
    taken_at?: number;
    owner?: { username?: string };
    coauthor_producers?: { username?: string }[];
    caption?: { text?: string } | null;
    image_versions2?: { candidates?: MediaCandidate[] };
    video_versions?: MediaCandidate[];
    carousel_media?: MediaNode[];

    [key: string]: any;
}

const MEDIA_TYPE_IMAGE = 1;
const MEDIA_TYPE_VIDEO = 2;
const MEDIA_TYPE_CAROUSEL = 8;

function hasUrls(list: unknown): list is MediaCandidate[] {
    return Array.isArray(list) && list.length > 0 && typeof list[0]?.url === 'string';
}

function looksLikeMedia(obj: Record<string, any>) {
    return hasUrls(obj.image_versions2?.candidates) || hasUrls(obj.video_versions) || Array.isArray(obj.carousel_media);
}

/**
 * True when the node carries everything needed to download it. Some queries (grids, previews)
 * return a video post with only its cover image; caching those would download the thumbnail.
 */
export function isComplete(node: MediaNode): boolean {
    const type = node.media_type;
    if (type === MEDIA_TYPE_CAROUSEL || Array.isArray(node.carousel_media)) {
        return Array.isArray(node.carousel_media) && node.carousel_media.length > 0 && node.carousel_media.every(isComplete);
    }
    if (type === MEDIA_TYPE_VIDEO) return hasUrls(node.video_versions);
    if (type === MEDIA_TYPE_IMAGE) return hasUrls(node.image_versions2?.candidates);
    return hasUrls(node.video_versions) || hasUrls(node.image_versions2?.candidates);
}

/** Collect every post-shaped object (one with a shortcode) found anywhere in `json`. */
export function collectPosts(json: unknown): MediaNode[] {
    const found: MediaNode[] = [];
    const stack: unknown[] = [json];
    while (stack.length) {
        const value = stack.pop();
        if (!value || typeof value !== 'object') continue;
        if (Array.isArray(value)) {
            for (const v of value) stack.push(v);
            continue;
        }
        const obj = value as Record<string, any>;
        if (typeof obj.code === 'string' && looksLikeMedia(obj)) {
            found.push(obj as MediaNode);
            continue; // carousel children belong to this post, no need to descend
        }
        for (const key in obj) stack.push(obj[key]);
    }
    return found;
}

/** Keep only the fields the downloader uses, normalising GraphQL and REST variants. */
export function slimMedia(node: MediaNode): MediaNode {
    const owner = node.owner ?? node.user;
    const slim: MediaNode = {
        pk: node.pk,
        id: node.id,
        code: node.code,
        media_type: node.media_type,
        taken_at: node.taken_at,
        owner: owner?.username ? { username: owner.username } : undefined,
    };
    if (Array.isArray(node.coauthor_producers)) {
        slim.coauthor_producers = node.coauthor_producers.map((i) => ({ username: i?.username }));
    }
    if (node.caption?.text) slim.caption = { text: node.caption.text };
    if (hasUrls(node.image_versions2?.candidates)) slim.image_versions2 = { candidates: node.image_versions2!.candidates };
    if (hasUrls(node.video_versions)) slim.video_versions = node.video_versions;
    if (Array.isArray(node.carousel_media)) slim.carousel_media = node.carousel_media.map(slimMedia);
    return slim;
}

/**
 * Stable key for one asset: the file name of its CDN URL without the extension. The different
 * sizes in `image_versions2.candidates` and the `<img src>` / `<video poster>` Instagram renders
 * all share it, while the query string (size, signature) differs.
 */
export function assetKey(url: string | null | undefined): string | null {
    if (!url || url.startsWith('blob:') || url.startsWith('data:')) return null;
    try {
        const { pathname } = new URL(url, 'https://www.instagram.com');
        const base = pathname.slice(pathname.lastIndexOf('/') + 1);
        const stem = base.replace(/\.[^.]+$/, '');
        return stem.length >= 8 ? stem : null;
    } catch {
        return null;
    }
}

export function mediaAssetKeys(node: MediaNode): string[] {
    const keys = new Set<string>();
    for (const c of node.image_versions2?.candidates ?? []) {
        const key = assetKey(c.url);
        if (key) keys.add(key);
    }
    return [...keys];
}

const SHORTCODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** A shortcode is the media id in URL-safe base64. Private posts append extra characters after 11. */
export function shortcodeToMediaId(code: string): string | null {
    if (!/^[A-Za-z0-9_-]+$/.test(code)) return null;
    let id = 0n;
    for (const c of code.slice(0, 11)) {
        id = id * 64n + BigInt(SHORTCODE_ALPHABET.indexOf(c));
    }
    return id.toString();
}
