// automatically generated by the FlatBuffers compiler, do not modify

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import * as flatbuffers from 'flatbuffers';

export class Def {
  bb: flatbuffers.ByteBuffer|null = null;
  bb_pos = 0;
  __init(i:number, bb:flatbuffers.ByteBuffer):Def {
  this.bb_pos = i;
  this.bb = bb;
  return this;
}

static getRootAsDef(bb:flatbuffers.ByteBuffer, obj?:Def):Def {
  return (obj || new Def()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

static getSizePrefixedRootAsDef(bb:flatbuffers.ByteBuffer, obj?:Def):Def {
  bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
  return (obj || new Def()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

rel():string|null
rel(optionalEncoding:flatbuffers.Encoding):string|Uint8Array|null
rel(optionalEncoding?:any):string|Uint8Array|null {
  const offset = this.bb!.__offset(this.bb_pos, 4);
  return offset ? this.bb!.__string(this.bb_pos + offset, optionalEncoding) : null;
}

ids(index: number):number|null {
  const offset = this.bb!.__offset(this.bb_pos, 6);
  return offset ? this.bb!.readInt32(this.bb!.__vector(this.bb_pos + offset) + index * 4) : 0;
}

idsLength():number {
  const offset = this.bb!.__offset(this.bb_pos, 6);
  return offset ? this.bb!.__vector_len(this.bb_pos + offset) : 0;
}

idsArray():Int32Array|null {
  const offset = this.bb!.__offset(this.bb_pos, 6);
  return offset ? new Int32Array(this.bb!.bytes().buffer, this.bb!.bytes().byteOffset + this.bb!.__vector(this.bb_pos + offset), this.bb!.__vector_len(this.bb_pos + offset)) : null;
}

static startDef(builder:flatbuffers.Builder) {
  builder.startObject(2);
}

static addRel(builder:flatbuffers.Builder, relOffset:flatbuffers.Offset) {
  builder.addFieldOffset(0, relOffset, 0);
}

static addIds(builder:flatbuffers.Builder, idsOffset:flatbuffers.Offset) {
  builder.addFieldOffset(1, idsOffset, 0);
}

static createIdsVector(builder:flatbuffers.Builder, data:number[]|Int32Array):flatbuffers.Offset;
/**
 * @deprecated This Uint8Array overload will be removed in the future.
 */
static createIdsVector(builder:flatbuffers.Builder, data:number[]|Uint8Array):flatbuffers.Offset;
static createIdsVector(builder:flatbuffers.Builder, data:number[]|Int32Array|Uint8Array):flatbuffers.Offset {
  builder.startVector(4, data.length, 4);
  for (let i = data.length - 1; i >= 0; i--) {
    builder.addInt32(data[i]!);
  }
  return builder.endVector();
}

static startIdsVector(builder:flatbuffers.Builder, numElems:number) {
  builder.startVector(4, numElems, 4);
}

static endDef(builder:flatbuffers.Builder):flatbuffers.Offset {
  const offset = builder.endObject();
  return offset;
}

static createDef(builder:flatbuffers.Builder, relOffset:flatbuffers.Offset, idsOffset:flatbuffers.Offset):flatbuffers.Offset {
  Def.startDef(builder);
  Def.addRel(builder, relOffset);
  Def.addIds(builder, idsOffset);
  return Def.endDef(builder);
}
}
