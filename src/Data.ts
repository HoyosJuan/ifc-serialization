import * as IFC from "./ifc/entities"
import * as fb from "flatbuffers"
import * as WEBIFC from "web-ifc"
import { RawEntityAttrs } from "./types"

interface SpatialStructure {
  type?: number;
  id?: number;
  children?: SpatialStructure[]
}

interface GetAttrsConfig {
  includeRels: boolean;
  includeGuid: boolean;
}

export class Data {
  private _data: IFC.Data

  // classes index
  private _ci: Record<number, number> | null = null;

  // guids index
  private _gi: Record<string, number> | null = null

  private get _classesIndex() {
    if (!this._ci) this._ci = this.initializeClassesIndex()
    return this._ci
  }

  private get _guidsIndex() {
    if (!this._gi) this._gi = this.initializeGuidsIndex()
    return this._gi
  }

  private _api: WEBIFC.IfcAPI | null = null
  
  private async getIfcApi() {
    if (!this._api) {
      const ifcApi = new WEBIFC.IfcAPI()
      await ifcApi.Init()
      this._api = ifcApi
      ifcApi.CreateModel({schema: WEBIFC.Schemas.IFC4})
    }
    return this._api
  }

  get schema() {
    const schema = this._data.schema() as WEBIFC.Schemas.IFC2X3 | WEBIFC.Schemas.IFC4 | WEBIFC.Schemas.IFC4X3
    if (!schema) throw new Error("Schema was not found!")
    return schema
  }

  maxExpressID: number = 0
  
  constructor(buffer: Uint8Array) {
    const inBuffer = new fb.ByteBuffer(buffer)
    this._data = IFC.Data.getRootAsData(inBuffer)
    this.maxExpressID = this._data.maxExpressId()
  }

  // async init(buffer: Uint8Array) {
  //   const inBuffer = new fb.ByteBuffer(buffer)
  //   this._data = IFC.Data.getRootAsData(inBuffer)
  //   const ifcApi = new WEBIFC.IfcAPI()
  //   await ifcApi.Init()
  //   this._api = ifcApi
  //   ifcApi.CreateModel({schema: WEBIFC.Schemas.IFC4})
  // }

  private initializeClassesIndex() {
    const indexation: Record<number, number> = {}
    for (let i = 0; i < this._data.classesLength(); i++) {
      const classCode = this._data.classes(i);
      if (!classCode) continue;
      const code = Number(classCode);
      indexation[code] = i;
    }
    return indexation
  }

  private initializeGuidsIndex() {
    const indexation: Record<string, number> = {}
    for (let i = 0; i < this._data.guidsLength(); i++) {
      const guid = this._data.guids(i)
      if (!guid) continue
      indexation[guid] = i
    }
    return indexation
  }

  private getAttrsConfigDefault: Required<GetAttrsConfig> = {
    includeRels: false,
    includeGuid: false
  }

  async getEntityAttributes(
    id: number | string,
    config?: Partial<GetAttrsConfig>
  ) {
    const {includeGuid} = {...this.getAttrsConfigDefault, ...config}
    const ifcApi = await this.getIfcApi()
    const expressID = typeof id === "number" ? id : this._guidsIndex[id]
    const attrsIndex = this._data.expressIdsArray()?.indexOf(expressID)
    const classType = this.getEntityClass(expressID)
    if (!(classType && attrsIndex !== undefined && attrsIndex !== -1)) return null
    const bufferEntity = this._data.entities(attrsIndex);
    if (!bufferEntity) return null
    const attrs = []
    if (includeGuid) {
      if (typeof id === "string") {
        const ifcType = ifcApi.CreateIfcType(0, WEBIFC.IFCGLOBALLYUNIQUEID, id)
        attrs[0] = ifcType
      } else {
        const guid = this.getEntityGuid(expressID)
        if (guid !== null) {
          const ifcType = ifcApi.CreateIfcType(0, WEBIFC.IFCGLOBALLYUNIQUEID, guid)
          attrs[0] = ifcType
        }
      }
    }
    const changesMap = this._changesMap[expressID]
    for (let j = 0; j < bufferEntity.attrsLength(); j++) {
      const attr = bufferEntity.attrs(j);
      if (!attr) continue
      let [index, value, type] = JSON.parse(attr)
      if (changesMap?.[index]) {
        attrs[index] = changesMap[index]
      } else if (type >= 0 && type <= 10) {
        attrs[index] = { type, value }
      } else {
        try {
          const ifcType = ifcApi.CreateIfcType(0, type, value)
          ifcType.value = value
          attrs[index] = ifcType
        } catch (error) {
          console.log("Something went wrong setting an attribute.")
        }
      }
    }
    const ifcEntity = ifcApi.CreateIfcEntity(0, classType, ...attrs)
    ifcEntity.expressID = expressID
    for (const [key, value] of Object.entries(ifcEntity)) {
      // @ts-ignore
      if (value === undefined) ifcEntity[key] = null
    }
    return ifcEntity as Record<string, any> & {type: number, expressID: number}
    // const { includeRels } = config
    // if (includeRels) {
    //   const rels = this.getEntityRelations(expressID)
    //   if (rels) {
    //     // for (const [rel, ids] of Object.entries(rels)) {
    //     //   // console.log(rel, expressID, ids)
    //     //   const expressIDs = ids.filter(id => id !== expressID)
    //     //   const attrs = expressIDs.map(id => this.getEntityAttributes(id)).filter(item => item)
    //     //   // @ts-ignore
    //     //   data[rel] = attrs
    //     // }
    //     // ifcEntity = {...ifcEntity, ...rels}
    //   }
    // }
    // if (Object.keys(ifcEntity).length === 0) return null
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

  // private getEntityDecomposition(expressID: number, inverseAttributes: string[]) {
  //   const item: SpatialStructure = {
  //     id: expressID
  //   };

  //   for (const attrName of inverseAttributes) {
  //     const relations = this.getEntityRelations(expressID)?.[attrName];
  //     if (!relations) continue;
  //     if (!item.children) item.children = [];
      
  //     const entityGroups: {[type: number]: number[]} = {};
  //     for (const id of relations) {
  //       const entityClass = this.getEntityClass(id)
  //       if (!entityClass) continue
  //       if (!entityGroups[entityClass]) entityGroups[entityClass] = []
  //       entityGroups[entityClass].push(id)
  //     }

  //     for (const type in entityGroups) {
  //       const entities = entityGroups[type];
  //       const typeItem: SpatialStructure = {
  //         type: Number(type),
  //         children: entities.map(
  //           id => this.getEntityDecomposition(id, inverseAttributes)
  //         )
  //       }
  //       item.children.push(typeItem)
  //     }
  //   }

  //   return item;
  // }

  // getSpatialTree() {
  //   const type = WEBIFC.IFCPROJECT
  //   const tree: SpatialStructure = {
  //     type: type,
  //     children: this.getAllEntitiesOfClass(type).map(
  //       id => this.getEntityDecomposition(id, ["IsDecomposedBy", "ContainsElements"])
  //     )
  //   }
  //   return tree
  // }

  private getTreeItem(item: IFC.SpatialStructure) {
    const children: SpatialStructure[] = []
    for (let i = 0; i < item.childrenLength(); i++) {
      const child = item.children(i);
      if (!child) continue;
      children.push(this.getTreeItem(child))
    }
    const tree: SpatialStructure = {}
    const id = item.id()
    const type = item.type()
    if (id !== -1) tree.id = id
    if (Number(type) !== -1) tree.type = Number(type)
    if (children.length > 0) tree.children = children
    return tree
  }

  get spatialTree() {
    const item = this._data.spatialStructure(new IFC.SpatialStructure())
    if (!item) return {}
    const tree = this.getTreeItem(item)
    return tree
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

  get classes() {
    const types: number[] = []
    for (let i = 0; i < this._data.classesLength(); i++) {
      const type = this._data.classes(i);
      if (type === null) continue
      types.push(Number(type))
    }
    return types
  }

  /**
   * 
   * @param id GlobalID or ExpressID of the entity to get its class from
   * @returns The WebIFC class code
   */
  getEntityClass(id: number | string) {
    const expressID = typeof id === "number" ? id : this.getEntityByGuid(id)
    if (!expressID) return null
    const entityIndex = this._data.expressIdsArray()?.indexOf(expressID)
    if (entityIndex === undefined) return null
    const classIndex = this._data.expressIdsType(entityIndex)
    if (classIndex === null) return null
    const classCode = this._data.classes(classIndex)
    if (!classCode) return null
    return Number(classCode)
  }

  getAllEntitiesOfClass(type: number) {
    const idsArray = this._data.expressIdsArray()
    const idsTypeArray = this._data.expressIdsTypeArray()
    const index = this._classesIndex[type];
    if (!(idsArray && idsTypeArray && index !== undefined)) return []
    const range = this._data.classExpressIds(index)
    if (!range) return []
    const start = idsTypeArray.indexOf(index)
    const end = idsTypeArray.lastIndexOf(index)
    return [...idsArray.slice(start, end)]
  }

  getEntityGuid(expressID: number) {
    const index = this._data.expressIdsArray()?.indexOf(expressID)
    if (index === undefined) return null
    const guidIndex = this._data.guidsIdArray()?.indexOf(index)
    if (guidIndex === undefined) return null
    const guid = this._data.guids(guidIndex)
    if (guid === undefined) return null
    return guid
  }

  getEntityByGuid(guid: string) {
    const index = this._guidsIndex[guid]
    if (index === undefined) return null
    const entityIndex = this._data.guidsId(index)
    if (entityIndex === null) return null
    const expressID = this._data.expressIds(entityIndex)
    return expressID
  }

  private _newEntities: Record<number, any> = {}
  async addEntity(data: any) {
    this.maxExpressID = this.maxExpressID++
    data.expressID = this.maxExpressID
    this._newEntities[this.maxExpressID] = data
  }

  private _changesMap: Record<number, Record<number, any>> = {}

  async updateAttribute(expressID: number, attrName: string, value: any) {
    const ifcApi = await this.getIfcApi()
    const classCode = this.getEntityClass(expressID)
    if (!classCode) return false
    const ifcEntity = ifcApi.CreateIfcEntity(0, classCode)
    const attrIndex = Object.keys(ifcEntity).indexOf(attrName) - 2
    if (attrIndex < 0) return false
    if (!this._changesMap[expressID]) this._changesMap[expressID] = {}
    if (!this._changesMap[expressID][attrIndex]) this._changesMap[expressID][attrIndex] = ""
    this._changesMap[expressID][attrIndex] = value
    return true
  }

  async createType(type: number, value: string | number | boolean | number[]) {
    const ifcApi = await this.getIfcApi()
    if (!ifcApi) return null
    return ifcApi.CreateIfcType(0, type, value)
  }
}