[mocha-pod](../README.md) / [Exports](../modules.md) / MochaPod

# Namespace: MochaPod

## Table of contents

### References

- [default](MochaPod.md#default)

### Type Aliases

- [Config](MochaPod.md#config)

### Functions

- [Config](MochaPod.md#config-1)

## References

### <a id="default" name="default"></a> default

Renames and re-exports [Config](MochaPod.md#config)

## Type Aliases

### <a id="config" name="config"></a> Config

Ƭ **Config**: `Object`

#### Index signature

▪ [key: `string`]: `any`

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `basedir` | `string` | Base directory where configuration files are looked for. If a relative path is used, it is asumed to be relative to `process.cwd()`.  **`Default Value`**  `process.cwd()` |
| `buildOnly` | `boolean` | Only perform the build step during the global mocha setup. If set to false this will run `npm run test` inside a container after the build.  **`Default Value`**  `false` |
| `deviceArch` | `string` | The architecture of the system where the images will be built and ran. This is used to replace `%%BALENA_ARCH%%` in [Dockerfile.template](https://www.balena.io/docs/reference/base-images/base-images/#how-the-image-naming-scheme-works)  The architecture is detected automatically using `uname`, set this value if building on a device other than the local machine.  Supported values: `'amd64' \| 'aarch64' \| 'armv7hf' \| 'i386' \| 'rpi'`  **`Default Value`**  inferred from `process.arch` |
| `deviceType` | `string` | The device type of the system where the images will be built an ran. This is used to replace `%%BALENA_MACHINE_NAME%%` in [Dockerfile.template](https://www.balena.io/docs/reference/base-images/base-images/#how-the-image-naming-scheme-works) given.  The device type is inferred automatically from the device architecture, set this value if building on a device other than the local machine. |
| `dockerBuildOpts` | { `[key: string]`: `any`;  } | Extra options to pass to the image build. See https://docs.docker.com/engine/api/v1.41/#tag/Image/operation/ImageBuild  **`Default Value`**  `{   buildArgs: {     NODE_VERSION // the host environment node version    NODE_VERSION_MAJOR // the host environment major node version    BALENA_ARCH // the host architecture or the configuration value set by the user    BALENA_MACHINE_NAME // the machine name as set by the user or inferred from the architecture   } }` |
| `dockerHost` | `string` | IP address or URL for the docker host. If no protocol is included, the protocol is assumed to be `tcp://` e.g. - `tcp://192.168.1.105` - `unix:///var/run/docker.sock`  The configuration value can be overriden by setting the `DOCKER_HOST` environment variable.  **`Default Value`**  `unix:///var/run/docker.sock` |
| `dockerIgnore` | `string`[] | List of default dockerignore directives. These are overriden if a `.dockerignore` file is defined at the project root.  NOTE: `*/*//.git` is always ignored  **`Default Value`**  `['!*/*//Dockerfile', '!*/*//Dockerfile.*/', '*/*//node_modules', '*/*//build', '*/*//coverage' ]` |
| `logging` | `string` | Log namespaces to enable. This can also be controlled via the `DEBUG` env var.  See https://github.com/debug-js/debug  **`Default Value`**  `'mocha-pod,mocha-pod:error'` |
| `projectName` | `string` | Name of the project where mocha-pod is being ran on. By default it will get the name from `package.json` at `basedir`, if it does not exist, it will use `mocha-pod-testing` |
| `testCommand` | `string`[] | Test command to use when running tests within a container. This will only be used if `buildOnly` is set to `false`.  **`Default Value`**  `["npm", "run", "test"]` |
| `testfs` | `Partial`<`Omit`<[`Config`](../interfaces/TestFs.Config.md), ``"basedir"``\>\> | TestFs configuration to be set by the `beforeAll` mocha-pod hook.  **`Default Value`**  `{}` |

#### Defined in

[config.ts:225](https://github.com/balena-io-modules/mocha-pod/blob/83469cb/lib/config.ts#L225)

[config.ts:13](https://github.com/balena-io-modules/mocha-pod/blob/83469cb/lib/config.ts#L13)

## Functions

### <a id="config-1" name="config-1"></a> Config

▸ **Config**(`overrides?`, `source?`): `Promise`<[`Config`](MochaPod.md#config)\>

Loads a mocha-pod configuration from the given source file and
overrides the default values

**`Default Value`**

`path.join(process.cwd(), '.mochapodrc.yml')`

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `overrides` | `Partial`<[`Config`](MochaPod.md#config)\> | `{}` | additional overrides. These take precedence over `.mochapodrc.yml` |
| `source` | `string` | `MOCHAPOD_CONFIG` | full path to look for the configuration file. |

#### Returns

`Promise`<[`Config`](MochaPod.md#config)\>

- updated mocha pod config including user overrides.

#### Defined in

[config.ts:225](https://github.com/balena-io-modules/mocha-pod/blob/83469cb/lib/config.ts#L225)
