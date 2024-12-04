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
    const start = performance.now()
    const ifcFile = fs.readFileSync(`${name}.ifc`)
    const ifcBuffer = new Uint8Array(ifcFile.buffer)
    const serializer = new Serializer()
    // serializer.classesToInclude = [{entities: [WEBIFC.IFCPROJECT], rels: []}]
    const bytes = await serializer.process(ifcBuffer)
    fs.writeFileSync(`${name}.bin`, bytes)
    console.log("Serialization took: ", `${(performance.now() - start) / 1000} s`)
  }

  const bytes = new Uint8Array(fs.readFileSync(`${name}.bin`))
  const model = new Data(bytes)

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


  // const ifcApi = new WEBIFC.IfcAPI()
  // await ifcApi.Init()
  
  // const spatialTreeTime = performance.now()
  // const spatialTree = model.getSpatialTree()
  // const tableData = toTableData(model, spatialTree, ifcApi)
  // fs.writeFileSync(`${name}-tree-table.json`, JSON.stringify([tableData], null, 2))
  // fs.writeFileSync(`${name}-tree.json`, JSON.stringify(spatialTree, null, 2))
  // console.log("Spatial tree calculated in", `${((performance.now() - spatialTreeTime) / 1000).toFixed(5)}s`)
  const start = performance.now()
  const ids = model.getAllEntitiesOfClass(WEBIFC.IFCCOVERING)//.slice(0,10)
  for (const id of ids) {
    const attrs = await model.getEntityAttributes(id, {includeRels: true})
    // console.log(attrs)
  }
  console.log(ids.length, "properties retrieved in", `${((performance.now() - start) / 1000).toFixed(5)}s`)
}

run(false)
