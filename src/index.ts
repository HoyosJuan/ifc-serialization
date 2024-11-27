import * as fs from "fs"
import * as fb from "flatbuffers"
import * as IFC from "./ifc/entities"
import * as WEBIFC from "web-ifc"
import * as GRAPH from "graphql"
import { Data } from "./Data"

// Things that lowers the size:
// 1. Exclude the relation entities.
// 2. Use a shared string.

// Things that doesn't seem to have an impact:
// 1. Store unique string values inside an array.

// Things to try
// 1. Exclude the expressID and include null in the array positions where there is no entity.
// 2. Define combinations of attribute values that can be repeated a lot (define a "combinator" logic)
// 2.1. Name and NominalValue for IfcPropertySingleValue
// 2.2. Name and {Type}Value for IfcQuantity{Type} (IfcQuantityArea, IfcQuantityVolume, etc)
// 2.2. Name and ObjectType for IfcObject (maybe not quite often?)
// 2.3. ObjectType and PredefinedType for IfcElementType
  

const qtoEntities = new Set<number>([
  WEBIFC.IFCQUANTITYAREA,
  WEBIFC.IFCQUANTITYCOUNT,
  WEBIFC.IFCQUANTITYLENGTH,
  WEBIFC.IFCQUANTITYNUMBER,
  WEBIFC.IFCQUANTITYTIME,
  WEBIFC.IFCQUANTITYVOLUME,
  WEBIFC.IFCQUANTITYWEIGHT,
])

const materialEntities = new Set<number>([
  WEBIFC.IFCMATERIAL,
  WEBIFC.IFCMATERIALCONSTITUENT,
  WEBIFC.IFCMATERIALCONSTITUENTSET,
  WEBIFC.IFCMATERIALLAYER,
  WEBIFC.IFCMATERIALLAYERSET,
  WEBIFC.IFCMATERIALPROFILE,
  WEBIFC.IFCMATERIALPROFILESET,
])

const classesToInclude = new Set<number>([
  WEBIFC.IFCPROPERTYSET,
  WEBIFC.IFCPROPERTYSINGLEVALUE,
  WEBIFC.IFCELEMENTQUANTITY,
  ...qtoEntities,
  ...materialEntities
])

const attrsToExclude = new Set<string>([
  "Representation",
  "ObjectPlacement"
])

const builder = new fb.Builder(1024)

const serialize = async (path: string, name: string) => {
  const ifcApi = new WEBIFC.IfcAPI()
  await ifcApi.Init()

  const ifcFile = fs.readFileSync(path)
  const ifcBuffer = new Uint8Array(ifcFile.buffer)

  const modelID = ifcApi.OpenModel(ifcBuffer)

  const entities: number[] = []
  const expressIDs: number[] = []
  const types: number[] = []
  const rels: number[] = []

  const modelClasses = ifcApi.GetAllTypesOfModel(modelID).map(entry => entry.typeID)
  const toProcess = modelClasses.filter(type => ifcApi.IsIfcElement(type) || classesToInclude.has(type))
  const relsMap: Record<number, { [name: string]: number[] }> = {}
  
  for (const entityClass of toProcess) {
    const classEntities = ifcApi.GetLineIDsWithType(modelID, entityClass)
    const classEntitiesCount = classEntities.size();
    if (classEntitiesCount === 0) continue

    const processedIDs: number[] = []

    for (let index = 0; index < classEntities.size(); index++) {
      const expressID = classEntities.get(index);
      const attrs = await ifcApi.properties.getItemProperties(modelID, expressID) as Record<string, any>
      if (!attrs) continue
      
      const attributes: number[] = []

      for (const [attrName, attrValue] of Object.entries(attrs)) {
        if (attrsToExclude.has(attrName)) continue
        if (attrValue === null || attrValue === undefined) continue
        if (Array.isArray(attrValue)) {
          const handles = attrValue.filter(handle => handle.type === 5)
          const ids = handles.map(handle => handle.value)
          if (!relsMap[expressID]) relsMap[expressID] = {}
          if (!relsMap[expressID][attrName]) relsMap[expressID][attrName] = []
          relsMap[expressID][attrName].push(...ids)
          continue
        }

        if (typeof attrValue === "number") continue

        const { value, type } = attrValue as { value: string | boolean | number; type: number; name?: string }

        if (type === 5) {
          if (typeof value !== "number") continue
          if (!relsMap[expressID]) relsMap[expressID] = {}
          if (!relsMap[expressID][attrName]) relsMap[expressID][attrName] = []
          relsMap[expressID][attrName].push(value)
        } else {
          const hash = JSON.stringify([attrName, value])
          const attrOffset = builder.createSharedString(hash)
          attributes.push(attrOffset)
        }
      }

      const attributesVector = IFC.Entity.createAttrsVector(builder, attributes)
      IFC.Entity.startEntity(builder)
      IFC.Entity.addAttrs(builder, attributesVector)
      const entity = IFC.Entity.endEntity(builder)
      entities.push(entity)
      expressIDs.push(expressID)
      processedIDs.push(expressID)
    }

    const idsOffset = IFC.Types.createEntitiesVector(builder, processedIDs)
    IFC.Types.startTypes(builder)
    IFC.Types.addType(builder, BigInt(entityClass))
    IFC.Types.addEntities(builder, idsOffset)
    const typeOffset = IFC.Types.endTypes(builder)
    types.push(typeOffset)
  }

  const relsToProcess = [WEBIFC.IFCRELDEFINESBYPROPERTIES]
  for (const entityClass of relsToProcess) {
    const classEntities = ifcApi.GetLineIDsWithType(modelID, entityClass)
    const classEntitiesCount = classEntities.size();
    if (classEntitiesCount === 0) continue
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
      if (!relsMap[relatingID]) relsMap[relatingID] = {}
      if (!relsMap[relatingID].DefinesOccurence) relsMap[relatingID].DefinesOccurence = []
      relsMap[relatingID].DefinesOccurence.push(...relatedIDs)
      for (const relatedID of relatedIDs) {
        if (!relsMap[relatedID]) relsMap[relatedID] = {}
        if (!relsMap[relatedID].IsDefinedBy) relsMap[relatedID].IsDefinedBy = []
        relsMap[relatedID].IsDefinedBy.push(relatingID)
      }
    }
  }

  for (const expressID in relsMap) {
    const entityRels = relsMap[expressID]
    const definitions: number[] = []
    for (const entry of Object.entries(entityRels)) {
      const hash = JSON.stringify(entry)
      const offset = builder.createSharedString(hash)
      definitions.push(offset)
    }
    const attributesVector = IFC.Rel.createDefsVector(builder, definitions)
    IFC.Rel.startRel(builder)
    IFC.Rel.addDefs(builder, attributesVector)
    const rel = IFC.Rel.endRel(builder)
    rels.push(rel)
  }
      
  const ids = Object.keys(relsMap).map(id => Number(id))
  const entitiesVector = IFC.Data.createEntitiesVector(builder, entities)
  const idsVector = IFC.Data.createIdsVector(builder, expressIDs)
  const typesVector = IFC.Data.createTypesVector(builder, types)
  const relIndicesVector = IFC.Data.createRelIndicesVector(builder, ids)
  const relsVector = IFC.Data.createRelsVector(builder, rels)
  IFC.Data.startData(builder)
  IFC.Data.addEntities(builder, entitiesVector)
  IFC.Data.addIds(builder, idsVector)
  IFC.Data.addTypes(builder, typesVector)
  IFC.Data.addRelIndices(builder, relIndicesVector)
  IFC.Data.addRels(builder, relsVector)
  const outData = IFC.Data.endData(builder)

  builder.finish(outData)

  const outBytes = builder.asUint8Array()
  fs.writeFileSync(`${name}.bin`, outBytes)
}

const run = async (forceSerialize: boolean) => {
  const name = "large"
  if (forceSerialize) {
    const start = performance.now()
    await serialize(`${name}.ifc`, name)
    console.log("Serialization took: ", `${(performance.now() - start) / 1000} s`)
  }

  const bytes = new Uint8Array(fs.readFileSync(`${name}.bin`))
  const ifc = new Data(bytes)
  // console.log(await ifc.getAllClassNames())
  const ids = ifc.getAllEntitiesOfClass(WEBIFC.IFCSPACE).slice(0,1)
  for (const id of ids) {
    const attrs = ifc.getEntityAttributes(id, {includeRels: true})
    console.log(attrs)
  }

  console.log(ifc.getEntityAttributes(16250, { includeRels: true }))
  console.log(ifc.getEntityAttributes(16248, { includeRels: true }))
}

run(false)
