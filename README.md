### How is all data stored?
```ts
const ifcData = {
  types: [4582374, 1238892, 12837905], // ok
  ids: [123, 234, 345, 456, 567], // ok
  idsType: [0, 0, 1, 2, 2], // ok
  typeIds: [
    {start: 0, end: 2},
    {start: 2, end: 3},
    {start: 3, end: 5}
  ], // ok
  guids: [
    "98eynq7ntqew",
    "oih98qgw9qwe",
    "aiosdh98qbdw",
    "qasod89812b3"
  ], // ok
  guidsId: [0, 1, 3, 4], // ok
  spatialStructure: {
    type: 0,
    children: [
      {
        id: 0,
        children: ...
      }
    ]
  }, // ok, but isn't easier to use the direct type and id values?
  entities: [
    { attrs: '[[0,"WallName",425211],[4,"WallDescription",5464533]]' }
  ], // ok
  // Current approach for relations
}
```

### How are attributes stored?
```ts
// entity processed: 123
const ids = [123]
const entities = [
  {
    // Approach A
    // indices: [2, 7],
    // values: ["Any Entity Name", "123"],
    // types: ["IfcLabel", "IfcIdentifier"]
    // Approach B
    // attrs: [
    //   [2, "Any Entity Name"],
    //   [7, "123"],
    // ],
    // types: ["IfcLabel", "IfcIdentifier"]
    // Approach C
    // types: [12348123, 36456458],
    // attrs: [
    //   [2, "Any Entity Name"],
    //   [7, "123"],
    // ],
    // Approach D
    indexing: [
      {index: 2, type: 234798234},
      {index: 7, type: 917239074},
    ],
    attrs: [ "Any Entity Name", "123" ]
    // Approach E
    // attrs: [
    //   [2, "Any Entity Name", "IfcLabel"],
    //   [7, "123", "IfcIdentifier"],
    // ]
  }
]
```

### How are relations stored?

### How Data.ids and Data.entities work together?
Each time an entity is processed to get the attributes, its expressID gets stored in Data.ids. At the same time, the attributes
get stored in Data.entities. That means they both will share the same index in the array. Take the following as an example:

```ts
// entity processed: 123
const ids = [123]
const entities = [{attributes: '[["Name": "Any Enity Name"]]'}]
```

As the index of the data is the same, I can get the index of the expressID 123 in the ids array, and given the index I can get the corresponding attributes very easily:

```ts
const index = ids.indexOf(123) // will return 0
const attrs = entities[index] // will return {attributes: '[["Name": "Any Entity Name"]]'}
```

### How Data.guidIndices and Data.guids work together?
```ts
// entity processed: 123
const guidIndices = [123]
const guids = ["as98dbnas123_"]
```

```ts
const index = guids.indexOf("as98dbnas123_") // will return 0
const expressID = guidIndices[index] // will return 123
```