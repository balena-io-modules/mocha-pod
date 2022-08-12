[mocha-pod](../README.md) / [Exports](../modules.md) / [TestFs](../modules/TestFs.md) / TestFs

# Interface: TestFs

[TestFs](../modules/TestFs.md).TestFs

## Callable

### TestFs

▸ **TestFs**(`spec?`, `opts?`): [`Disabled`](TestFs.Disabled.md)

Create a disabled testfs configuration from the given directory spec.

Calling the [enable](TestFs.Disabled.md#enable) method will prepare the filesystem for testing
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
| `spec?` | [`Directory`](TestFs.Directory.md) | Directory specification with files that need to be               exist after set-up of the test fs. If the file exists previously               in the given location it will be added to the `keep` list for restoring later.               If it doesn't it will be added to the `cleanup` list to be removed during cleanup |
| `opts?` | `Partial`<[`Opts`](TestFs.Opts.md)\> | Additional options for the test fs. |

#### Returns

[`Disabled`](TestFs.Disabled.md)

- Disabled test fs configuration

#### Defined in

[testfs/types.ts:104](https://github.com/balena-io-modules/mocha-pod/blob/8513974/lib/testfs/types.ts#L104)

## Table of contents

### Methods

- [config](TestFs.TestFs.md#config)
- [leftovers](TestFs.TestFs.md#leftovers)
- [restore](TestFs.TestFs.md#restore)

## Methods

### <a id="config" name="config"></a> config

▸ **config**(`conf`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `conf` | `Partial`<[`Config`](TestFs.Config.md)\> |

#### Returns

`void`

#### Defined in

[testfs/types.ts:111](https://github.com/balena-io-modules/mocha-pod/blob/8513974/lib/testfs/types.ts#L111)

___

### <a id="leftovers" name="leftovers"></a> leftovers

▸ **leftovers**(): `Promise`<`string`[]\>

Return any leftover backup files from previous invocations.

If any leftovers exist prior to running [()](TestFs.Disabled.md#enable)
it means that a previous invocation did not terminate succesfully and is not
safe to run the setup.

#### Returns

`Promise`<`string`[]\>

#### Defined in

[testfs/types.ts:128](https://github.com/balena-io-modules/mocha-pod/blob/8513974/lib/testfs/types.ts#L128)

___

### <a id="restore" name="restore"></a> restore

▸ **restore**(): `Promise`<`void`\>

Restore testsfs globally.

This function looks for a currently enabled instance of a test filesystem and calls
[restore](TestFs.Enabled.md#restore) on that instance.

#### Returns

`Promise`<`void`\>

#### Defined in

[testfs/types.ts:119](https://github.com/balena-io-modules/mocha-pod/blob/8513974/lib/testfs/types.ts#L119)
