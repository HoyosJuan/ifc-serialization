interface DeleteChange {
  type: "deleted"
}

interface ModifyChange {
  type: "added" | "modified",
  changes: {
    added: Record<string, any>,
    deleted: string[],
    modified: {
      [key: string]: { previous: any, current: any }
    }
  }
}

export interface Changes {
  [localId: number]: ModifyChange | DeleteChange
}

export type Identifier = string | number