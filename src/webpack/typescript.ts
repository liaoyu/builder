import { Configuration } from 'webpack'

import { TransformObject } from '../utils/build-conf'
import { Env, getEnv } from '../utils/build-env'
import { abs } from '../utils/paths'
import { ignoreWarning } from '../utils/webpack'

export type TransformTsConfig = {
  // 默认开发模式跳过类型检查，提高构建效率，另，避免过严的限制
  transpileOnlyWhenDev?: boolean
  // 是否使用项目里的 typescript 库进行类型检查和编译
  useProjectTypeScript?: boolean
}

const compilerOptions = {
  // 这里设置为 ES2020（最新的规范能力），需要注意的是，这里设置 ESNext 可能是不合适的：
  // 
  // > The special ESNext value refers to the highest version your version of TypeScript supports. This setting should be used with caution, 
  // > since it doesn’t mean the same thing between different TypeScript versions and can make upgrades less predictable.
  // > - https://www.typescriptlang.org/tsconfig#target
  // 
  // 这里 Typescript 处理的结果会交给 babel 处理；我们默认使用 @babel/preset-env，预期会支持最新的规范能力
  // 然而我们使用的 Typescript 跟 babel (& @babel/preset-env) 行为之间可能会有 gap：
  // 以 babel-plugin-proposal-class-properties 为例，在对应的 proposal 进入 stage 4 后，
  // Typescript 会认为以 ESNext 为目标时，对应的语法不再需要转换；
  // 而如果 builder 此时依赖了相对更新的 Typescript 版本，以及相对较旧的 babel (& @babel/preset-env) 版本
  // 那么这里对 class properties 语法的支持就会有问题（Typescript & babel 都不会对它进行转换）
  target: 'ES2020',
  // 跟 target 保持一致，而不是设置为 CommonJS；由 webpack 来做 module 格式的转换以 enable tree shaking
  module: 'ES2020',
  // module 为 ES2020 时，moduleResolution 默认为 Classic（虽然 TS 文档不是这么说的），这里明确指定为 Node
  moduleResolution: 'Node'
}

// ts-loader 开启 transpileOnly 后会出的 warning
const tsTranspileOnlyWarningPattern = /export .* was not found in/

export function makeTsLoaderOptions(transform: TransformObject) {
  const transformConfig: Required<TransformTsConfig> = {
    transpileOnlyWhenDev: true,
    useProjectTypeScript: false,
    ...(transform.config as TransformTsConfig)
  }

  return {
    transpileOnly: getEnv() === Env.Dev && transformConfig.transpileOnlyWhenDev,
    compilerOptions,
    // 方便项目直接把内部依赖（portal-base / fe-core 等）的源码 link 进来一起构建调试
    allowTsInNodeModules: true,
    compiler: transformConfig.useProjectTypeScript ?
      require.resolve('typescript', {
        paths: [abs('node_modules')]
      }) :
      'typescript'
  }
}

// 干掉因为开启 transpileOnly 导致的 warning
// 详情见 https://github.com/TypeStrong/ts-loader#transpileonly
export function ignoreTsTranspileOnlyWarning(config: Configuration) {
  return ignoreWarning(config, tsTranspileOnlyWarningPattern)
}
