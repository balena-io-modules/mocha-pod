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
- [mtime](TestFs.FileOpts.md#mtime)

## Properties

### <a id="atime" name="atime"></a> atime

• **atime**: `Date`

Last access time for the file.

**`Default Value`**

`new Date()`

#### Defined in

[testfs/types.ts:21](https://github.com/balena-io-modules/mocha-pod/blob/f3a69be/lib/testfs/types.ts#L21)

___

### <a id="mtime" name="mtime"></a> mtime

• **mtime**: `Date`

Last modification time for the file.

**`Default Value`**

`new Date()`

#### Defined in

[testfs/types.ts:28](https://github.com/balena-io-modules/mocha-pod/blob/f3a69be/lib/testfs/types.ts#L28)
