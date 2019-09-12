const path = require('path')
const io = require('orbit-db-io')

const excluded = ['write', 'accessController', 'overwrite', 'replicate',
  'localOnly', 'create', 'type', 'defaults', 'mergeDefaults']

// Creates a DB manifest file and saves it in IPFS
const createDBManifest = async (ipfs, name, type, accessControllerAddress, options) => {
  const manifest = Object.assign({
    name: name,
    type: type,
    accessController: path.join('/ipfs', accessControllerAddress)
  },
  options.defaults
    ? {
      defaults: Object.keys(options).reduce((acc, k) => !excluded.includes(k)
        ? Object.assign(acc, { [k]: options[k] })
        : acc,
      {})
    }
    : {}
  )

  return io.write(ipfs, options.format || 'dag-cbor', manifest, options)
}

module.exports = createDBManifest
