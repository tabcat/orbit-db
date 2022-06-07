
import * as Block from 'multiformats/block'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import { CID } from 'multiformats/cid'
import { base32 } from 'multiformats/bases/base32'

export class Replicator {
  constructor ({ blocks, pubsub, topic, manifest, replica, access, Entry, Identity }) {
    this.blocks = blocks
    this.pubsub = pubsub
    this.topic = topic
    this.manifest = manifest
    this.replica = replica
    this.access = access
    this.Entry = Entry
    this.Identity = Identity
  }

  static async create ({ blocks, pubsub, manifest, replica, access, Entry, Identity }) {
    const topic = base32.encode(manifest.getTag())
    const replicator = new Replicator({ blocks, pubsub, topic, manifest, replica, access, Entry, Identity })

    await pubsub.subscribe(topic, replicator._onReceivedBroadcast)
    await replicator.broadcast(replica.heads)
    return replicator
  }

  async close () {
    await this.pubsub.unsubscribe(this.topic, this._onReceivedBroadcast)
  }

  async broadcast (heads) {
    const block = await Block.encode({ value: Array.from(heads), codec, hasher })
    await this.pubsub.publish(this.topic, block.bytes)
  }

  async _onReceivedBroadcast ({ data: bytes }) {
    const block = await Block.decode({ bytes, codec, hasher })
    const heads = new Set(block.value.map(cid => cid.toString(base32)))
    //
    // const novel = new Set()
    // for (const cid of heads) {
    //   if (!this.replica.known(cid)) novel.add(cid)
    // }
    //
    // const ahead = !Array.from(this.replica.heads).every(heads.has.bind(heads))
    // if (!novel.size && ahead) {
    //   return this.broadcase(this.replica.heads)
    // }
    //
    // const seen = new Set()
    //
    // // todo: generalize Replica.traverse to be used here
    // async function * traverse (queue) {
    //   const entries = await Promise.all(
    //     Array.from(queue)
    //       .map(cid => this.block.get(CID.parse(cid, base32)))
    //   )
    // 
    //
    // }
    //
    // return replica.add(traverse(Array.from(heads)))
    console.log(heads) // todo: replicate
  }
}
