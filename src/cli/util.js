import fs from "fs";
import { deprecate } from "util";
import { CacheProvider } from "../cache";
import { Config } from "../config";
import { DefinitionFile } from "../definition/definition";
import { Reporter } from "./reporter";
export function createReporter(argv) {
    return new Reporter({
        verbose: !!argv.verbose,
        nonInteractive: !!argv.nonInteractive,
    });
}
export function createCacheProvider(config, argv) {
    const cache = new CacheProvider(config);
    // --validate-cache
    if (argv.validateCache === true) {
        cache.mustValidate = true;
    }
    // old option: --no-cache
    if (argv.cache === false) {
        deprecate(() => {
            cache.mustValidate = true;
        }, "The --no-cache option is deprecated. See new --validate-cache option")();
    }
    return cache;
}
export function createConfig() {
    return new Config();
}
export const definitionFileOptionName = "definition-file";
export const definitionFileOptionValue = {
    describe: "Path to definition file, which should be the latest resources.yaml file from https://github.com/capralifecycle/resources-definition",
    required: true,
    type: "string",
};
export function getDefinitionFile(argv) {
    if (argv.definitionFile === undefined) {
        throw Error("Missing --definition-file option");
    }
    const definitionFile = argv.definitionFile;
    if (!fs.existsSync(definitionFile)) {
        throw Error(`The file ${definitionFile} does not exist`);
    }
    return new DefinitionFile(definitionFile);
}
