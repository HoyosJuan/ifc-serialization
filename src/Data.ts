import * as IFC from "./ifc/entities"
import * as fb from "flatbuffers"
import * as WEBIFC from "web-ifc"

type Rel = "IsDefinedBy"

export class Data {
  private _data: IFC.Data
  private _classesIndex: Record<number, number> = {};
  
  constructor(buffer: Uint8Array) {
    const inBuffer = new fb.ByteBuffer(buffer)
    this._data = IFC.Data.getRootAsData(inBuffer)
    this._classesIndex = this.initializeClassesIndex()
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

  getEntityAttributes(expressID: number, config: { includeRels: boolean } = { includeRels: false }) {
    let data: Record<string, string | boolean | number | number[]> = {}
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