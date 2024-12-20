import * as WEBIFC from "web-ifc"
import { Properties } from "../../reader/Properties"

// WEBIFC.UNKNOWN //0
// WEBIFC.STRING //1
// WEBIFC.LABEL //2
// WEBIFC.ENUM //3
// WEBIFC.REAL //4
// WEBIFC.REF //5
// WEBIFC.EMPTY //6
// WEBIFC.SET_BEGIN //7
// WEBIFC.SET_END //8
// WEBIFC.LINE_END //9
// WEBIFC.INTEGER //10

export class IfcExporter {
  async process(data: Properties, defaultSchema = WEBIFC.Schemas.IFC4X3, originalIfc?: Uint8Array) {
    // let { schema } = data.metadata
    // if (!schema) schema = defaultSchema
    const schema = defaultSchema
    const ifcApi = new WEBIFC.IfcAPI()
    await ifcApi.Init()
    const modelID = ifcApi.CreateModel({ schema })
    for (const expressID of data.localIds) {
      const attrs = data.getItemAttributes(expressID, { includeGuid: true, includeCategory: true, includeTypes: true })
      if (!attrs) continue
      const dummyEntity = ifcApi.CreateIfcEntity(modelID, attrs.category)
      const length = Object.keys(dummyEntity).length - 2
      let attrsList: any[] = []
      attrsList.length = length
      attrsList = attrsList.fill(null)
      console.log(attrs)
      for (const attrName in attrs) {
        let attrIndex = Object.keys(dummyEntity).indexOf(attrName) - 2
        const { type, value } = attrs[attrName]
        console.log(attrIndex, type, value)
        if (!(type !== undefined && value && attrIndex !== -1)) continue
        console.log("here")
        attrIndex = attrIndex - 2
        const asd = ifcApi.CreateIfcType(modelID, type, value)
        attrsList[attrIndex] = asd
      }
      console.log(attrsList)
      const entity = ifcApi.CreateIfcEntity(modelID, attrs.category, ...attrsList)
      entity.expressID = expressID
      ifcApi.WriteLine(modelID, entity)
      console.log(entity)
      break
    }
    const model = ifcApi.SaveModel(modelID)
    return model
  }
}