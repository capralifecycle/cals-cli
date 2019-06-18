import { main } from './cli'

main().catch(error => {
  console.error(error.stack || error.message || error)
  process.exitCode = 1
})
