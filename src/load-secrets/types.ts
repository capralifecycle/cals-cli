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

/**
 * Used for secrets that are a single plaintext string,
 * and do not require JSON formating.
 */
export interface StringSecret extends BaseSecret {
  type: "string"
}

export interface JsonSecret extends BaseSecret {
  type: "json"
  fields: (JsonSecretSimpleField | JsonSecretDescribedField)[]
}

export type Secret = JsonSecret | StringSecret

export interface SecretGroup {
  accountId: string
  region: string
  description: string
  namePrefix: string
  secrets: Secret[]
}
