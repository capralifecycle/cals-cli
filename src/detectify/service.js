import fetch from "node-fetch";
import { DetectifyTokenCliProvider } from "./token";
function requireOk(response) {
    if (!("ok" in response)) {
        throw new Error(`Response: ${response.error}`);
    }
    return response.ok;
}
export class DetectifyService {
    config;
    tokenProvider;
    constructor(props) {
        this.config = props.config;
        this.tokenProvider = props.tokenProvider;
    }
    async getRequest(url) {
        const token = await this.tokenProvider.getToken();
        if (token === undefined) {
            throw new Error("Missing token for Detectify");
        }
        const response = await fetch(url, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "X-Detectify-Key": `${token}`,
            },
            agent: this.config.agent,
        });
        if (response.status === 401) {
            process.stderr.write("Unauthorized - removing token\n");
            await this.tokenProvider.markInvalid();
        }
        if (response.status === 404) {
            return {
                error: "not-found",
            };
        }
        if (!response.ok) {
            throw new Error(`Response from Detectify not OK (${response.status}): ${JSON.stringify(response)}`);
        }
        return {
            ok: (await response.json()),
        };
    }
    async getScanProfiles() {
        return requireOk(await this.getRequest("https://api.detectify.com/rest/v2/profiles/"));
    }
    async getScanReportLatest(scanProfileToken) {
        const response = await this.getRequest(`https://api.detectify.com/rest/v2/reports/${encodeURIComponent(scanProfileToken)}/latest/`);
        if ("ok" in response) {
            return response.ok;
        }
        else if (response.error === "not-found") {
            return null;
        }
        else {
            throw new Error(`Unknown response: ${JSON.stringify(response)}`);
        }
    }
}
export function createDetectifyService(props) {
    return new DetectifyService({
        config: props.config,
        tokenProvider: props.tokenProvider ?? new DetectifyTokenCliProvider(),
    });
}
