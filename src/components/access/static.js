
// static access controller

import { wildcard } from './util.js'

const type = 'static'

export class Access {
  constructor ({ manifest, Identity, blocks }) {
    this.manifest = manifest
    this.Identity = Identity
    this.blocks = blocks
    this.write = new Set(this.manifest.access.write)
  }

  static async create ({ manifest, Identity, blocks }) {
    if (!Array.isArray(manifest.access.write) || !manifest.access.write.length) {
      throw new Error('manifest.access.write does not grant access to any writers')
    }

    return new Access({ manifest, Identity, blocks })
  }

  static get type () { return type }
  get type () { return type }

  async canAppend (entry) {
    // entry signature has already been validated
    const identity = await this.Identity.fetch({ blocks: this.blocks, auth: entry.auth })
    return this.write.has(identity.id) || this.write.has(wildcard)
  }
}
