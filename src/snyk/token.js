import keytar from "keytar";
export class SnykTokenCliProvider {
    keyringService = "cals";
    keyringAccount = "snyk-token";
    async getToken() {
        if (process.env.CALS_SNYK_TOKEN) {
            return process.env.CALS_SNYK_TOKEN;
        }
        const result = await keytar.getPassword(this.keyringService, this.keyringAccount);
        if (result == null) {
            process.stderr.write("No token found. Register using `cals snyk set-token`\n");
            return undefined;
        }
        return result;
    }
    async markInvalid() {
        await keytar.deletePassword(this.keyringService, this.keyringAccount);
    }
    async setToken(value) {
        await keytar.setPassword(this.keyringService, this.keyringAccount, value);
    }
}
