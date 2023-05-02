import { strict as assert } from "assert";
export class TestExecutor {
    shutdown = false;
    cleanupTask = null;
    usingWithCleanupTasks = false;
    tasks = [];
    /**
     * Check if we are currently in shutdown state due to user
     * asking to abort (Ctrl+C).
     */
    checkCanContinue() {
        if (this.shutdown) {
            throw new Error("In shutdown mode - aborting");
        }
    }
    async runTasks() {
        console.warn("Running cleanup tasks");
        while (true) {
            // We must run tasks in reverse order due to dependencies.
            // E.g. we cannot delete a Docker network before deleting
            // the container using it.
            const task = this.tasks.pop();
            if (task === undefined) {
                return;
            }
            try {
                await task();
            }
            catch (error) {
                console.error(error);
            }
        }
    }
    /**
     * Register a task that will be run during cleanup phase.
     */
    registerCleanupTask(task) {
        if (!this.usingWithCleanupTasks) {
            throw new Error("registerCleanupTask run outside runWithCleanupTasks");
        }
        this.tasks.push(task);
        this.checkCanContinue();
    }
    /**
     * Run the code block while ensuring we can run cleanup tasks
     * after the execution or if the process is interrupted.
     *
     * The main method of the program should be executed by using
     * this method.
     */
    async runWithCleanupTasks(body) {
        try {
            assert.strictEqual(this.usingWithCleanupTasks, false);
            this.usingWithCleanupTasks = true;
            // We capture Ctrl+C so that we can perform cleanup task,
            // since the cleanup tasks involve async code which is not
            // supported during NodeJS normal exit handling.
            //
            // This will not abort the running tasks until after
            // we have completed the cleanup tasks. The running tasks
            // can stop earlier by calling checkCanContinue.
            process.on("SIGINT", () => {
                console.warn("Caught interrupt signal - forcing termination");
                if (this.cleanupTask != null) {
                    return;
                }
                this.shutdown = true;
                this.cleanupTask = this.runTasks().then(() => {
                    process.exit(1);
                });
            });
            await body(this);
        }
        catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            console.error(error.stack || error.message || error);
            process.exitCode = 1;
        }
        finally {
            console.log(`Reached finally block`);
            this.usingWithCleanupTasks = false;
            if (this.cleanupTask == null) {
                this.cleanupTask = this.runTasks();
            }
            await this.cleanupTask;
        }
    }
}
export function createTestExecutor() {
    return new TestExecutor();
}
