/**
 * Module-level image URL cache shared between VideoCard and useImagePreload.
 * Survives VirtuosoGrid remount cycles — if a URL is in this set, the image
 * is already in the browser cache and VideoCard can skip the skeleton entirely.
 */
export const loadedImageUrls = new Set<string>();
