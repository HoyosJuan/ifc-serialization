import * as fb from "flatbuffers"
import * as IFC from "./ifc/entities"
import * as WEBIFC from "web-ifc"
import { RawEntityAttrs } from "./types"

export class Serializer {
  private _expressIDs: number[] = []
  private _classes: bigint[] = []
  private _expressIdsType: number[] = []
  private _relationsMap: Record<number, { [name: string]: number[] }> = {}

  private _ifcInvAttrs = new Map([
    [WEBIFC.IFCRELDEFINESBYPROPERTIES, { forRelating: "DefinesOcurrence", forRelated: "IsDefinedBy" }],
    [WEBIFC.IFCRELASSOCIATESMATERIAL, { forRelated: "HasAssociations", forRelating: "AssociatedTo" }],
    [WEBIFC.IFCRELAGGREGATES, { forRelated: "Decomposes", forRelating: "IsDecomposedBy" }],
    [WEBIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE, { forRelated: "ContainedInStructure", forRelating: "ContainsElements" }],
  ])

  static materials = {
    entities: [
      WEBIFC.IFCMATERIAL,
      WEBIFC.IFCMATERIALCONSTITUENT,
      WEBIFC.IFCMATERIALCONSTITUENTSET,
      WEBIFC.IFCMATERIALLAYER,
      WEBIFC.IFCMATERIALLAYERSET,
      WEBIFC.IFCMATERIALLAYERSETUSAGE,
      WEBIFC.IFCMATERIALPROFILE,
      WEBIFC.IFCMATERIALPROFILESET,
      WEBIFC.IFCMATERIALPROFILESETUSAGE
    ],
    rels: [
      WEBIFC.IFCRELASSOCIATESMATERIAL
    ]
  }

  static properties = {
    entities: [
      WEBIFC.IFCPROPERTYSET,
      WEBIFC.IFCPROPERTYSINGLEVALUE,
      WEBIFC.IFCELEMENTQUANTITY,
      WEBIFC.IFCQUANTITYAREA,
      WEBIFC.IFCQUANTITYCOUNT,
      WEBIFC.IFCQUANTITYLENGTH,
      WEBIFC.IFCQUANTITYNUMBER,
      WEBIFC.IFCQUANTITYTIME,
      WEBIFC.IFCQUANTITYVOLUME,
      WEBIFC.IFCQUANTITYWEIGHT,
    ],
    rels: [
      WEBIFC.IFCRELDEFINESBYPROPERTIES
    ]
  }

  classesToInclude = [
    Serializer.materials,
    Serializer.properties,
    {
      entities: [
        WEBIFC.IFCPROJECT,
        WEBIFC.IFCBUILDING,
        WEBIFC.IFCBUILDINGSTOREY,
      ],
      rels: [
        WEBIFC.IFCRELAGGREGATES,
        WEBIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE
      ]
    }
  ]

  attrsToExclude = new Set<string>([
    "Representation",
    "ObjectPlacement"
  ])

  private addRelation(expressID: number, relName: string, ...ids: number[]) {
    if (!this._relationsMap[expressID]) this._relationsMap[expressID] = {}
    if (!this._relationsMap[expressID][relName]) this._relationsMap[expressID][relName] = []
    this._relationsMap[expressID][relName].push(...ids)
  }

  private getEntitiesToProcess() {
    return this.classesToInclude.map(entry => entry.entities).flat()
  }

  private getRelsToProcess() {
    return this.classesToInclude.map(entry => entry.rels).flat()
  }

  private _api: WEBIFC.IfcAPI | null = null
  private async getIfcApi() {
    if (!this._api) {
      const ifcApi = new WEBIFC.IfcAPI()
      await ifcApi.Init()
      this._api = ifcApi
    }
    return this._api
  }

  async process(data: Uint8Array) {
    this.clean()

    // Open the IFC
    const ifcApi = await this.getIfcApi()
    const modelID = ifcApi.OpenModel(data)
    const modelClasses = ifcApi.GetAllTypesOfModel(modelID).map(entry => entry.typeID)
    const schema = ifcApi.GetModelSchema(modelID)
    const schemaNamespace = (WEBIFC as any)[schema]
    if (!schemaNamespace) throw new Error(`Model schema not recognized.`)

    // Define the offset arrays for the flatbuffers root_type
    const entitiesOffsets: number[] = []
    const guidsId: number[] = []
    const guids: number[] = []
    const typeIds: number[] = []

    const entitiesToProcess = this.getEntitiesToProcess()
    const toProcess = modelClasses.filter(type => ifcApi.IsIfcElement(type) || entitiesToProcess.includes(type))

    const builder = new fb.Builder(1024)

    let classIndex = 0
    for (const entityClass of toProcess) {
      const classEntities = ifcApi.GetLineIDsWithType(modelID, entityClass)
      if (classEntities.size() === 0) continue

      let classWasProcessed = false

      let entityCount = this._expressIDs.length
      for (let index = 0; index < classEntities.size(); index++) {
        const expressID = classEntities.get(index);
        const attrs = await ifcApi.properties.getItemProperties(modelID, expressID) as RawEntityAttrs
        if (!attrs) continue
        const { attrOffsets, guidOffset } = this.serializeAttributes(builder, expressID, attrs)
        const attributesVector = IFC.Entity.createAttrsVector(builder, attrOffsets)
        const entity = IFC.Entity.createEntity(builder, attributesVector)
        entitiesOffsets.push(entity)
        this._expressIDs.push(expressID)
        this._expressIdsType.push(classIndex)
        if (guidOffset) {
          guids.push(guidOffset)
          guidsId.push(this._expressIDs.length - 1)
        }
        classWasProcessed = true
      }
      
      if (!classWasProcessed) continue
      classIndex++

      const rangeOffset = IFC.Range.createRange(builder, entityCount, this._expressIDs.length)
      typeIds.push(rangeOffset)
      this._classes.push(BigInt(entityClass))
    }

    const relsToProcess = modelClasses.filter(type => this.getRelsToProcess().includes(type))
    for (const entityClass of relsToProcess) {
      const relNames = this._ifcInvAttrs.get(entityClass)
      if (!relNames) continue
      const { forRelating, forRelated } = relNames
      const classEntities = ifcApi.GetLineIDsWithType(modelID, entityClass)
      if (classEntities.size() === 0) continue
      for (let index = 0; index < classEntities.size(); index++) {
        const expressID = classEntities.get(index);
        const attrs = await ifcApi.properties.getItemProperties(modelID, expressID) as Record<string, any>
        if (!attrs) continue
        const attrKeys = Object.keys(attrs)
        const relatingKey = attrKeys.find(attr => attr.startsWith("Relating"))
        const relatedKey = attrKeys.find(attr => attr.startsWith("Related"))
        if (!(relatingKey && relatedKey)) continue
        const relatingID = attrs[relatingKey].value
        const relatedIDs = attrs[relatedKey].map(({ value }: { value: number }) => value)
        this.addRelation(relatingID, forRelating, ...relatedIDs)
        for (const relatedID of relatedIDs) {
          this.addRelation(relatedID, forRelated, relatingID)
        }
      }
    }

    const { indices: relIndicesVector, relations: relsVector } = this.serializeRelations(builder)

    const treeOffset = await this.createSpatialTree(builder)

    const typeIdsVector = IFC.Data.createClassExpressIdsVector(builder, typeIds)
    const expressIdsTypeVector = IFC.Data.createExpressIdsTypeVector(builder, this._expressIdsType)
    const entitiesVector = IFC.Data.createEntitiesVector(builder, entitiesOffsets)
    const expressIdsVector = IFC.Data.createExpressIdsVector(builder, this._expressIDs)
    const classesVector = IFC.Data.createClassesVector(builder, this._classes)
    const guidsVector = IFC.Data.createGuidsVector(builder, guids)
    const guidsIdVector = IFC.Data.createGuidsIdVector(builder, guidsId)
    const schemaOffset = builder.createString(schema)
    IFC.Data.startData(builder)
    IFC.Data.addSchema(builder, schemaOffset)
    IFC.Data.addEntities(builder, entitiesVector)
    IFC.Data.addExpressIds(builder, expressIdsVector)
    IFC.Data.addClasses(builder, classesVector)
    IFC.Data.addExpressIdsType(builder, expressIdsTypeVector)
    IFC.Data.addClassExpressIds(builder, typeIdsVector)
    IFC.Data.addRelIndices(builder, relIndicesVector)
    IFC.Data.addRels(builder, relsVector)
    IFC.Data.addGuidsId(builder, guidsIdVector)
    IFC.Data.addGuids(builder, guidsVector)
    IFC.Data.addSpatialStructure(builder, treeOffset)
    IFC.Data.addMaxExpressId(builder, ifcApi.GetMaxExpressID(modelID))
    const outData = IFC.Data.endData(builder)

    builder.finish(outData)
    this.clean()

    const outBytes = builder.asUint8Array()
    return outBytes
  }

  private serializeAttributes(builder: fb.Builder, expressID: number, attrs: RawEntityAttrs) {
    const attrOffsets: number[] = []
    let guidOffset: number | null = null

    let index = 0
    for (const [attrName, attrValue] of Object.entries(attrs)) {
      if (typeof attrValue === "number") continue
      if (this.attrsToExclude.has(attrName) || attrValue === null || attrValue === undefined) {
        index++
        continue
      }

      // Array attributes are usually references to other entities
      // They need to be added as a relation
      if (Array.isArray(attrValue)) {
        const handles = attrValue.filter(handle => handle.type === 5)
        const ids = handles.map(handle => handle.value) as number[]
        this.addRelation(expressID, attrName, ...ids)
        index++
        continue
      }

      const { value, type } = attrValue

      if (type === 5) {
        // Type 5 values are references to other entities
        // They need to be added as a relation
        if (typeof value !== "number") continue
        this.addRelation(expressID, attrName, value)
      } else {
        if (attrName === "GlobalId" && typeof value === "string") {
          // As guids are always unique, is pointless to create a shared string
          guidOffset = builder.createString(value)
          index++
          continue
        }
        // index and value must always be at index 0 and 1
        // other data can be set starting index 2
        const attrData = [index, value]
        const dataTypeName =
          "name" in attrValue && attrValue.name
            ? attrValue.name
            : attrValue.constructor.name.toUpperCase()
        if (dataTypeName) {
          const code = (WEBIFC as any)[dataTypeName] ?? type
          attrData.push(code)
        }
        const hash = JSON.stringify(attrData)
        const attrOffset = builder.createSharedString(hash)
        attrOffsets.push(attrOffset)
      }

      index++
    }

    return {attrOffsets, guidOffset}
  }

  private serializeRelations(builder: fb.Builder) {
    const rels: number[] = []
    for (const [_, entityRels] of Object.entries(this._relationsMap)) {
      const definitions: number[] = []
      for (const entry of Object.entries(entityRels)) {
        const hash = JSON.stringify(entry)
        const offset = builder.createSharedString(hash)
        definitions.push(offset)
      }
      const defsVector = IFC.Rel.createDefsVector(builder, definitions)
      IFC.Rel.startRel(builder)
      IFC.Rel.addDefs(builder, defsVector)
      const rel = IFC.Rel.endRel(builder)
      rels.push(rel)
    }
    const relations = IFC.Data.createRelsVector(builder, rels)
    const ids = Object.keys(this._relationsMap).map(id => Number(id))
    const indices = IFC.Data.createRelIndicesVector(builder, ids)
    return { indices, relations }
  }

  private getEntityDecomposition(builder: fb.Builder, expressID: number, inverseAttributes: string[]) {
    const offsets: number[] = []

    for (const attrName of inverseAttributes) {
      const relations = this._relationsMap[expressID]?.[attrName];
      if (!relations) continue;
      
      const entityGroups: {[type: number]: number[]} = {};
      for (const expressID of relations) {
        const entityIndex = this._expressIDs.indexOf(expressID)
        if (entityIndex === -1) continue
        const classIndex = this._expressIdsType[entityIndex]
        if (!classIndex) continue
        const newClass = this._classes[classIndex]
        if (!entityGroups[Number(newClass)]) entityGroups[Number(newClass)] = []
        entityGroups[Number(newClass)].push(expressID)
      }

      for (const type in entityGroups) {
        const entities = entityGroups[type];
        const childrenOffsets = entities.map(
          id => this.getEntityDecomposition(builder, id, inverseAttributes)
        )
        const childrenVector = IFC.SpatialStructure.createChildrenVector(builder, childrenOffsets)
        IFC.SpatialStructure.startSpatialStructure(builder)
        IFC.SpatialStructure.addType(builder, BigInt(type))
        IFC.SpatialStructure.addChildren(builder, childrenVector)
        const offset = IFC.SpatialStructure.endSpatialStructure(builder)
        offsets.push(offset)
      }
    }
    
    const childrenVector = IFC.SpatialStructure.createChildrenVector(builder, offsets)
    IFC.SpatialStructure.startSpatialStructure(builder)
    IFC.SpatialStructure.addId(builder, expressID)
    IFC.SpatialStructure.addChildren(builder, childrenVector)
    const offset = IFC.SpatialStructure.endSpatialStructure(builder)

    return offset;
  }

  private async createSpatialTree(builder: fb.Builder) {
    const ifcApi = await this.getIfcApi()
    const type = WEBIFC.IFCPROJECT
    const classEntities = [...ifcApi.GetLineIDsWithType(0, type)]
    const childrenOffsets = classEntities.map(
      id => this.getEntityDecomposition(builder, id, ["IsDecomposedBy", "ContainsElements"])
    )
    const childrenVector = IFC.SpatialStructure.createChildrenVector(builder, childrenOffsets)
    IFC.SpatialStructure.startSpatialStructure(builder)
    IFC.SpatialStructure.addType(builder, BigInt(type))
    IFC.SpatialStructure.addChildren(builder, childrenVector)
    const offset = IFC.SpatialStructure.endSpatialStructure(builder)
    return offset
  }

  private clean() {
    this._expressIDs = []
    this._classes = []
    this._relationsMap = {}
    this._expressIdsType = []
    this._api = null
  }
}