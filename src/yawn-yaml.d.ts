// Type declaration for missing yawn-yaml types.
declare module 'yawn-yaml/cjs' {
  export default class YAWN {
    constructor(yaml: string)
    public json: any
    public yaml: string
  }
}
