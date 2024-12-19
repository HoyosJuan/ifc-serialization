import * as IFC from "./ifc/entities"
import * as fb from "flatbuffers"

interface SpatialStructure {
  type?: number;
  id?: number;
  children?: SpatialStructure[]
}

interface GetAttrsConfig {
  // If rels are included, the rel attributes will be as well
  rels: boolean | string[];
  includeGuid: boolean;
  includeCategory: boolean;
  includeLocalId: boolean;
}

interface GetRelsConfig{
  // Filter to only include certain relations
  keys?: string[];
  // Keep getting the relation relations. This includes the attributes of the relation item.
  recursive: boolean;
  includeAttributes: boolean;
}

// MD: Metadata
// RN: Relation Names
export class Properties<
  MD extends Record<string, any> = Record<string, any>
> {
  categoryNames: Record<number, string> = {
    234692834: "IfcWall"
  }

  private _data: IFC.Data

  // categories index
  private _ci: Record<number, number> | null = null;

  // guids index
  private _gi: Record<string, number> | null = null

  // categories to local ids index
  private _cli: Record<number, number[]> | null = null

  private get _categoriesIndex() {
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

  get metadata(): Partial<MD> {
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
      const item = this._data.attributes(i);
      if (!item) continue
      const itemAttrs: any[] = []
      for (let j = 0; j < item.attrsLength(); j++) {
        const attrs = item.attrs(j);
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
      const categoryCode = this._data.categories(i);
      if (!categoryCode) continue;
      const code = Number(categoryCode);
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

  private _getAttrsConfigDefault: Required<GetAttrsConfig> = {
    rels: false,
    includeGuid: false,
    includeCategory: false,
    includeLocalId: false
  }

  getItemAttributes(
    id: number | string,
    config?: Partial<GetAttrsConfig>
  ) {
    const { includeGuid, includeCategory, includeLocalId, rels } = { ...this._getAttrsConfigDefault, ...config }
    const isLocalId = typeof id === "number"
    const localId = isLocalId ? id : this._guidsIndex[id]
    const attrsIndex = this._data.localIdsArray()?.indexOf(localId)
    if (!(attrsIndex !== undefined && attrsIndex !== -1)) return null
    const itemBuffer = this._data.attributes(attrsIndex);
    if (!itemBuffer) return null
    let attrs: Record<string, any> = {}
    if (includeGuid) {
      if (isLocalId) {
        const guid = this.getItemGuid(localId)
        if (guid !== null) attrs.guid = guid
      } else {
        attrs.guid = id
      }
    }
    if (includeLocalId) {
      if (isLocalId) {
        attrs.localId = id
      } else {
        const localId = this.getLocalIdByGuid(id)
        if (localId !== null) attrs.localId = localId
      }
    }
    if (includeCategory) {
      const category = this.getItemCategory(localId)
      if (category !== null) attrs.category = category
    }
    const changesMap = this._changesMap[localId]
    for (let j = 0; j < itemBuffer.attrsLength(); j++) {
      const attr = itemBuffer.attrs(j);
      if (!attr) continue
      let [index, value] = JSON.parse(attr)
      if (changesMap?.[index]) {
        attrs[index] = changesMap[index]
      }
      else {
        attrs[index] = value
      }
    }
    if (rels) {
      const itemRels = this.getItemRelations(localId, 
        typeof rels === "boolean" && rels 
          ? { recursive: true } 
          : { recursive: true, keys: rels }
      );
      attrs = {...attrs, ...itemRels}
    }
    return attrs
  }

  private _getRelsConfigDefault: Required<GetRelsConfig> = {
    recursive: false,
    keys: [],
    includeAttributes: false
  }

  getItemRelations(id: number | string, config?: Partial<GetRelsConfig>, idsToIgnore: number[] = []) {
    const isLocalId = typeof id === "number"
    const localId = isLocalId ? id : this._guidsIndex[id]
    const { recursive, includeAttributes, keys } = {...this._getRelsConfigDefault, ...config}
    const index = this._data.relIndicesArray()?.indexOf(localId)
    if (index === undefined || index === -1) return null
    const rels = this._data.rels(index);
    if (!rels) return null
    idsToIgnore.push(localId)
    const data: Record<string, any> = {}
    for (let j = 0; j < rels.defsLength(); j++) {
      const def = rels.defs(j);
      if (!def) continue
      const [name, ...localIds] = JSON.parse(def) as [string, ...number[]]
      if (keys.length > 0 && !keys.includes(name)) continue
      if (localIds.length === 0) continue
      if (recursive) {
        const dff = localIds.some(id => idsToIgnore.includes(id))
        if (dff) continue
        const attrsList = []
        for (const rel of localIds) {
          if (idsToIgnore.includes(rel)) continue
          const attrs = {
            ...this.getItemAttributes(rel),
            ...this.getItemRelations(rel, {...config, keys: []}, [...idsToIgnore, rel])
          }
          if (Object.keys(attrs).length === 0) continue
          attrsList.push(attrs)
        }
        if (attrsList.length === 0) continue
        data[name] = attrsList
      } else if (includeAttributes) {
        const dff = localIds.some(id => idsToIgnore.includes(id))
        if (dff) continue
        const attrsList = []
        for (const rel of localIds) {
          if (idsToIgnore.includes(rel)) continue
          const attrs = { ...this.getItemAttributes(rel) }
          if (Object.keys(attrs).length === 0) continue
          attrsList.push(attrs)
        }
        if (attrsList.length === 0) continue
        data[name] = attrsList
      } else {
        data[name] = localIds
      }
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
  // They will be recalculated if needed.
  cleanIndexations() {
    this._ci = null
    this._gi = null
    this._cli = null
  }

  getAllCategoryNames() {
    const categoryIds = Object.keys(this._categoriesIndex)
    const names: string[] = []
    for (const id of categoryIds) names.push(this.categoryNames[Number(id)])
    return names
  }

  /**
   * 
   * @param id GlobalID or LocalID of the item to get its category from
   * @returns The category code
   */
  getItemCategory(id: number | string) {
    const localId = typeof id === "number" ? id : this.getLocalIdByGuid(id)
    if (!localId) return null
    const itemIndex = this._data.localIdsArray()?.indexOf(localId)
    if (itemIndex === undefined) return null
    const categoryIndex = this._data.localIdsType(itemIndex)
    if (categoryIndex === null) return null
    const categoryCode = this._data.categories(categoryIndex)
    if (!categoryCode) return null
    return Number(categoryCode)
  }

  getAllItemsOfCategory(type: number) {
    return this._categoriesToLocalIds[type]
  }

  getItemGuid(localId: number) {
    const index = this._data.localIdsArray()?.indexOf(localId)
    if (index === undefined) return null
    const guidIndex = this._data.guidsIdArray()?.indexOf(index)
    if (guidIndex === undefined || guidIndex === -1) return null
    const guid = this._data.guids(guidIndex)
    if (guid === undefined) return null
    return guid
  }

  getLocalIdByGuid(guid: string) {
    const index = this._guidsIndex[guid]
    if (index === undefined) return null
    const localIdIndex = this._data.guidsId(index)
    if (localIdIndex === null) return null
    const localId = this._data.localIds(localIdIndex)
    return localId
  }

  // private _newEntities: Record<number, any> = {}
  // async addEntity(data: any) {
  //   this.maxExpressID = this.maxExpressID++
  //   data.expressID = this.maxExpressID
  //   this._newEntities[this.maxExpressID] = data
  // }

  private _changesMap: Record<number, Record<string, any>> = {}

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
}