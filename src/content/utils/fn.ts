import { MESSAGE_OPEN_URL } from '../../constants';
import { DownloadParams, getFilenameFromUrl } from './filename';

import { storageCache } from './storage';
import { shortcodeToMediaId } from '../../media';
import { findVisibleCarouselIndex, lookupPost } from './media';

export async function openInNewTab(url: string) {
    try {
        await chrome.runtime.sendMessage({ type: MESSAGE_OPEN_URL, data: url });
    } catch {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

async function forceDownload(blob: string, filename: string, extension: string) {
    const { setting_format_replace_jpeg_with_jpg } = storageCache.settings;
    if (setting_format_replace_jpeg_with_jpg) {
        extension = extension.replace('jpeg', 'jpg');
    }
    const a = document.createElement('a');
    a.href = blob;
    a.download = `${filename}.${extension}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(blob);
    }, 100);
}

const mediaInfoCache: Map<string, any> = new Map(); // key: media id, value: info json
const mediaIdCache: Map<string, string> = new Map(); // key: post id, value: media id

const findAppId = () => {
    const appIdPattern = /"X-IG-App-ID":"([\d]+)"/;
    const bodyScripts: NodeListOf<HTMLScriptElement> = document.querySelectorAll('body > script');
    for (let i = 0; i < bodyScripts.length; ++i) {
        const match = bodyScripts[i].text.match(appIdPattern);
        if (match) return match[1];
    }
    console.log('Cannot find app id');
    return null;
};

function findPostId(articleNode: HTMLElement) {
    const pathname = window.location.pathname;
    if (pathname.startsWith('/reels/')) {
        return pathname.split('/')[2];
    } else if (pathname.startsWith('/stories/')) {
        return pathname.split('/')[3];
    } else if (pathname.startsWith('/reel/')) {
        return pathname.split('/')[2];
    }
    const postIdPattern = /\/p\/([^/]+)\//;
    const aNodes = articleNode.querySelectorAll('a');
    for (let i = 0; i < aNodes.length; ++i) {
        const link = aNodes[i].getAttribute('href');
        if (link) {
            const match = link.match(postIdPattern);
            if (match) return match[1];
            const arr = link.split('/').filter(e => e);
            if (arr.length === 3 && arr[1] === "reel") {
                return arr[2]
            }
        }
    }
    return null;
}

const findMediaId = async (postId: string) => {
    const mediaIdPattern = /instagram:\/\/media\?id=(\d+)|["' ]media_id["' ]:["' ](\d+)["' ]/;
    const match = window.location.href.match(/www.instagram.com\/stories\/[^/]+\/(\d+)/);
    if (match) return match[1];
    if (!mediaIdCache.has(postId)) {
        // The shortcode decodes to the media id; only fetch the post page if it is not a shortcode.
        let mediaId = shortcodeToMediaId(postId);
        if (!mediaId) {
            const resp = await fetch(`https://www.instagram.com/p/${postId}/`);
            const idMatch = (await resp.text()).match(mediaIdPattern);
            mediaId = idMatch?.[1] || idMatch?.[2] || null;
        }
        if (!mediaId) return null;
        mediaIdCache.set(postId, mediaId);
    }
    return mediaIdCache.get(postId);
};

export const getImgOrVideoUrl = (item: Record<string, any>) => {
    if ('video_versions' in item) {
        return item.video_versions[0].url;
    } else {
        return item.image_versions2.candidates[0].url;
    }
};

export const getDataFromAPI = async (articleNode: HTMLElement) => {
    try {
        const postId = findPostId(articleNode);
        if (!postId) {
            console.log('Cannot find post id');
            return null;
        }
        // Prefer data Instagram already sent to the page; the info API is the fallback.
        const known = await lookupPost(postId);
        if (known) return known;
        const appId = findAppId();
        if (!appId) {
            console.log('Cannot find appid');
            return null;
        }
        const mediaId = await findMediaId(postId);
        if (!mediaId) {
            console.log('Cannot find media id');
            return null;
        }
        if (!mediaInfoCache.has(mediaId)) {
            const url = 'https://i.instagram.com/api/v1/media/' + mediaId + '/info/';
            const resp = await fetch(url, {
                method: 'GET',
                headers: {
                    Accept: '*/*',
                    'X-IG-App-ID': appId,
                },
                credentials: 'include',
                mode: 'cors',
                referrerPolicy: 'no-referrer',
            });

            if (resp.status !== 200) {
                console.log(`Fetch info API failed with status code: ${resp.status}`);
                return null;
            }
            const respJson = await resp.json();
            mediaInfoCache.set(mediaId, respJson);
        }
        const infoJson = mediaInfoCache.get(mediaId);
        return infoJson.items[0];
    } catch (e: any) {
        console.log(`Uncaught in getUrlFromInfoApi(): ${e}\n${e.stack}`);
        return null;
    }
};

function toMediaResult(data: Record<string, any>, mediaIdx: number) {
    if (Array.isArray(data.carousel_media)) {
        // multi-media post
        const item = data.carousel_media[Math.max(mediaIdx, 0)];
        return {
            ...item,
            url: getImgOrVideoUrl(item),
            taken_at: data.taken_at,
            owner: item.owner?.username || data.owner?.username || "unknown",
            coauthor_producers: data.coauthor_producers?.map((i: any) => i.username) || [],
            origin_data: data,
        };
    } else {
        // single media post
        return {
            ...data,
            url: getImgOrVideoUrl(data),
            owner: data.owner?.username || "unknown",
            coauthor_producers: data.coauthor_producers?.map((i: any) => i.username) || [],
        };
    }
}

export const getUrlFromInfoApi = async (articleNode: HTMLElement, mediaIdx = 0): Promise<Record<string, any> | null> => {
    const data = await getDataFromAPI(articleNode);
    if (!data) return null;
    return toMediaResult(data, mediaIdx);
};

/**
 * Resolve the media on screen from post data alone: single posts directly, carousels by matching the
 * rendered slide's file name. Returns null when that is not possible, so callers can fall back to
 * reading the carousel dots.
 */
export async function resolveVisibleMedia(container: HTMLElement) {
    const data = await getDataFromAPI(container);
    if (!data) return null;
    if (!Array.isArray(data.carousel_media)) {
        const res = toMediaResult(data, 0);
        return { url: res.url as string, res, mediaIndex: -1 };
    }
    const mediaIndex = findVisibleCarouselIndex(container, data);
    if (mediaIndex < 0) return null;
    const res = toMediaResult(data, mediaIndex);
    return { url: res.url as string, res, mediaIndex };
}

export async function downloadResource(params: DownloadParams) {
    const { url } = params
    console.log(`Downloading ${url}`);
    const filename = await getFilenameFromUrl(params);

    if (url.startsWith('blob:')) {
        forceDownload(url, filename, 'mp4');
        return;
    }
    fetch(url, {
        headers: new Headers({
            Origin: location.origin,
        }),
        mode: 'cors',
    })
        .then((response) => response.blob())
        .then((blob) => {
            const extension = blob.type.split('/').pop();
            const blobUrl = window.URL.createObjectURL(blob);
            forceDownload(blobUrl, filename, extension || 'jpg');
        })
        .catch((e) => console.error(e));
}

export const checkType = () => {
    if (navigator && navigator.userAgent && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
        if (navigator && navigator.userAgent && /(iPhone|iPad|iPod|iOS)/i.test(navigator.userAgent)) {
            return 'ios';
        } else {
            return 'android';
        }
    } else {
        return 'pc';
    }
};

export async function fetchHtml() {
    const resp = await fetch(window.location.href, {
        referrerPolicy: 'no-referrer',
    });
    const content = await resp.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    return doc.querySelectorAll('script');
}
