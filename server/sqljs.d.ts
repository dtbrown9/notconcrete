declare module 'sql.js' {
  export type QueryResult = {
    columns: string[]
    values: unknown[][]
  }

  export type Statement = {
    run(params?: unknown[] | Record<string, unknown>): void
    free(): void
  }

  export type Database = {
    exec(sql: string): QueryResult[]
    prepare(sql: string): Statement
    export(): Uint8Array
  }

  export type SqlJsStatic = {
    Database: new (data?: Uint8Array | ArrayBuffer | Buffer) => Database
  }

  export type InitSqlJsOptions = {
    locateFile?: (file: string, prefix: string) => string
  }

  export default function initSqlJs(options?: InitSqlJsOptions): Promise<SqlJsStatic>
}