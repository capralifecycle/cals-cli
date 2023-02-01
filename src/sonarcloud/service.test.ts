import { createSonarCloudService } from "./service"
import { SonarCloudTokenCliProvider } from "./token"
import { Config } from "../config"

async function main() {
  const config = new Config()

  const sonarCloudService = createSonarCloudService({
    config,
    tokenProvider: new SonarCloudTokenCliProvider(),
  })

  const res = await sonarCloudService.getMetricsByProjectKey(
    "capralifecycle_cardiolearn-webapp",
  )
  console.log(res)
}
test("test Sonarcloud", () => {
  // eslint-disable-next-line @typescript-eslint/require-await
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main()
  const test = "test"
  expect("test").toBeNull()
})
