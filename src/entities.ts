const IFC = `
  #138= IFCBUILDINGSTOREY('0w984V0GL6yR4z75YWgVfX',#41,'Nivel 1',$,'Nivel:Nivel 1',#136,$,'Nivel 1',.ELEMENT.,0.);
  #22551= IFCSLAB('1s5utE$rDDfRKgzV6jUJ3d',#41,'Suelo:Por defecto - 30 cm:166729',$,'Suelo:Por defecto - 30 cm',#22529,#22549,'166729',.FLOOR.);
  #22573= IFCPROPERTYSINGLEVALUE('Reference',$,IFCLABEL('Por defecto - 30 cm'),$);
  #22574= IFCPROPERTYSET('0nu3qfjxn9yuhZSqsr97Nr',#41,'Pset_ReinforcementBarPitchOfSlab',$,(#22573));
  #22577= IFCPROPERTYSET('1s5utE$rDDfRKg$WgjUJ3d',#41,'Pset_SlabCommon',$,(#22573));
`

/**
 * ids: used to know the entity index based on the expressID
 */
const data = {
  attrs: [
    ["Name", "Suelo:Por defecto - 30 cm:166729"],
    ["ObjectType", "Suelo:Por defecto - 30 cm"],
    ["Tag", "166729"],
    ["PredefinedType", "FLOOR"],
    ["Reference", "Por defecto - 30 cm", "IFCLABEL"],
    ["Name", "Pset_ReinforcementBarPitchOfSlab"],
    ["Name", "Pset_SlabCommon"],
    ["Name", "Nivel 1"],
    ["ObjectType", "Nivel:Nivel 1"],
    ["LongName", "Nivel 1"],
    ["CompositionType", "ELEMENT"],
    ["Elevation", 0],
  ],
  ids: [
    138,
    22551,
    22573,
    22574,
    22577
  ],
  entities: [
    {
      identifiers: {
        expressID: 138,
        guid: "0w984V0GL6yR4z75YWgVfX"
      },
      type: "IFCBUILDINGSTOREY",
      attrs: [7, 8, 9, 10, 11],
      rels: []
    },
    {
      identifiers: {
        expressID: 22551,
        guid: "1s5utE$rDDfRKgzV6jUJ3d"
      },
      type: "IFCSLAB",
      attrs: [0, 1, 2, 3],
      rels: [1,2]
    },
    {
      identifiers: {
        expressID: 22573,
      },
      type: "IFCPROPERTYSINGLEVALUE",
      attrs: [4],
      rels: [0]
    },
    {
      identifiers: {
        expressID: 22574,
        guid: "0nu3qfjxn9yuhZSqsr97Nr"
      },
      type: "IFCPROPERTYSET",
      attrs: [5],
      rels: [3]
    },
    {
      identifiers: {
        expressID: 22577,
        guid: "1s5utE$rDDfRKg$WgjUJ3d"
      },
      type: "IFCPROPERTYSET",
      attrs: [6],
      rels: [3]
    },
  ],
  rels: [
    ["PartOfPset", [22574, 22577]],
    ["ContainedInStructure", [138]],
    ["IsDefinedBy", [22574, 22577]],
    ["HasProperties", [22573]],
  ],
}