const path = require('path')

module.exports = {
  basePath: '',
  output: 'export',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '**',
      },
    ],
    unoptimized: true,
  },
  productionBrowserSourceMaps: true,
  // PGlite (the on-device database) imports node:module for its Node build; the browser never uses it.
  webpack: (config, { webpack }) => {
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:module$/, path.resolve(__dirname, 'lib/local/empty-module.js'))
    )
    return config
  },
  transpilePackages: ['@ionic/react', '@ionic/core', '@stencil/core', 'ionicons'],
};
