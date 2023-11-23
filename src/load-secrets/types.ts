export interface BaseSecret {
  name: string
  description?: string
  /**
   * A list of regions to create read replicas
   * of the secret in.
   */
  replicaRegions?: string[]
}

export type JsonSecretSimpleField = string

export interface JsonSecretDescribedField {
  key: string
  description?: string
  example?: string
}

export interface JsonSecret extends BaseSecret {
  type: "json"
  fields: (JsonSecretSimpleField | JsonSecretDescribedField)[]
}

// This can become a union type later if needed.
export type Secret = JsonSecret

export interface SecretGroup {
  accountId: string
  region: string
  description: string
  namePrefix: string
  secrets: Secret[]
}
