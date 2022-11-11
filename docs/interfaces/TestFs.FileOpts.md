[mocha-pod](../README.md) / [Exports](../modules.md) / [TestFs](../modules/TestFs.md) / FileOpts

# Interface: FileOpts

[TestFs](../modules/TestFs.md).FileOpts

Generic file options

## Hierarchy

- **`FileOpts`**

  ↳ [`FileSpec`](TestFs.FileSpec.md)

  ↳ [`FileRef`](TestFs.FileRef.md)

## Table of contents

### Properties

- [atime](TestFs.FileOpts.md#atime)
- [gid](TestFs.FileOpts.md#gid)
- [mtime](TestFs.FileOpts.md#mtime)
- [uid](TestFs.FileOpts.md#uid)

## Properties

### <a id="atime" name="atime"></a> atime

• **atime**: `Date`

Last access time for the file.

**`Default Value`**

`new Date()`

#### Defined in

[testfs/types.ts:21](https://github.com/balena-io-modules/mocha-pod/blob/83469cb/lib/testfs/types.ts#L21)

___

### <a id="gid" name="gid"></a> gid

• **gid**: `number`

Group id for the file

**`Default Value`**

`process.getgid()`

#### Defined in

[testfs/types.ts:42](https://github.com/balena-io-modules/mocha-pod/blob/83469cb/lib/testfs/types.ts#L42)

___

### <a id="mtime" name="mtime"></a> mtime

• **mtime**: `Date`

Last modification time for the file.

**`Default Value`**

`new Date()`

#### Defined in

[testfs/types.ts:28](https://github.com/balena-io-modules/mocha-pod/blob/83469cb/lib/testfs/types.ts#L28)

___

### <a id="uid" name="uid"></a> uid

• **uid**: `number`

User id for the file

@defaultValue: `process.getuid()`

#### Defined in

[testfs/types.ts:35](https://github.com/balena-io-modules/mocha-pod/blob/83469cb/lib/testfs/types.ts#L35)
