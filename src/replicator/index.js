
import * as Block from 'multiformats/block'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import { CID } from 'multiformats/cid'
import { base32 } from 'multiformats/bases/base32'
import { traverser } from '../traversal.js'

export class Replicator {
  constructor ({ blocks, pubsub, manifest, replica, access, Entry, Identity }) {
    this.blocks = blocks
    this.pubsub = pubsub
    this.manifest = manifest
    this.replica = replica
    this.access = access
    this.Entry = Entry
    this.Identity = Identity
  }

  static async create ({ blocks, pubsub, manifest, replica, access, Entry, Identity }) {
    const replicator = new Replicator({ blocks, pubsub, topic, manifest, replica, access, Entry, Identity })
    await replicator.start()

    return replicator
  }

  async close () {
    await this.stop()
  }

  async start () {}
  async stop () {}
}
