import fetch from "node-fetch";
import { SnykTokenCliProvider } from "./token";
export class SnykService {
    config;
    tokenProvider;
    constructor(props) {
        this.config = props.config;
        this.tokenProvider = props.tokenProvider;
    }
    async getProjects(definition) {
        const snykAccountId = definition.snyk?.accountId;
        if (snykAccountId === undefined) {
            return [];
        }
        return this.getProjectsByAccountId(snykAccountId);
    }
    async getProjectsByAccountId(snykAccountId) {
        const token = await this.tokenProvider.getToken();
        if (token === undefined) {
            throw new Error("Missing token for Snyk");
        }
        const response = await fetch(`https://snyk.io/api/v1/org/${encodeURIComponent(snykAccountId)}/projects`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: `Basic ${token}:`,
            },
            agent: this.config.agent,
        });
        if (response.status === 401) {
            process.stderr.write("Unauthorized - removing token\n");
            await this.tokenProvider.markInvalid();
        }
        if (!response.ok) {
            throw new Error(`Response from Snyk not OK (${response.status}): ${JSON.stringify(response)}`);
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return (await response.json()).projects;
    }
}
export function createSnykService(props) {
    return new SnykService({
        config: props.config,
        tokenProvider: props.tokenProvider ?? new SnykTokenCliProvider(),
    });
}
