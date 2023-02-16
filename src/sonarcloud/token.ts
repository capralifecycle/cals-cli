export interface SonarCloudTokenProvider {
  getToken(): Promise<string | undefined>
  markInvalid(): Promise<void>
}
