[mocha-pod](README.md) / Exports

# mocha-pod

## Table of contents

### Namespaces

- [MochaPod](modules/MochaPod.md)
- [TestFs](modules/TestFs.md)

### Functions

- [testfs](modules.md#testfs)

## Functions

### <a id="testfs" name="testfs"></a> testfs

▸ **testfs**(`spec?`, `opts?`): [`Disabled`](interfaces/TestFs.Disabled.md)

Create a disabled testfs configuration from the given directory spec.

Calling the [enable](interfaces/TestFs.Disabled.md#enable) method will prepare the filesystem for testing
operations.

**IMPORTANT** don't use this module in a real (non-containerized) system, specially with admin permissions, you risk leaving the system
in an inconsistent state if a crash happens before a `restore()` can be performed.

**`Default Value`**

`{}`

**`Default Value`**

`{}`

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `spec?` | [`Directory`](interfaces/TestFs.Directory.md) | Directory specification with files that need to be               exist after set-up of the test fs. If the file exists previously               in the given location it will be added to the `keep` list for restoring later.               If it doesn't it will be added to the `cleanup` list to be removed during cleanup |
| `opts?` | `Partial`<[`Opts`](interfaces/TestFs.Opts.md)\> | Additional options for the test fs. |

#### Returns

[`Disabled`](interfaces/TestFs.Disabled.md)

- Disabled test fs configuration

#### Defined in

[testfs/types.ts:104](https://github.com/balena-io-modules/mocha-pod/blob/8513974/lib/testfs/types.ts#L104)
