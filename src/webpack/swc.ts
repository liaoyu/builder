import { Configuration } from 'webpack'
import browserslist from 'browserslist'

import { shouldAddGlobalPolyfill, AddPolyfill, BuildConfig, TransformObject } from '../utils/build-conf'
import { LoaderInfo } from '../utils/webpack'
import { ignoreTsTranspileOnlyWarning, makeTsLoaderOptions } from './typescript'

export function makeSwcLoaderOptions(
  /** https://swc.rs/docs/configuration/supported-browsers#targets */
  targets: string[],
  /** polyfill 模式 */
  polyfill: AddPolyfill,
  /** 是否 react 项目 */
  withReact = false,
  /** 是否 ts 语法 */
  isTsSyntax = false
) {
  return {
    jsc: {
      parser: {
        syntax: isTsSyntax ? 'typescript' : 'ecmascript',
        jsx: withReact,
        dynamicImport: true,
        decorators: true
      },
      transform: {
        legacyDecorator: true,
        decoratorMetadata: true
      }
    },
    env: {
      targets: browserslist(targets),
      ...(
        // global polyfill
        shouldAddGlobalPolyfill(polyfill)
        && {
          // https://swc.rs/docs/configuration/supported-browsers#mode
          mode: 'usage',
          coreJs: '3'
        }
      )
    }
  }
}

export function addSwcTsTransform(
  /** 当前 webpack 配置 */
  config: Configuration,
  /** 构建配置 build config */
  { targets, optimization }: BuildConfig,
  /** transform 信息 */
  transform: TransformObject,
  /** 是否 react 项目 */
  withReact: boolean,
  appendRuleWithLoaders: (previousConfig: Configuration, ...loaders: LoaderInfo[]) => Configuration
) {
  const tsLoaderOptions = makeTsLoaderOptions(transform)
  const swcOptions = makeSwcLoaderOptions(
    targets.browsers,
    optimization.addPolyfill,
    withReact,
    true
  )

  if (tsLoaderOptions.transpileOnly) {
    config = ignoreTsTranspileOnlyWarning(config)
  }

  return appendRuleWithLoaders(
    config,
    { loader: 'swc-loader', options: swcOptions },
    // 这边预期 ts-loader 将 ts 代码编成 ES6 代码，然后再交给 babel-loader 处理
    { loader: 'ts-loader', options: tsLoaderOptions }
  )
}
