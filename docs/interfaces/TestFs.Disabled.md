[mocha-pod](../README.md) / [Exports](../modules.md) / [TestFs](../modules/TestFs.md) / Disabled

# Interface: Disabled

[TestFs](../modules/TestFs.md).Disabled

## Table of contents

### Methods

- [enable](TestFs.Disabled.md#enable)

## Methods

### <a id="enable" name="enable"></a> enable

▸ **enable**(): `Promise`<[`Enabled`](TestFs.Enabled.md)\>

Setup the test environment with the provided test configurations

The following operations are performed during this step.

- Group the directory spec into existing/non-existing files. Existing files go into the keep list for backup and non-existing will go to the cleanup list.
- Create a backup of all files matching the keep list
- Replace all files from the directory spec into the filesystem.

Note that attempts to call the setup function more than once will cause an exception.

#### Returns

`Promise`<[`Enabled`](TestFs.Enabled.md)\>

#### Defined in

[testfs/types.ts:148](https://github.com/balena-io-modules/mocha-pod/blob/511c926/lib/testfs/types.ts#L148)
