const path = require('path')
const io = require('orbit-db-io')

// Creates a DB manifest file and saves it in IPFS
const createDBManifest = async (ipfs, name, type, accessControllerAddress, options) => {
  const manifest = Object.assign({
    name: name,
    type: type,
    accessController: path.join('/ipfs', accessControllerAddress)
  },
  typeof options.defaults === 'object' ? { defaults: options.defaults } : {}
  )

  return io.write(ipfs, options.format || 'dag-cbor', manifest, options)
}

module.exports = createDBManifest
