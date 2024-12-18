import * as IFC from "./ifc/entities"
import * as fb from "flatbuffers"
import { Schemas } from "web-ifc"

interface IfcMetadata {
  schema: Schemas.IFC2X3 | Schemas.IFC4 | Schemas.IFC4X3,
  maxExpressID: number
}

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
  private _categoryNames: Record<number, string> = {
    234692834: "IfcWall"
  }

  private _data: IFC.Data

  // classes index
  private _ci: Record<number, number> | null = null;

  // guids index
  private _gi: Record<string, number> | null = null

  // categories to local ids index
  private _cli: Record<number, number[]> | null = null

  private get _classesIndex() {
    if (!this._ci) this._ci = this.initializeCategoriesIndex()
    return this._ci
  }

  private get _guidsIndex() {
    if (!this._gi) this._gi = this.initializeGuidsIndex()
    return this._gi
  }

  private get _categoriesToLocalIds() {
    if (!this._cli) this._cli = this.initCategoriesToLocalIdsIndex()
    return this._cli
  }

  get metadata(): Partial<IfcMetadata> {
    const data = this._data.metadata()
    if (!data) return {}
    return JSON.parse(data)
  }

  get categories() {
    const categories: number[] = []
    for (let i = 0; i < this._data.categoriesLength(); i++) {
      const category = this._data.categories(i);
      if (category === null) continue
      categories.push(Number(category))
    }
    return categories
  }

  get guids() {
    const guids: string[] = []
    for (let i = 0; i < this._data.guidsLength(); i++) {
      const guid = this._data.guids(i);
      if (!guid) continue
      guids.push(guid)
    }
    return guids
  }
  
  get localIds() {
    const ids: number[] = []
    for (let i = 0; i < this._data.localIdsLength(); i++) {
      const id = this._data.localIds(i);
      if (id === null) continue
      ids.push(id)
    }
    return ids
  }
  
  get localIdsType() {
    const indices: number[] = []
    for (let i = 0; i < this._data.localIdsTypeLength(); i++) {
      const index = this._data.localIdsType(i);
      if (index === null) continue
      indices.push(index)
    }
    return indices
  }
  
  get guidsId() {
    const indices: number[] = []
    for (let i = 0; i < this._data.guidsIdLength(); i++) {
      const index = this._data.guidsId(i);
      if (index === null) continue
      indices.push(index)
    }
    return indices
  }
  
  get relIndices() {
    const indices: number[] = []
    for (let i = 0; i < this._data.relIndicesLength(); i++) {
      const index = this._data.relIndices(i);
      if (index === null) continue
      indices.push(index)
    }
    return indices
  }

  get rels() {
    const result: any[] = []
    for (let i = 0; i < this._data.relsLength(); i++) {
      const rel = this._data.rels(i);
      if (!rel) continue
      const itemRels: any[] = []
      for (let j = 0; j < rel.defsLength(); j++) {
        const defs = rel.defs(j);
        if (!defs) continue
        itemRels.push(JSON.parse(defs))
      }
      result.push(itemRels)
    }
    return result
  }

  get attributes() {
    const result: any[] = []
    for (let i = 0; i < this._data.attributesLength(); i++) {
      const entity = this._data.attributes(i);
      if (!entity) continue
      const itemAttrs: any[] = []
      for (let j = 0; j < entity.attrsLength(); j++) {
        const attrs = entity.attrs(j);
        if (!attrs) continue
        itemAttrs.push(JSON.parse(attrs))
      }
      result.push(itemAttrs)
    }
    return result
  }

  get data() {
    return {
      metadata: this.metadata,
      categories: this.categories,
      localIds: this.localIds,
      localIdsType: this.localIdsType,
      guids: this.guids,
      guidsId: this.guidsId,
      attributes: this.attributes,
      rels: this.rels,
      relIndices: this.relIndices
    }
  }
  
  constructor(buffer: Uint8Array) {
    const inBuffer = new fb.ByteBuffer(buffer)
    this._data = IFC.Data.getRootAsData(inBuffer)
  }
  
  private initCategoriesToLocalIdsIndex() {
    const indexation: Record<number, number[]> = {}
    const localIdsType = this._data.localIdsTypeArray()
    const localIds = this._data.localIdsArray()
    if (!(localIdsType && localIds)) return indexation
    for (let i = 0; i < this._data.categoriesLength(); i++) {
      const category = this._data.categories(i)
      if (category === null) continue
      const start = localIdsType.indexOf(i)
      const end = localIdsType.lastIndexOf(i)
      if (start === -1 || end === -1) continue
      indexation[Number(category)] = [...localIds.slice(start, end + 1)]
    }
    return indexation
  }

  private initializeCategoriesIndex() {
    const indexation: Record<number, number> = {}
    for (let i = 0; i < this._data.categoriesLength(); i++) {
      const classCode = this._data.categories(i);
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

  async getItemAttributes(
    id: number | string,
    config?: Partial<GetAttrsConfig>
  ) {
    const { includeGuid } = {...this.getAttrsConfigDefault, ...config}
    const expressID = typeof id === "number" ? id : this._guidsIndex[id]
    const attrsIndex = this._data.localIdsArray()?.indexOf(expressID)
    const classType = this.getEntityClass(expressID)
    if (!(classType && attrsIndex !== undefined && attrsIndex !== -1)) return null
    const bufferEntity = this._data.attributes(attrsIndex);
    if (!bufferEntity) return null
    const attrs: Record<string, any> = {}
    if (includeGuid) {
      if (typeof id === "string") {
        attrs.guid = id
      } else {
        const guid = this.getItemGuid(expressID)
        if (guid !== null) {
          attrs.guid = guid
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
      }
      else {
        attrs[index] = value
      }
    }
    return attrs
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

  getItemRelations(expressID: number) {
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
    this._cli = null
  }

  async getAllClassNames() {
    const classIds = Object.keys(this._classesIndex)
    const names: string[] = []
    for (const id of classIds) names.push(this._categoryNames[Number(id)])
    return names
  }

  get classes() {
    const types: number[] = []
    for (let i = 0; i < this._data.categoriesLength(); i++) {
      const type = this._data.categories(i);
      if (type === null) continue
      types.push(Number(type))
    }
    return types
  }

  /**
   * 
   * @param id GlobalID or ExpressID of the entity to get its class from
   * @returns The category code
   */
  getEntityClass(id: number | string) {
    const expressID = typeof id === "number" ? id : this.getEntityByGuid(id)
    if (!expressID) return null
    const entityIndex = this._data.localIdsArray()?.indexOf(expressID)
    if (entityIndex === undefined) return null
    const classIndex = this._data.localIdsType(entityIndex)
    if (classIndex === null) return null
    const classCode = this._data.categories(classIndex)
    if (!classCode) return null
    return Number(classCode)
  }

  getAllItemsOfClass(type: number) {
    return this._categoriesToLocalIds[type]
  }

  getItemGuid(expressID: number) {
    const index = this._data.localIdsArray()?.indexOf(expressID)
    if (index === undefined) return null
    const guidIndex = this._data.guidsIdArray()?.indexOf(index)
    if (guidIndex === undefined || guidIndex === -1) return null
    const guid = this._data.guids(guidIndex)
    if (guid === undefined) return null
    return guid
  }

  getEntityByGuid(guid: string) {
    const index = this._guidsIndex[guid]
    if (index === undefined) return null
    const entityIndex = this._data.guidsId(index)
    if (entityIndex === null) return null
    const expressID = this._data.localIds(entityIndex)
    return expressID
  }

  // private _newEntities: Record<number, any> = {}
  // async addEntity(data: any) {
  //   this.maxExpressID = this.maxExpressID++
  //   data.expressID = this.maxExpressID
  //   this._newEntities[this.maxExpressID] = data
  // }

  private _changesMap: Record<number, Record<number, any>> = {}

  // async updateAttribute(expressID: number, attrName: string, value: any) {
  //   const ifcApi = await this.getIfcApi()
  //   const classCode = this.getEntityClass(expressID)
  //   if (!classCode) return false
  //   const ifcEntity = ifcApi.CreateIfcEntity(0, classCode)
  //   const attrIndex = Object.keys(ifcEntity).indexOf(attrName) - 2
  //   if (attrIndex < 0) return false
  //   if (!this._changesMap[expressID]) this._changesMap[expressID] = {}
  //   if (!this._changesMap[expressID][attrIndex]) this._changesMap[expressID][attrIndex] = ""
  //   this._changesMap[expressID][attrIndex] = value
  //   return true
  // }

  // async createType(type: number, value: string | number | boolean | number[]) {
  //   const ifcApi = await this.getIfcApi()
  //   if (!ifcApi) return null
  //   return ifcApi.CreateIfcType(0, type, value)
  // }
}