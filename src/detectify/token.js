import keytar from "keytar";
export class DetectifyTokenCliProvider {
    keyringService = "cals";
    keyringAccount = "detectify-token";
    async getToken() {
        if (process.env.CALS_DETECTIFY_TOKEN) {
            return process.env.CALS_DETECTIFY_TOKEN;
        }
        const result = await keytar.getPassword(this.keyringService, this.keyringAccount);
        if (result == null) {
            process.stderr.write("No token found. Register using `cals detectify set-token`\n");
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
