import cachedir from "cachedir";
import fs from "fs";
import https from "https";
import os from "os";
import path from "path";
export class Config {
    cwd = path.resolve(process.cwd());
    configFile = path.join(os.homedir(), ".cals-config.json");
    cacheDir = cachedir("cals-cli");
    agent = new https.Agent({
        keepAlive: true,
    });
    configCached = undefined;
    get config() {
        const existingConfig = this.configCached;
        if (existingConfig !== undefined) {
            return existingConfig;
        }
        const config = this.readConfig();
        this.configCached = config;
        return config;
    }
    readConfig() {
        if (!fs.existsSync(this.configFile)) {
            return {};
        }
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return JSON.parse(fs.readFileSync(this.configFile, "utf-8"));
        }
        catch (e) {
            console.error("Failed", e);
            throw new Error("Failed to read config");
        }
    }
    getConfig(key) {
        return this.config[key];
    }
    requireConfig(key) {
        const result = this.config[key];
        if (result === undefined) {
            throw Error(`Configuration for ${key} missing. Add manually to ${this.configFile}`);
        }
        return result;
    }
    updateConfig(key, value) {
        const updatedConfig = {
            ...this.readConfig(),
            [key]: value, // undefined will remove
        };
        fs.writeFileSync(this.configFile, JSON.stringify(updatedConfig, null, "  "));
        this.configCached = updatedConfig;
    }
}
