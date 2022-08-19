[mocha-pod](../README.md) / [Exports](../modules.md) / [TestFs](../modules/TestFs.md) / FileRef

# Interface: FileRef

[TestFs](../modules/TestFs.md).FileRef

Utility interface to indicate that a test file contents must
be loaded from an existing file in the filesystem

## Hierarchy

- [`FileOpts`](TestFs.FileOpts.md)

  ↳ **`FileRef`**

## Table of contents

### Properties

- [atime](TestFs.FileRef.md#atime)
- [from](TestFs.FileRef.md#from)
- [mtime](TestFs.FileRef.md#mtime)

## Properties

### <a id="atime" name="atime"></a> atime

• **atime**: `Date`

Last access time for the file.

**`Default Value`**

`new Date()`

#### Inherited from

[FileOpts](TestFs.FileOpts.md).[atime](TestFs.FileOpts.md#atime)

#### Defined in

[testfs/types.ts:21](https://github.com/balena-io-modules/mocha-pod/blob/f3a69be/lib/testfs/types.ts#L21)

___

### <a id="from" name="from"></a> from

• **from**: `string`

Absolute or relative path to read the file from. If a relative
path is given, `process.cwd()` will be used as basedir

#### Defined in

[testfs/types.ts:47](https://github.com/balena-io-modules/mocha-pod/blob/f3a69be/lib/testfs/types.ts#L47)

___

### <a id="mtime" name="mtime"></a> mtime

• **mtime**: `Date`

Last modification time for the file.

**`Default Value`**

`new Date()`

#### Inherited from

[FileOpts](TestFs.FileOpts.md).[mtime](TestFs.FileOpts.md#mtime)

#### Defined in

[testfs/types.ts:28](https://github.com/balena-io-modules/mocha-pod/blob/f3a69be/lib/testfs/types.ts#L28)
