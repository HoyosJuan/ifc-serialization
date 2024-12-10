import * as WEBIFC from "web-ifc"
import * as fs from "fs"
import { Data } from "./Data"
import { Serializer } from "./Serializer"

// type TableRowData = Record<string, string | number | boolean>

// interface TableGroupData<T extends TableRowData = TableRowData> {
//   data: Partial<T>,
//   children?: TableGroupData[]
// }

// interface SpatialStructure {
//   type?: number;
//   id?: number;
//   children?: SpatialStructure[]
// }

// type SpatialTreeData = {
//   Class: string;
//   Name: string;
// }

// const toTableData = (model: Data, structure: SpatialStructure, ifcApi: any) => {
//   const { id, type, children } = structure
//   if (type) {
//     const typeName = ifcApi.GetNameFromTypeCode(type)
//     const row: TableGroupData<SpatialTreeData> = {
//       data: { Class: typeName }
//     }
//     if (children!.length === 1) {
//       const { id, children: nestings } = children![0]
//       const attrs = model.getEntityAttributes(id!)
//       if (attrs) { row.data.Name = String(attrs.Name) }
//       for (const nest of nestings ?? []) {
//         const childRow = toTableData(model, nest, ifcApi)
//         if (!childRow) continue
//         if (!row.children) row.children = []
//         row.children.push(childRow)
//       }
//     } else {
//       for (const child of children!) {
//         const childRow = toTableData(model, child, ifcApi)
//         if (!childRow) continue
//         if (!row.children) row.children = []
//         row.children.push(childRow)
//       }
//     }
//     return row
//   } else {
//     const attrs = model.getEntityAttributes(id!)
//     if (!attrs) return null
//     const row: TableGroupData<SpatialTreeData> = {
//       data: { Class: String(attrs.Name) }
//     }
//     for (const child of children ?? []) {
//       const childRow = toTableData(model, child, ifcApi)
//       if (!childRow) continue
//       if (!row.children) row.children = []
//       row.children.push(childRow)
//     }
//     return row
//   }
// }

const run = async (forceSerialize: boolean) => {
  const name = "medium"
  if (forceSerialize) {
    const lastBinFile = fs.readFileSync(`${name}.bin`)
    const previousSize = (lastBinFile.length / (1024 * 1024)).toFixed(3)
    const start = performance.now()
    const ifcFile = fs.readFileSync(`${name}.ifc`)
    const ifcBuffer = new Uint8Array(ifcFile.buffer)
    const serializer = new Serializer()
    // serializer.classesToInclude = [{entities: [WEBIFC.IFCSITE], rels: []}]
    const bytes = await serializer.process(ifcBuffer)
    const executionTime = ((performance.now() - start) / 1000).toFixed(4)
    fs.writeFileSync(`${name}.bin`, bytes)
    const newBinFile = fs.readFileSync(`${name}.bin`)
    const newSize = (newBinFile.length / (1024 * 1024)).toFixed(3)
    console.log("Serialization took:", `${executionTime}s`)
    console.log("Old size:", `${previousSize}mb`)
    console.log("New size:", `${newSize}mb`)
  }

  const ifcApi = new WEBIFC.IfcAPI()
  await ifcApi.Init()
  
  const dataSetStart = performance.now()
  const bytes = new Uint8Array(fs.readFileSync(`${name}.bin`))
  const model = new Data(bytes)
  console.log("Data set in:", `${(performance.now() - dataSetStart).toFixed(4)}ms`)

  const modelID = ifcApi.CreateModel({ schema: model.schema })
  
  const operationStart = performance.now()
  const attrs = await model.getEntityAttributes(25219)
  if (attrs) {
    const type = await model.createType(WEBIFC.IFCLABEL, "My New Entity Name")
    if (type) await model.updateAttribute(25219, "Name", type)
    const newAttrs = await model.getEntityAttributes(25219)
    if (newAttrs) {
      console.log(newAttrs)
      const asd = new WEBIFC.IFC4.IfcPropertySingleValue(
        new WEBIFC.IFC4.IfcIdentifier("CustomProp"),
        null,
        new WEBIFC.IFC4.IfcReal(2),
        null
      )
      asd.expressID = 2
      ifcApi.WriteLine(modelID, asd)
      console.log(ifcApi.GetLine(modelID, 2))
      const attrName = Object.keys(asd).slice(2)[2]
      // @ts-ignore
      asd[attrName] = {type: 10, name: "IFCINTEGER", value: 2}
      ifcApi.WriteLine(modelID, asd)
      console.log(ifcApi.GetLine(modelID, 2))
    }
  }
  console.log("Operation done in:", `${(performance.now() - operationStart).toFixed(4)}ms`)

  // console.log(model.getEntityGuid(71286))
  // console.log(model.getEntityByGuid("0mIuNN$0HBuCdIzdLQSa58"))
  // const entities = model.getAllEntitiesOfClass(WEBIFC.IFCCOVERING)
  // const names = new Set()
  // for (const entity of entities) {
  //   const type = model.getEntityClass(entity)
  //   if (!type) continue
  //   const name = ifcApi.GetNameFromTypeCode(type)
  //   names.add(name)
  // }
  // console.log(names, entities.length)
  // fs.writeFileSync(`${name}-tree.json`, JSON.stringify(model.spatialTree, null, 2))

  // const expressID = 91
  // const guid = "3pAqbahij0IxsrcNfJM9Y8"

  // Get entity attributes from expressID
  // const startA = performance.now()
  // const attrsFromExpressID = await model.getEntityAttributes(expressID)
  // console.log(attrsFromExpressID)
  // console.log("Attributes expressID retreived in", `${((performance.now() - startA) / 1000).toFixed(5)}s`)
  
  // // Get entity attributes from globalID
  // // The first time this is slower than using the expressID approach because it 
  // // creates an indexation between guids and expressIDs
  // const startB = performance.now()
  // const attrsFromGlobalID = model.getEntityAttributes(guid)
  // console.log(attrsFromGlobalID)
  // console.log("Attributes from GUID retreived in", `${((performance.now() - startB) / 1000).toFixed(5)}s`)

  // @ts-ignore
  // const site = new WEBIFC.IFC4.IfcSite(
  //   null,
  //   null,
  //   null,
  //   null,
  //   null,
  //   null,
  //   null,
  //   null,
  //   null,
  //   new WEBIFC.IFC4.IfcCompoundPlaneAngleMeasure([1, 2, 3]),
  //   new WEBIFC.IFC4.IfcCompoundPlaneAngleMeasure([1, 2, 3]),
  //   null,
  //   null,
  // )
  WEBIFC.UNKNOWN //0
  WEBIFC.STRING //1
  WEBIFC.LABEL //2
  WEBIFC.ENUM //3
  WEBIFC.REAL //4
  WEBIFC.REF //5
  WEBIFC.EMPTY //6
  WEBIFC.SET_BEGIN //7
  WEBIFC.SET_END //8
  WEBIFC.LINE_END //9
  WEBIFC.INTEGER //10
  
  // const spatialTreeTime = performance.now()
  // const spatialTree = model.getSpatialTree()
  // const tableData = toTableData(model, spatialTree, ifcApi)
  // fs.writeFileSync(`${name}-tree-table.json`, JSON.stringify([tableData], null, 2))
  // fs.writeFileSync(`${name}-tree.json`, JSON.stringify(spatialTree, null, 2))
  // console.log("Spatial tree calculated in", `${((performance.now() - spatialTreeTime) / 1000).toFixed(5)}s`)

  // const start = performance.now()
  // const ids = model.getAllEntitiesOfClass(WEBIFC.IFCCOVERING)//.slice(0,1)
  // for (const id of ids) {
  //   const attrs = await model.getEntityAttributes(id)
  //   console.log(attrs)
  // }
  // console.log(ids.length, "properties retrieved in", `${((performance.now() - start) / 1000).toFixed(5)}s`)
}

run(false)
