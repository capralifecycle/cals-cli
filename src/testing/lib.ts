import execa from "execa"
import { performance } from "perf_hooks"
import { Transform } from "stream"
import { TestExecutor } from "./executor"

export interface Container {
  id: string
  name: string
  network: Network
  process: execa.ExecaChildProcess
  executor: TestExecutor
}

export interface Network {
  id: string
}

/**
 * Generate a value that can be used as part of resource names.
 *
 * Gives a value formatted as "yyyymmdd-xxxxxx", e.g. "20200523-3f2c87".
 */
function generateRunId(): string {
  const low = parseInt("100000", 16)
  const high = parseInt("ffffff", 16)
  const range = high - low + 1
  const now = new Date()
  return [
    now.getUTCFullYear(),
    (now.getUTCMonth() + 1).toString().padStart(2, "0"),
    now.getUTCDate().toString().padStart(2, "0"),
    "-",
    (Math.floor(Math.random() * range) + low).toString(16),
  ].join("")
}

/**
 * Generate a name that can be used for a resource.
 */
function generateName(extra?: string): string {
  const s = extra === undefined ? "" : `-${extra}`
  return `autotest-${generateRunId()}${s}`
}

/**
 * Create a new Docker network.
 */
export async function createNetwork(executor: TestExecutor): Promise<Network> {
  executor.checkCanContinue()
  const networkName = generateName()

  await execa("docker", ["network", "create", networkName])

  const lsRes = await execa("docker", [
    "network",
    "ls",
    "-q",
    "-f",
    `name=${networkName}`,
  ])
  const networkId = lsRes.stdout.trim()

  console.log(`Network ${networkName} (${networkId}) created`)

  executor.registerCleanupTask(async () => {
    await execa("docker", ["network", "rm", networkId])
    console.log(`Network ${networkName} (${networkId}) deleted`)
  })

  return {
    id: networkId,
  }
}

/**
 * Execute curl within the Docker network.
 */
export async function curl(
  executor: TestExecutor,
  network: Network,
  ...args: string[]
): Promise<string> {
  executor.checkCanContinue()
  const result = await execa("docker", [
    "run",
    "-i",
    "--rm",
    "--network",
    network.id,
    "byrnedo/alpine-curl",
    ...args,
  ])
  return result.stdout
}

/**
 * Repeatedly check for a condition until timeout.
 *
 * The condition can throw an error without aborting the loop.
 * To abort the condition must return false.
 */
export async function pollForCondition({
  container,
  attempts,
  waitIntervalSec,
  condition,
}: {
  container: Container
  attempts: number
  waitIntervalSec: number
  condition: () => Promise<boolean>
}): Promise<void> {
  function log(value: string) {
    console.log(`${container.name} (poll): ${value}`)
  }

  container.executor.checkCanContinue()
  log(
    `Waiting for condition.. Checking ${attempts} times by ${waitIntervalSec} sec`,
  )

  const start = performance.now()
  const duration = () => {
    const end = performance.now()
    return Math.round((end - start) / 1000)
  }

  for (let i = 0; i < attempts; i++) {
    container.executor.checkCanContinue()
    if (!(await isRunning(container.executor, container))) {
      throw new Error(`Container ${container.name} not running as expected`)
    }
    try {
      const result = await condition()
      if (!result) {
        break
      }

      log(`Took ${duration()} seconds for condition`)
      return
    } catch (e) {
      log("Still waiting...")
      await new Promise((resolve) =>
        setTimeout(resolve, waitIntervalSec * 1000),
      )
    }
  }

  throw new Error(`Failed to wait for container ${container.name}`)
}

export async function waitForHttpOk({
  container,
  url,
  attempts = 30,
  waitIntervalSec = 1,
}: {
  container: Container
  url: string
  attempts?: number
  waitIntervalSec?: number
}): Promise<void> {
  await pollForCondition({
    container,
    attempts,
    waitIntervalSec,
    condition: async () => {
      await curl(container.executor, container.network, "-fsS", url)
      return true
    },
  })
}

export async function waitForPostgresAvailable({
  container,
  attempts = 30,
  waitIntervalSec = 1,
  username = "user",
  password = "password",
  dbname,
}: {
  container: Container
  attempts?: number
  waitIntervalSec?: number
  username?: string
  password?: string
  dbname: string
}): Promise<void> {
  await pollForCondition({
    container,
    attempts,
    waitIntervalSec,
    condition: async () => {
      await execa("docker", [
        "exec",
        "-e",
        `PGPASSWORD=${password}`,
        container.name,
        "psql",
        "-h",
        "localhost",
        "-U",
        username,
        "-c",
        "select 1",
        dbname,
      ])
      return true
    },
  })
}

async function isRunning(
  executor: TestExecutor,
  container: Container,
): Promise<boolean> {
  executor.checkCanContinue()

  try {
    await execa("docker", ["inspect", container.name])
    return true
  } catch (e) {
    return false
  }
}

/**
 * A stream transform that injects a prefix into every line
 * and also forces every chunk to end with a newline so that
 * it can be interleaved with other output.
 */
class OutputPrefixTransform extends Transform {
  constructor(prefix: string) {
    super({
      objectMode: true,
      transform: (chunk: Buffer, encoding, callback) => {
        let result = chunk.toString(encoding)

        if (result.endsWith("\n")) {
          result = result.slice(0, -1)
        }

        // Some loggers emit newline then ANSI reset code causing
        // blank lines if we do not remove the newline.
        // TODO: Consider removing all ANSI escape codes as it causes
        //  some confusing output when interleaved.
        if (result.endsWith("\n\u001B[0m")) {
          result = result.slice(0, -5) + result.slice(-4)
        }

        result = prefix + result.replace(/\n/g, `\n${prefix}`) + "\n"
        callback(null, result)
      },
    })
  }
}

function pipeToConsole(result: execa.ExecaChildProcess, name: string) {
  result.stdout
    ?.pipe(new OutputPrefixTransform(`${name}: `))
    .pipe(process.stdout)
  result.stderr
    ?.pipe(new OutputPrefixTransform(`${name} (stderr): `))
    .pipe(process.stderr)
}

async function getContainerId(name: string) {
  async function check() {
    try {
      return (await execa("docker", ["inspect", name, "-f", "{{.Id}}"])).stdout
    } catch (e) {
      return null
    }
  }

  // If the container is not running, retry a few times to cover
  // the initial starting where we might check before the container
  // is running.
  for (let i = 0; i < 25; i++) {
    if (i > 0) {
      // Delay a bit before checking again.
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    const id = await check()
    if (id !== null) {
      return id
    }
  }

  throw new Error(`Could not find ID for container with name ${name}`)
}

export async function startContainer({
  executor,
  network,
  imageId,
  alias,
  env,
  dockerArgs = [],
}: {
  executor: TestExecutor
  network: Network
  imageId: string
  alias?: string
  env?: Record<string, string>
  dockerArgs?: string[]
}): Promise<Container> {
  executor.checkCanContinue()
  const containerName = generateName(alias)

  const args = [
    "run",
    "--rm",
    "--network",
    network.id,
    "--name",
    containerName,
    ...dockerArgs,
  ]

  if (alias != null) {
    args.push(`--network-alias=${alias}`)
  }

  if (env != null) {
    for (const [key, value] of Object.entries(env)) {
      args.push("-e", `${key}=${value}`)
    }
  }

  args.push(imageId)

  const process = execa("docker", args)
  pipeToConsole(process, alias ?? containerName)

  const id = await getContainerId(containerName)

  executor.registerCleanupTask(async () => {
    console.log(`Stopping container ${containerName}`)
    const r = execa("docker", ["stop", containerName])
    pipeToConsole(r, (alias ?? containerName) + " (stop)")
    try {
      await r
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      if (!(e.stderr || "").includes("No such container")) {
        throw e
      }
    }
  })

  return {
    id,
    name: containerName,
    network,
    process,
    executor,
  }
}

export async function runNpmRunScript(name: string): Promise<void> {
  const result = execa("npm", ["run", name])
  pipeToConsole(result, `npm run ${name}`)
  await result
}
