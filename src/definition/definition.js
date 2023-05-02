import AJV from "ajv";
import fs from "fs";
import yaml from "js-yaml";
import { uniq } from "lodash";
import schema from "../definition-schema.json";
function getTeamId(org, teamName) {
    return `${org}/${teamName}`;
}
export function getRepoId(orgName, repoName) {
    return `${orgName}/${repoName}`;
}
function checkAgainstSchema(value) {
    const ajv = new AJV({ allErrors: true });
    const valid = ajv.validate(schema, value);
    return valid
        ? { definition: value }
        : { error: ajv.errorsText() ?? "Unknown error" };
}
function requireValidDefinition(definition) {
    // Verify no duplicates in users and extract known logins.
    const loginList = definition.github.users.reduce((acc, user) => {
        if (acc.includes(user.login)) {
            throw new Error(`Duplicate login: ${user.login}`);
        }
        return [...acc, user.login];
    }, []);
    // Verify no duplicates in teams and extract team names.
    const teamIdList = definition.github.teams.reduce((acc, orgTeams) => {
        return orgTeams.teams.reduce((acc1, team) => {
            const id = getTeamId(orgTeams.organization, team.name);
            if (acc1.includes(id)) {
                throw new Error(`Duplicate team: ${id}`);
            }
            return [...acc1, id];
        }, acc);
    }, []);
    // Verify team members exists as users.
    definition.github.teams
        .map((it) => it.teams)
        .flat()
        .forEach((team) => {
        team.members.forEach((login) => {
            if (!loginList.includes(login)) {
                throw new Error(`Team member ${login} in team ${team.name} is not registered in user list`);
            }
        });
    });
    // Verify no duplicates in project names.
    definition.projects.reduce((acc, project) => {
        if (acc.includes(project.name)) {
            throw new Error(`Duplicate project: ${project.name}`);
        }
        return [...acc, project.name];
    }, []);
    definition.projects.forEach((project) => {
        project.github.forEach((org) => {
            // Verify project teams exists as teams.
            ;
            (org.teams || []).forEach((team) => {
                const id = getTeamId(org.organization, team.name);
                if (!teamIdList.includes(id)) {
                    throw new Error(`Project team ${id} in project ${project.name} is not registered in team list`);
                }
            });
            (org.repos || []).forEach((repo) => {
                ;
                (repo.teams || []).forEach((team) => {
                    const id = getTeamId(org.organization, team.name);
                    if (!teamIdList.includes(id)) {
                        throw new Error(`Repo team ${id} for repo ${repo.name} in project ${project.name} is not registered in team list`);
                    }
                });
            });
        });
    });
    // Verify no duplicates in repos.
    definition.projects
        .flatMap((project) => project.github
        .map((org) => (org.repos || []).map((repo) => getRepoId(org.organization, repo.name)))
        .flat())
        .reduce((acc, repoName) => {
        if (acc.includes(repoName)) {
            throw new Error(`Duplicate repo: ${repoName}`);
        }
        return [...acc, repoName];
    }, []);
}
export class DefinitionFile {
    path;
    constructor(path) {
        this.path = path;
    }
    async getContents() {
        return new Promise((resolve, reject) => fs.readFile(this.path, "utf-8", (err, data) => {
            if (err)
                reject(err);
            else
                resolve(data);
        }));
    }
    async getDefinition() {
        return parseDefinition(await this.getContents());
    }
}
export function parseDefinition(value) {
    const result = checkAgainstSchema(yaml.load(value));
    if ("error" in result) {
        throw new Error("Definition content invalid: " + result.error);
    }
    requireValidDefinition(result.definition);
    return result.definition;
}
export function getRepos(definition) {
    return definition.projects.flatMap((project) => project.github
        .map((org) => (org.repos || []).map((repo) => ({
        id: getRepoId(org.organization, repo.name),
        orgName: org.organization,
        project,
        repo,
    })))
        .flat());
}
export function getGitHubOrgs(definition) {
    return uniq(definition.projects.flatMap((project) => project.github.map((it) => it.organization)));
}
export { schema };
