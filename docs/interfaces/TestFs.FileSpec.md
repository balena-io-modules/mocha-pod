[mocha-pod](../README.md) / [Exports](../modules.md) / [TestFs](../modules/TestFs.md) / FileSpec

# Interface: FileSpec

[TestFs](../modules/TestFs.md).FileSpec

Generic file options

## Hierarchy

- [`FileOpts`](TestFs.FileOpts.md)

  ↳ **`FileSpec`**

## Table of contents

### Properties

- [atime](TestFs.FileSpec.md#atime)
- [contents](TestFs.FileSpec.md#contents)
- [gid](TestFs.FileSpec.md#gid)
- [mtime](TestFs.FileSpec.md#mtime)
- [uid](TestFs.FileSpec.md#uid)

## Properties

### <a id="atime" name="atime"></a> atime

• **atime**: `Date`

Last access time for the file.

**`Default Value`**

`new Date()`

#### Inherited from

[FileOpts](TestFs.FileOpts.md).[atime](TestFs.FileOpts.md#atime)

#### Defined in

[testfs/types.ts:21](https://github.com/balena-io-modules/mocha-pod/blob/511c926/lib/testfs/types.ts#L21)

___

### <a id="contents" name="contents"></a> contents

• **contents**: [`FileContents`](../modules/TestFs.md#filecontents)

Contents of the file

#### Defined in

[testfs/types.ts:49](https://github.com/balena-io-modules/mocha-pod/blob/511c926/lib/testfs/types.ts#L49)

___

### <a id="gid" name="gid"></a> gid

• **gid**: `number`

Group id for the file

**`Default Value`**

`process.getgid()`

#### Inherited from

[FileOpts](TestFs.FileOpts.md).[gid](TestFs.FileOpts.md#gid)

#### Defined in

[testfs/types.ts:42](https://github.com/balena-io-modules/mocha-pod/blob/511c926/lib/testfs/types.ts#L42)

___

### <a id="mtime" name="mtime"></a> mtime

• **mtime**: `Date`

Last modification time for the file.

**`Default Value`**

`new Date()`

#### Inherited from

[FileOpts](TestFs.FileOpts.md).[mtime](TestFs.FileOpts.md#mtime)

#### Defined in

[testfs/types.ts:28](https://github.com/balena-io-modules/mocha-pod/blob/511c926/lib/testfs/types.ts#L28)

___

### <a id="uid" name="uid"></a> uid

• **uid**: `number`

User id for the file

@defaultValue: `process.getuid()`

#### Inherited from

[FileOpts](TestFs.FileOpts.md).[uid](TestFs.FileOpts.md#uid)

#### Defined in

[testfs/types.ts:35](https://github.com/balena-io-modules/mocha-pod/blob/511c926/lib/testfs/types.ts#L35)
