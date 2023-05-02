export function wasUpdated(output) {
    return output.startsWith("Updating ");
}
export function getUpdateRange(output) {
    const match = /Updating ([a-f0-9]+)\.\.([a-f0-9]+)\n/.exec(output);
    if (match === null) {
        return null;
    }
    return {
        from: match[1],
        to: match[2],
    };
}
export function getCompareLink(range, owner, name) {
    const compare = `${range.from}...${range.to}`;
    return `https://github.com/${owner}/${name}/compare/${compare}`;
}
/**
 * Parse output from `git shortlog -c`.
 */
export function parseShortlogSummary(value) {
    const matches = [...value.matchAll(/^\s*(\d+)\s+(.+)$/gm)];
    return matches.map((it) => ({
        name: it[2],
        count: parseInt(it[1]),
    }));
}
