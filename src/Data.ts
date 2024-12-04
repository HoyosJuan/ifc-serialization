import * as IFC from "./ifc/entities"
import * as fb from "flatbuffers"
import * as WEBIFC from "web-ifc"

interface SpatialStructure {
  type?: number;
  id?: number;
  children?: SpatialStructure[]
}

export class Data {
  private _data: IFC.Data
  private _ci: Record<number, number> | null = null;

  private get _classesIndex() {
    if (!this._ci) this._ci = this.initializeClassesIndex()
    return this._ci
  }

  private _gi: Record<string, number> | null = null

  private get _guidsIndex() {
    if (!this._gi) this._gi = this.initializeGuidsIndex()
    return this._gi
  }
  
  constructor(buffer: Uint8Array) {
    const inBuffer = new fb.ByteBuffer(buffer)
    this._data = IFC.Data.getRootAsData(inBuffer)
  }

  private initializeClassesIndex() {
    const indexation: Record<number, number> = {}
    for (let i = 0; i < this._data.typesLength(); i++) {
      const typeData = this._data.types(i);
      if (!typeData) continue;
      const typeCode = Number(typeData.type());
      indexation[typeCode] = i;
    }
    return indexation
  }

  private initializeGuidsIndex() {
    const indexation: Record<string, number> = {}
    for (let i = 0; i < this._data.guidsLength(); i++) {
      const expressID = this._data.guidIndices(i)
      if (!expressID) continue
      const guid = this._data.guids(i);
      indexation[guid] = expressID
    }
    return indexation
  }

  getEntityAttributes(id: number | string, config: { includeRels: boolean } = { includeRels: false }) {
    let data: Record<string, string | boolean | number | number[]> = {}
    const expressID = typeof id === "number" ? id : this._guidsIndex[id]
    if (typeof id === "string") {
      data.GlobalId = id
    } else {
      const guidIndex = this._data.guidIndicesArray()?.indexOf(expressID)
      if (guidIndex) {
        const guid = this._data.guids(guidIndex)
        if (guid) data.GlobalId = guid
      }
    }
    const attrsIndex = this._data.idsArray()?.indexOf(expressID)
    if (attrsIndex !== undefined && attrsIndex !== -1) {
      const entity = this._data.entities(attrsIndex);
      if (entity) {
        for (let j = 0; j < entity.attrsLength(); j++) {
          const attr = entity.attrs(j);
          if (!attr) continue
          const [name, value] = JSON.parse(attr)
          data[name] = value
        }
      }
    }
    const { includeRels } = config
    if (includeRels) {
      const rels = this.getEntityRelations(expressID)
      if (rels) {
        // for (const [rel, ids] of Object.entries(rels)) {
        //   // console.log(rel, expressID, ids)
        //   const expressIDs = ids.filter(id => id !== expressID)
        //   const attrs = expressIDs.map(id => this.getEntityAttributes(id)).filter(item => item)
        //   // @ts-ignore
        //   data[rel] = attrs
        // }
        data = {...data, ...rels}
      }
    }
    if (Object.keys(data).length === 0) return null
    return data
  }

  getAllEntitiesOfClass(classID: number) {
    const index = this._classesIndex[classID];
    if (index === undefined) return [];
    const array = this._data.types(index)?.entitiesArray();
    if (!array) return []
    return [...array];
  }

  getEntityRelations(expressID: number) {
    const index = this._data.relIndicesArray()?.indexOf(expressID)
    if (index === undefined || index === -1) return null
    const rels = this._data.rels(index);
    if (!rels) return null
    const data: Record<string, number[]> = {}
    for (let j = 0; j < rels.defsLength(); j++) {
      const attr = rels.defs(j);
      if (!attr) continue
      const [name, value] = JSON.parse(attr)
      data[name] = value
    }
    return data
  }

  private getEntityDecomposition(expressID: number, inverseAttributes: string[]) {
    const item: SpatialStructure = {
      id: expressID
    };

    for (const attrName of inverseAttributes) {
      const relations = this.getEntityRelations(expressID)?.[attrName];
      if (!relations) continue;
      if (!item.children) item.children = [];
      
      const entityGroups: {[type: number]: number[]} = {};
      for (const id of relations) {
        const entityClass = this.getEntityClass(id)
        if (!entityClass) continue
        if (!entityGroups[entityClass]) entityGroups[entityClass] = []
        entityGroups[entityClass].push(id)
      }

      for (const type in entityGroups) {
        const entities = entityGroups[type];
        const typeItem: SpatialStructure = {
          type: Number(type),
          children: entities.map(
            id => this.getEntityDecomposition(id, inverseAttributes)
          )
        }
        item.children.push(typeItem)
      }
    }

    return item;
  }

  getSpatialTree() {
    const type = WEBIFC.IFCPROJECT
    const tree: SpatialStructure = {
      type: type,
      children: this.getAllEntitiesOfClass(type).map(
        id => this.getEntityDecomposition(id, ["IsDecomposedBy", "ContainsElements"])
      )
    }
    return tree
  }

  getEntityClass(expressID: number) {
    let classType: number | null = null
    for (let i = 0; i < this._data.typesLength(); i++) {
      const element = this._data.types(i);
      if (!element) continue
      if (element.entitiesArray()?.includes(expressID)) {
        classType = Number(element.type())
        break
      };
    }
    return classType
  }

  // Free the memory from internal indexations used to process things faster.
  cleanIndexations() {
    this._ci = null
    this._gi = null
  }

  async getAllClassNames() {
    const classIds = Object.keys(this._classesIndex)
    const ifcApi = new WEBIFC.IfcAPI()
    await ifcApi.Init()
    const names: string[] = []
    for (const id of classIds) {
      names.push(ifcApi.GetNameFromTypeCode(Number(id)))
    }
    ifcApi.Dispose()
    return names
  }
}