import * as WEBIFC from "web-ifc"
import * as fs from "fs"
import { Properties } from "./reader/Properties"
import { IfcSerializer } from "./serializers/ifc"
import { IfcExporter } from "./exporters/ifc"

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

interface IfcMetadata {
  schema: WEBIFC.Schemas.IFC2X3 | WEBIFC.Schemas.IFC4 | WEBIFC.Schemas.IFC4X3,
  name: string,
  description: string,
}

const run = async (serialize: boolean) => {
  const name = "medium"
  const extension = ".ifc"
  const format = ".aec"
  if (serialize) {
    // Previous file size
    let previousSize = "0"

    try {
      const lastBinFile = fs.readFileSync(`${name}${format}`)
      previousSize = (lastBinFile.length / (1024 * 1024)).toFixed(3)
    } catch (error) {
      console.log(`First time converting ${name}`)
    }

    // Read the file
    const fileReadStart = performance.now()
    const ifcFile = fs.readFileSync(`${name}${extension}`)
    const ifcBuffer = new Uint8Array(ifcFile.buffer)
    const fileReadTime = ((performance.now() - fileReadStart) / 1000).toFixed(4)
    console.log("File read time:", `${fileReadTime}s`)
    
    // Serialize the data
    const serializationStart = performance.now()
    const serializer = new IfcSerializer() // The serializer can be other than IFC
    // serializer.classesToInclude = [{entities: [WEBIFC.IFCWALLSTANDARDCASE, WEBIFC.IFCBUILDINGSTOREY], rels: [WEBIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE]}]
    const bytes = await serializer.process(ifcBuffer)
    const serializationTime = ((performance.now() - serializationStart) / 1000).toFixed(4)
    fs.writeFileSync(`${name}${format}`, bytes)
    console.log("Serialization time:", `${serializationTime}s`)

    // Previous and new file size comparison
    const newBinFile = fs.readFileSync(`${name}${format}`)
    const newSize = (newBinFile.length / (1024 * 1024)).toFixed(3)
    console.log("Old binary size:", `${previousSize}mb`)
    console.log("New binary size:", `${newSize}mb`)
    console.log(newSize < previousSize ? "New file is lower in size" : "Old file is lower in size")
  }
  
  // Data ready time
  const dataReadyStart = performance.now()
  const bytes = new Uint8Array(fs.readFileSync(`${name}${format}`))
  const model = new Properties<IfcMetadata>(bytes)
  console.log("Data ready time:", `${(performance.now() - dataReadyStart).toFixed(4)}ms`)

  const exporter = new IfcExporter()
  const ifc = await exporter.process(model)
  fs.writeFileSync(`${name}-new.ifc`, ifc)
  
  // fs.writeFileSync(`${name}-data.json`, JSON.stringify(model.data, null, 1))

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
