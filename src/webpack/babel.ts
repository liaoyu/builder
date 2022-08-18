import produce from 'immer'
import { Configuration } from 'webpack'

import {
  shouldAddGlobalPolyfill, AddPolyfill, shouldAddRuntimePolyfill, BuildConfig, TransformObject
} from '../utils/build-conf'
import { Env, getEnv } from '../utils/build-env'
import { LoaderInfo } from '../utils/webpack'
import { ignoreTsTranspileOnlyWarning, makeTsLoaderOptions, TransformTsConfig } from './typescript'


type BabelPreset = string | [string, ...unknown[]]
type BabelPlugin = string | [string, ...unknown[]]

// babel-loader options（同 babel options）
export type BabelOptions = {
  presets?: BabelPreset[]
  plugins?: BabelPlugin[]
  sourceType?: string
}

export type TransformBabelConfig = TransformTsConfig & {
  babelOptions?: BabelOptions
}

// 不支持 preset 简写的形式
function adaptBabelPreset(preset: BabelPreset): BabelPreset {
  if (typeof preset === 'string') {
    return require.resolve(preset)
  }
  const [name, ...options] = preset
  return [require.resolve(name), ...options]
}

// TODO: 添加 babel-plugin- 前缀
function adaptBabelPluginName(name: string) {
  return require.resolve(name)
}

function adaptBabelPlugin(plugin: BabelPlugin): BabelPlugin {
  if (typeof plugin === 'string') {
    return adaptBabelPluginName(plugin)
  }
  const [name, ...options] = plugin
  return [adaptBabelPluginName(name), ...options]
}

type BabelPresetOrPlugin = BabelPreset | BabelPlugin

function includes<T extends BabelPresetOrPlugin>(list: T[], name: string) {
  return list.some(item => {
    const itemName = typeof item === 'string' ? item : item[0]
    return itemName === name
  })
}

const corejsOptions = {
  version: 3,
  proposals: false
}

function getBabelPresetEnvOptions(targets: string[], polyfill: AddPolyfill) {
  return {
    // enable tree-shaking，由 webpack 来做 module 格式的转换
    modules: false,
    targets,
    ...(
      // global polyfill
      shouldAddGlobalPolyfill(polyfill)
      && {
        // https://babeljs.io/docs/en/babel-preset-env#usebuiltins
        useBuiltIns: 'usage',
        corejs: corejsOptions
      }
    )
  }
}

/**
 * 构造 babel-loader 的配置对象，主要是添加默认的 polyfill 相关配置
 * 另外会调整 preset、plugin 的名字为绝对路径
 */
 export function makeBabelLoaderOptions(
  /** babel options */
  options: BabelOptions,
  /** babel env targets: https://babeljs.io/docs/en/babel-preset-env#targets */
  targets: string[],
  /** polyfill 模式 */
  polyfill: AddPolyfill,
  /** 是否 react 项目 */
  withReact = false
) {
  options = options || {}

  const isDev = getEnv() === Env.Dev

  return produce(options, nextOptions => {
    const presets = nextOptions.presets || []
    const presetEnvName = '@babel/preset-env'
    if (!isDev && !includes(presets, presetEnvName)) {
      presets.unshift([presetEnvName, getBabelPresetEnvOptions(targets, polyfill)])
    }
    const presetReactName = '@babel/preset-react'
    if (withReact && !includes(presets, presetReactName)) {
      presets.push([presetReactName, { development: isDev }])
    }
    nextOptions.presets = presets.map(adaptBabelPreset)

    const plugins = nextOptions.plugins || []
    const pluginTransformRuntimeName = '@babel/plugin-transform-runtime'
    if (!isDev && shouldAddRuntimePolyfill(polyfill) && !includes(plugins, pluginTransformRuntimeName)) {
      plugins.unshift([pluginTransformRuntimeName, { corejs: corejsOptions }])
    }
    const pluginReactRefreshName = 'react-refresh/babel'
    if (withReact && isDev && !includes(plugins, pluginReactRefreshName)) {
      plugins.push(pluginReactRefreshName)
    }
    nextOptions.plugins = plugins.map(adaptBabelPlugin)

    // 用于指定预期模块类型，若用户未指定，则使用默认值 unambiguous，即：自动推断
    nextOptions.sourceType = nextOptions.sourceType || 'unambiguous'
  })
}

export function addBabelTsTransform(
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
  const transformConfig = (transform.config || {}) as TransformBabelConfig
  const babelOptions = makeBabelLoaderOptions(
    transformConfig.babelOptions || {},
    targets.browsers,
    optimization.addPolyfill,
    withReact
  )

  const tsLoaderOptions = makeTsLoaderOptions(transform)

  if (tsLoaderOptions.transpileOnly) {
    config = ignoreTsTranspileOnlyWarning(config)
  }

  return appendRuleWithLoaders(
    config,
    { loader: 'babel-loader', options: babelOptions },
    // 这边预期 ts-loader 将 ts 代码编成 ES6 代码，然后再交给 babel-loader 处理
    { loader: 'ts-loader', options: tsLoaderOptions }
  )
}
