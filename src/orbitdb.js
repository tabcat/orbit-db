
import EventEmitter from 'events'
import where from 'wherearewe'
import path from 'path'
import makedir from 'make-dir'

import * as version from './version.js'
import { Manifest, Address } from './manifest/index.js'
import { Register } from './register.js'
import { Database } from './database/index.js'
import { ORBIT_DB_LOWER } from './constants.js'

const registry = Object.fromEntries([
  'store',
  'access',
  'entry',
  'identity'
].map(k => [k, new Register(`/${ORBIT_DB_LOWER}/${k}`)]))

const dirs = root => Object.fromEntries([
  'databases',
  'identities',
  'keychain'
].map(k => [k, path.join(root, k)]))

// database factory
class OrbitDB {
  constructor (config) {
    this.directory = config.directory
    this.dirs = dirs(this.directory)
    this.storageOps = config.storageOps

    this.identity = config.identity

    this.identities = config.identities
    this.keychain = config.keychain

    this.blocks = config.blocks
    this.peerId = config.peerId
    this.pubsub = config.pubsub

    this.events = new EventEmitter()

    this.opened = {}
    this._opening = {}
  }

  static async create (options = {}) {
    let directory, storageOps
    if (where.isNode) {
      directory = path.normalize(options.directory)
      await Promise.all(Object.values(dirs(directory)).map(makedir))
    } else {
      directory = ORBITDB_LOWER
      storageOps = { prefix: '' }
    }

    const config = {
      directory,
      storageOps: options.storageOps || storageOps,
      offline: options.offline === true,
      blocks: options.blocks || options.ipfs.block,
      // peerId and pubsub is not required
      peerId: options.peerId || null,
      pubsub: options.pubsub ?? options.ipfs.pubsub
    }

    const defaultStorage = location => new this.Storage(location, storageOps)
    const defaultKeychain = (storage) => new this.Keychain({ getDatastore: () => storage })
    const defaultIdentity = () => this.registry.identity.star

    if (options.identity) {
      config.identity = options.identity
    } else {
      config.identities = defaultStorage(dirs(directory).identities)
      config.keychain = defaultKeychain(defaultStorage(dirs(directory).keychain))

      await config.identities.open()
      await config.keychain.components.getDatastore().open()

      config.identity = await defaultIdentity().get({
        name: 'default',
        identities: config.identities,
        keychain: config.keychain
      })
    }

    return new OrbitDB(config)
  }

  static get version () { return version }

  static get Manifest () { return Manifest }

  static get registry () { return registry }
  get registry () { return registry }

  // modules assigned in src/index.js
  // Note: these should be static or as close to as possible... prototype?
  get Storage () { throw new Error('Storage module was never assigned') }
  get Keychain () { throw new Error('Keychain module was never assigned') }
  get Replicator () { throw new Error('Replicator module was never assigned') }

  async stop () {
    await Promise.all(Object.values(this._opening))
    await Promise.all(Object.values(this.opened).map(db => db.close()))

    this.events.emit('stop')
    this.events.removeAllListeners('opened')
    this.events.removeAllListeners('closed')

    await this.identities.close()
    await this.keychain.components.getDatastore().close()
  }

  async determineManifest (name, options = {}) {
    if (typeof name !== 'string') throw new Error('name must be a string')

    const opts = {
      version: 1,
      store: {
        type: this.registry.store.star.type
      },
      access: {
        type: this.registry.access.star.type,
        write: [this.identity.id]
      },
      entry: {
        type: this.registry.entry.star.type
      },
      identities: {
        type: this.registry.identity.star.type
      },
      ...Object.keys(this.registry).filter(key => options[key]).reduce(
        ...options.meta ? options.meta : {})
    }

    const manifest = await Manifest.create(name, opts)
    await this.blocks.put(manifest.block)

    try {
      Manifest.getComponents(this.registry, manifest)
    } catch (e) {
      if (options.warn !== false) {
        console.warn('manifest configuration contains unregistered components')
      }
    }

    return manifest
  }

  async fetchManifest (address) {
    address = Address.asAddress(address, true)
    return Manifest.asManifest({ block: await this.blocks.get(address.cid) }, true)
  }

  async open (manifest, options = {}) {
    manifest = Manifest.asManifest(manifest, true)
    const address = manifest.address

    const isOpen = this.opened[address] || this._opening[address]
    if (isOpen) {
      throw new Error(`database ${address} is already open or being opened`)
    }

    const components = Manifest.getComponents(this.registry, manifest)

    // this will return a duplicate instance of the identity (not epic) until the instances cache is used in Identity.get
    const identity = options.identity || await components.Identity.get({
      name: 'default',
      identities: this.identities,
      keychain: this.keychain
    })

    const Storage = options.Storage || OrbitDB.Storage
    const Replicator = options.Replicator || OrbitDB.Replicator

    const location = path.join(this.dirs.databases, manifest.address.cid)
    const createStorage = name => new Storage(path.join(location, name), this.storageOps)

    const _open = async (manifest, options = {}) => Database.open({
      orbitdb: this, // passed for access controllers if they need to make another database
      manifest,
      blocks: this.blocks,
      peerId: this.peerId,
      pubsub: this.pubsub,
      identity,
      replicator,
      createStorage,
      options,
      ...Manifest.getComponents(this.registry, manifest)
    })

    this._opening[address] = _open(address, options)
      .then(db => {
        this.opened[address] = db
        delete this._opening[address]
        this.events.emit('opened', db)
        db.events.once('closed', () => {
          this.events.emit('closed', db)
          delete this.opened[address]
        })
        return db
      })
      .catch(e => {
        console.error(e)
        throw new Error(`failed opening database with address: ${address}`)
      })

    return this._opening[address]
  }
}

export { OrbitDB }
