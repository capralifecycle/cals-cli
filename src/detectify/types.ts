// See https://developer.detectify.com/#scan-profiles-manage-scan-profiles-get
export interface DetectifyScanProfile {
  name: string
  endpoint: string
  status: 'verified' | 'unverified' | 'unable_to_resolve' | 'unable_to_complete'
  created: string
  token: string
}

// See https://developer.detectify.com/#scan-reports-get-latest-report-get
export interface DetectifyScanReport {
  token: string
  scan_profile_token: string
  scan_profile_name: string
  created: string
  started: string
  stopped: string
  url: string
  cvss: number
  high_level_findings: number
  medium_level_findings: number
  low_level_findings: number
  information_findings: number
}
