import * as fs from "fs"
import * as fb from "flatbuffers"
import * as IFC from "./ifc/entities"
import * as WEBIFC from "web-ifc"

// Things that lower the size:
// 1. Exclude the relation entities.
// 2. Use a shared string.

// Things that doesn't seem to have an impact:
// 1. Store unique string values inside an array.

// Things to try
// 1. Exclude the expressID and include null in the array positions where there is no entity.
// 2. Do a different serialization for IfcPropertySingleValue

const ifcQuantities = new Set<number>([
  WEBIFC.IFCQUANTITYAREA,
  WEBIFC.IFCQUANTITYCOUNT,
  WEBIFC.IFCQUANTITYLENGTH,
  WEBIFC.IFCQUANTITYNUMBER,
  WEBIFC.IFCQUANTITYTIME,
  WEBIFC.IFCQUANTITYVOLUME,
  WEBIFC.IFCQUANTITYWEIGHT,
])

const classesToInclude = new Set<number>([
  WEBIFC.IFCPROPERTYSET,
  WEBIFC.IFCPROPERTYSINGLEVALUE,
  WEBIFC.IFCELEMENTQUANTITY,
  ...ifcQuantities
  // WEBIFC.IFCMATERIAL,
  // WEBIFC.IFCMATERIALCONSTITUENT,
  // WEBIFC.IFCMATERIALCONSTITUENTSET,
  // WEBIFC.IFCMATERIALLAYER,
  // WEBIFC.IFCMATERIALLAYERSET,
  // WEBIFC.IFCMATERIALPROFILE,
  // WEBIFC.IFCMATERIALPROFILESET,
])

// interface WebIfcEntities {
//   [id: string]: {
//     expressID: number,
//     type: number,
//     [attr: string]:
//       | number
//       | null
//       | { value: string | number | boolean, type: number, name?: string }
//   }
// }

// const entities: WebIfcEntities = {
//   "1": {
//     "expressID": 1,
//     "type": 4251960020,
//     "Id": null,
//     "Name": { "value": "Autodesk Revit 2021 (ESP)", "type": 1, "name": "IFCLABEL" },
//     "Description": null,
//     "Roles": null,
//     "Addresses": null
//   },
//   "5": {
//     "expressID": 5,
//     "type": 639542469,
//     "ApplicationDeveloper": { "value": 1, "type": 5 },
//     "Version": { "value": "2021", "type": 1, "name": "IFCLABEL" },
//     "ApplicationFullName": { "value": "Autodesk Revit 2021 (ESP)", "type": 1, "name": "IFCLABEL" },
//     "ApplicationIdentifier": { "value": "Revit", "type": 1, "name": "IFCIDENTIFIER" }
//   },
//   "47": {
//     "expressID": 47,
//     "type": 2597039031,
//     "ValueComponent": {
//       "type": 4,
//       "name": "IFCRATIOMEASURE",
//       "value": 0.0174532925199433
//     },
//     "UnitComponent": {
//       "value": 45,
//       "type": 5
//     }
//   },
//   "48": {
//     "expressID": 48,
//     "type": 2889183280,
//     "Dimensions": {
//       "value": 46,
//       "type": 5
//     },
//     "UnitType": {
//       "type": 3,
//       "value": "PLANEANGLEUNIT"
//     },
//     "Name": {
//       "value": "DEGREE",
//       "type": 1,
//       "name": "IFCLABEL"
//     },
//     "ConversionFactor": {
//       "value": 47,
//       "type": 5
//     }
//   },
// }

const builder = new fb.Builder(1024)

const serializePropValue = (attrs: any) => {
  const valueKey = Object.keys(attrs).find(attr => attr.endsWith("Value"))
  if (!(valueKey && attrs[valueKey] && attrs.Name)) return null
  const attrArray = [attrs.Name.value, attrs[valueKey].value]
  const value = builder.createSharedString(JSON.stringify(attrArray))
  return value
}

const serialize = async (path: string, name: string) => {
  const start = performance.now()

  const classesProcessed: Record<string, number> = {}

  const ifcApi = new WEBIFC.IfcAPI()
  await ifcApi.Init()

  const ifcFile = fs.readFileSync(path)
  const ifcBuffer = new Uint8Array(ifcFile.buffer)

  const modelID = ifcApi.OpenModel(ifcBuffer)

  const entities: number[] = []
  const types: bigint[] = []
  const values: number[] = []

  const modelClasses = ifcApi.GetAllTypesOfModel(modelID).map(entry => entry.typeID)
  const toProcess = modelClasses.filter(type => ifcApi.IsIfcElement(type) || classesToInclude.has(type))
  
  for (const entityClass of toProcess) {
    const classEntities = ifcApi.GetLineIDsWithType(modelID, entityClass)
    const classEntitiesCount = classEntities.size();
    if (classEntitiesCount === 0) continue
    const className = ifcApi.GetNameFromTypeCode(entityClass)
    classesProcessed[className] = classEntities.size();

    
    for (let index = 0; index < classEntities.size(); index++) {
      const expressID = classEntities.get(index);
      const attrs = await ifcApi.properties.getItemProperties(modelID, expressID) as Record<string, any>
      if (!attrs) continue
      
      if (ifcQuantities.has(entityClass) || entityClass === WEBIFC.IFCPROPERTYSINGLEVALUE) {
        const value = serializePropValue(attrs)
        if (value !== null) values.push(value)
        continue
      }

      const list: number[] = []
      for (const [attrName, attrValue] of Object.entries(attrs)) {
        if (attrValue === null || attrValue === undefined) continue
        if (Array.isArray(attrValue)) continue // omit array attributes by now

        let typeValue: number | undefined
        let dataNameValue: string | undefined
        let stringValue: string | undefined
        let floatValue: number | undefined
        let intValue: number | undefined

        if (typeof attrValue === "number") {
          if (attrName === "expressID") intValue = attrValue
          if (attrName === "type") {
            intValue = types.indexOf(BigInt(attrValue))
            if (intValue === -1) intValue = types.push(BigInt(attrValue)) - 1
          }
        } else {
          const { value, type, name } = attrValue
          typeValue = type
          dataNameValue = name
          if ((type === 1 || type === 2 || type === 3) && typeof value === "string") {
            stringValue = value
          } else if (type === 5 && typeof value === "number") {
            intValue = value
          } else if (type === 4 && typeof value === "number") {
            floatValue = value
          }
        }

        const attrArray: any[] = []
        // if (typeValue !== undefined) attrArray[0] = typeValue
        // if (dataNameValue) attrArray[1] = dataNameValue
        if (stringValue) attrArray[2] = stringValue
        if (intValue !== undefined) attrArray[3] = intValue
        if (floatValue !== undefined) attrArray[4] = floatValue

        // Serialization
        const nameBuffer = builder.createSharedString(attrName)
        const value = builder.createSharedString(JSON.stringify(attrArray))
        IFC.Attribute.startAttribute(builder)
        IFC.Attribute.addName(builder, nameBuffer)
        IFC.Attribute.addValue(builder, value)
        const attr = IFC.Attribute.endAttribute(builder)
        list.push(attr)
      }
      const entityAttrs = IFC.Entity.createAttrsVector(builder, list)
      IFC.Entity.startEntity(builder)
      IFC.Entity.addAttrs(builder, entityAttrs)
      const entity = IFC.Entity.endEntity(builder)
      entities.push(entity) - 1       
    }
  }
      
  const entitiesVector = IFC.Data.createEntitiesVector(builder, entities as number[])
  const typesVector = IFC.Data.createTypesVector(builder, types)
  const valuesVector = IFC.Data.createValuesVector(builder, values)
  IFC.Data.startData(builder)
  IFC.Data.addEntities(builder, entitiesVector)
  IFC.Data.addTypes(builder, typesVector)
  IFC.Data.addValues(builder, valuesVector)
  const outData = IFC.Data.endData(builder)

  builder.finish(outData)

  const outBytes = builder.asUint8Array()
  fs.writeFileSync(`${name}.bin`, outBytes)
  console.log(`${(performance.now() - start) / 1000} s`)

  console.log(classesProcessed)
}

serialize("large.ifc", "large")

// Deserialization
// const inBytes = new Uint8Array(fs.readFileSync("entities.bin"))
// const inBuffer = new fb.ByteBuffer(inBytes)
// const inData = IFC.Data.getRootAsData(inBuffer)

// const getAttrs = (expressID: number) => {
// const entity = inData.entities(expressID);
//   if (!(entity && entity.attrsLength() !== 0)) return null
//   const attrs: Record<string, any> = {}
//   for (let j = 0; j < entity.attrsLength(); j++) {
//     const attr = entity.attrs(j);
//     const name = attr?.name()
//     const value = attr?.value()
//     if (!(attr && name && value)) continue
//     const [type, dataName, stringValue, intValue, floatValue] = JSON.parse(value)
//     if (name === "expressID") {
//       attrs.expressID = intValue
//     } else if (name === "type") {
//       const type = inData.types(intValue)
//       if (type !== null) attrs.type = Number(type)
//     } else {
//       let value = stringValue
//       if (floatValue !== undefined) value = floatValue
//       if (intValue !== undefined) value = intValue
//       if (value === undefined) continue
//       attrs[name] = { value }
//       if (type !== null) attrs[name].type = type
//       if (dataName) attrs[name].name = dataName
//     }
//   }
//   return attrs
// }

// console.log(getAttrs(112))