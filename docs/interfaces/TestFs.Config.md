[mocha-pod](../README.md) / [Exports](../modules.md) / [TestFs](../modules/TestFs.md) / Config

# Interface: Config

[TestFs](../modules/TestFs.md).Config

## Hierarchy

- [`Opts`](TestFs.Opts.md)

  ↳ **`Config`**

## Table of contents

### Properties

- [basedir](TestFs.Config.md#basedir)
- [cleanup](TestFs.Config.md#cleanup)
- [filesystem](TestFs.Config.md#filesystem)
- [keep](TestFs.Config.md#keep)
- [rootdir](TestFs.Config.md#rootdir)

## Properties

### <a id="basedir" name="basedir"></a> basedir

• `Readonly` **basedir**: `string`

Directory to use as base for search when calling [TestFs.from](TestFs.TestFs.md#from)

**`Default Value`**

given by the configuration in `.mochapodrc.yml`

#### Inherited from

[Opts](TestFs.Opts.md).[basedir](TestFs.Opts.md#basedir)

#### Defined in

[testfs/types.ts:79](https://github.com/balena-io-modules/mocha-pod/blob/906bf95/lib/testfs/types.ts#L79)

___

### <a id="cleanup" name="cleanup"></a> cleanup

• `Readonly` **cleanup**: `string`[]

List of files or [globbing patterns](https://github.com/mrmlnc/fast-glob#pattern-syntax)
identifying  files that should be removed during the restore step.
Add here any temporary files created during the test that should be cleaned up.

**`Default Value`**

`[]`

#### Inherited from

[Opts](TestFs.Opts.md).[cleanup](TestFs.Opts.md#cleanup)

#### Defined in

[testfs/types.ts:103](https://github.com/balena-io-modules/mocha-pod/blob/906bf95/lib/testfs/types.ts#L103)

___

### <a id="filesystem" name="filesystem"></a> filesystem

• `Readonly` **filesystem**: [`Directory`](TestFs.Directory.md)

Additional directory specification to be passed to `testfs()`

**`Default Value`**

`{}`

#### Defined in

[testfs/types.ts:139](https://github.com/balena-io-modules/mocha-pod/blob/906bf95/lib/testfs/types.ts#L139)

___

### <a id="keep" name="keep"></a> keep

• `Readonly` **keep**: `string`[]

List of files or [globbing patterns](https://github.com/mrmlnc/fast-glob#pattern-syntax)
identifying any files that should be backed up prior to setting up the
filesystem. Any files that will be modified during the test should go here

**`Default Value`**

`[]`

#### Inherited from

[Opts](TestFs.Opts.md).[keep](TestFs.Opts.md#keep)

#### Defined in

[testfs/types.ts:94](https://github.com/balena-io-modules/mocha-pod/blob/906bf95/lib/testfs/types.ts#L94)

___

### <a id="rootdir" name="rootdir"></a> rootdir

• `Readonly` **rootdir**: `string`

Directory to use as base for the directory specification and glob search.

**`Default Value`**

`/`

#### Inherited from

[Opts](TestFs.Opts.md).[rootdir](TestFs.Opts.md#rootdir)

#### Defined in

[testfs/types.ts:86](https://github.com/balena-io-modules/mocha-pod/blob/906bf95/lib/testfs/types.ts#L86)
