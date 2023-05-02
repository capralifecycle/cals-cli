import fs from "fs";
import path from "path";
import rimraf from "rimraf";
export class CacheProvider {
    constructor(config) {
        this.config = config;
    }
    mustValidate = false;
    config;
    defaultCacheTime = 1800;
    /**
     * Retrieve cache if existent, ignoring the time.
     *
     * The caller is responsible for handling proper validation,
     */
    retrieveJson(cachekey) {
        const cachefile = path.join(this.config.cacheDir, `${cachekey}.json`);
        if (!fs.existsSync(cachefile)) {
            return undefined;
        }
        const data = fs.readFileSync(cachefile, "utf-8");
        return {
            cacheTime: fs.statSync(cachefile).mtime.getTime(),
            data: (data === "undefined" ? undefined : JSON.parse(data)),
        };
    }
    /**
     * Save data to cache.
     */
    storeJson(cachekey, data) {
        const cachefile = path.join(this.config.cacheDir, `${cachekey}.json`);
        if (!fs.existsSync(this.config.cacheDir)) {
            fs.mkdirSync(this.config.cacheDir, { recursive: true });
        }
        fs.writeFileSync(cachefile, data === undefined ? "undefined" : JSON.stringify(data));
    }
    async json(cachekey, block, cachetime = this.defaultCacheTime) {
        const cacheItem = this.mustValidate
            ? undefined
            : this.retrieveJson(cachekey);
        const expire = new Date(new Date().getTime() - cachetime * 1000).getTime();
        if (cacheItem !== undefined && cacheItem.cacheTime > expire) {
            return cacheItem.data;
        }
        const result = await block();
        this.storeJson(cachekey, result);
        return result;
    }
    /**
     * Delete all cached data.
     */
    cleanup() {
        rimraf.sync(this.config.cacheDir);
    }
}
