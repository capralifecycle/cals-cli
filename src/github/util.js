export function getGroup(repo) {
    const projectTopics = [];
    let isInfra = false;
    repo.repositoryTopics.edges.forEach((edge) => {
        const name = edge.node.topic.name;
        if (name.startsWith("customer-")) {
            projectTopics.push(name.substring(9));
        }
        if (name.startsWith("project-")) {
            projectTopics.push(name.substring(8));
        }
        if (name === "infrastructure") {
            isInfra = true;
        }
    });
    if (projectTopics.length > 1) {
        console.warn(`Repo ${repo.name} has multiple project groups: ${projectTopics.join(", ")}. Picking first`);
    }
    if (projectTopics.length > 0) {
        return projectTopics[0];
    }
    if (isInfra) {
        return "infrastructure";
    }
    return null;
}
function ifnull(a, other) {
    return a === null ? other : a;
}
export function getGroupedRepos(repos) {
    return Object.values(repos.reduce((acc, repo) => {
        const group = ifnull(getGroup(repo), "(unknown)");
        const value = acc[group] || { name: group, items: [] };
        return {
            ...acc,
            [group]: {
                ...value,
                items: [...value.items, repo],
            },
        };
    }, {})).sort((a, b) => a.name.localeCompare(b.name));
}
export function includesTopic(repo, topic) {
    return repo.repositoryTopics.edges.some((it) => it.node.topic.name === topic);
}
export async function undefinedForNotFound(value) {
    try {
        return await value;
    }
    catch (e) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (e.name === "HttpError" && e.status === 404) {
            return undefined;
        }
        else {
            throw e;
        }
    }
}
