// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 添加 Node.js 核心模块的 Polyfill 配置
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    ...config.resolver.extraNodeModules,
    // 当代码尝试 require('url') 时，使用我们安装的 'url' 包作为替代
    url: require.resolve('url/'), // 注意最后的斜杠，这很重要
  },
};

module.exports = config;
