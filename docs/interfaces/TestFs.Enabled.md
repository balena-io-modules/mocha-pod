[mocha-pod](../README.md) / [Exports](../modules.md) / [TestFs](../modules/TestFs.md) / Enabled

# Interface: Enabled

[TestFs](../modules/TestFs.md).Enabled

Describe a test filesystem that is in the enabled state.

When in this state, the only possible action is to

## Table of contents

### Properties

- [backup](TestFs.Enabled.md#backup)
- [id](TestFs.Enabled.md#id)

### Methods

- [cleanup](TestFs.Enabled.md#cleanup)
- [restore](TestFs.Enabled.md#restore)

## Properties

### <a id="backup" name="backup"></a> backup

• `Readonly` **backup**: `string`

Location of the backup file

#### Defined in

[testfs/types.ts:120](https://github.com/balena-io-modules/mocha-pod/blob/ee6b4c1/lib/testfs/types.ts#L120)

___

### <a id="id" name="id"></a> id

• `Readonly` **id**: `string`

Id of the testfs instance

#### Defined in

[testfs/types.ts:115](https://github.com/balena-io-modules/mocha-pod/blob/ee6b4c1/lib/testfs/types.ts#L115)

## Methods

### <a id="cleanup" name="cleanup"></a> cleanup

▸ **cleanup**(): `Promise`<[`Enabled`](TestFs.Enabled.md)\>

Remove any files modified by the test as specified in the
testfs `cleanup` configuration.

#### Returns

`Promise`<[`Enabled`](TestFs.Enabled.md)\>

#### Defined in

[testfs/types.ts:135](https://github.com/balena-io-modules/mocha-pod/blob/ee6b4c1/lib/testfs/types.ts#L135)

___

### <a id="restore" name="restore"></a> restore

▸ **restore**(): `Promise`<[`Disabled`](TestFs.Disabled.md)\>

Restore the environment to the state before the filesystem was setup

The following operations are performed during restore
- delete any files in the `cleanup` list
- restore the original filesystem files from the backup

#### Returns

`Promise`<[`Disabled`](TestFs.Disabled.md)\>

#### Defined in

[testfs/types.ts:129](https://github.com/balena-io-modules/mocha-pod/blob/ee6b4c1/lib/testfs/types.ts#L129)
