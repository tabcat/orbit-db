
import EventEmitter from 'events'
import where from 'wherearewe'
import path from 'path'
import makedir from 'make-dir'

import * as version from './version.js'
import { Manifest, Address } from './manifest/index.js'
import { Register } from './register.js'
import { Database } from './database.js'
import { ORBITDB_LOWER } from './contants.js'

const registry = Object.fromEntries([
  'store',
  'access',
  'entry',
  'identity'
].map(k => [k, new Register(`/${ORBITDB_LOWER}/${k}`)]))
const dirs = root => Object.fromEntries([
  'databases',
  'identities',
  'keychain'
].map(k => [k, path.join(root, k)]))

// database factory
export class OrbitDB {
  constructor (config) {
    this.directory = config.directory
    this.dirs = dirs(this.directory)
    this.storageOps = config.storageOps

    this.identity = config.identity

    this.identities = config.identities
    this.keychain = config.keychain

    this.blocks = config.blocks
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
      blocks: options.blocks ?? options.ipfs.block,
      pubsub: options.pubsub ?? options.ipfs.pubsub
    }

    const defaultStorage = location => new this.Storage(location, storageOps)
    const defaultIdentities = () => defaultStorage(dirs(directory).identities)
    const defaultKeychain = (storage) => new this.Keychain({ getDatastore: () => storage })
    const defaultIdentity = () => this.registry.identity.star

    if (options.identity) {
      config.identity = options.identity
    } else {
      config.identities = defaultIdentities()
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
  static get Storage () { throw new Error('Storage module was never assigned') }
  static get Keychain () { throw new Error('Keychain module was never assigned') }
  static get Replicator () { throw new Error('Replicator module was never assigned') }

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
      ...options
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
      throw new Error(`database ${address} is already open`)
    }

    const Storage = options.Storage || OrbitDB.Storage
    const Replicator = options.Replicator || OrbitDB.Replicator

    async function _open (manifest, options = {}) {
      const location = path.join(this.dirs.databases, manifest.address.cid)
      const createStorage = name => new Storage(path.join(location, name), this.storageOps)

      return Database.open({
        orbitdb: this, // passed for access controllers if they need to make another database
        manifest,
        blocks: this.blocks,
        pubsub: this.pubsub,
        identity: this.identity,
        Replicator,
        createStorage,
        options,
        ...Manifest.getComponents(this.registry, manifest)
      })
    }

    this._opening[address] = _open(address, options).bind(this)
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

    return this._opening[address]
  }
}
