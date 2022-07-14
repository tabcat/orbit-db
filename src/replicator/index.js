
import { PubsubHeadsExchange } from './pubsub-heads-exchange.js'

export class Replicator {
  constructor (config, modules) {
    this.config = config
    this.modules = modules
  }

  // config structure: { peerId, manifest, blocks, pubsub, replica, access, Entry, Identity }
  static async create (config) {
    const modules = Replicator.modules.map(Module => new Module(config))

    const replicator = new Replicator(config, modules)

    return replicator
  }

  async close () {
    await this.stop()
  }

  async start () {
    await Promise.all(this.modules.map(module => module.start()))
  }

  async stop () {
    await Promise.all(this.modules.map(module => module.stop()))
  }

  static modules () {
    return [
      PubsubHeadsExchange
    ]
  }
}
