
import * as Block from 'multiformats/block'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import { base32 } from 'multiformats/bases/base32'
import { Monitor } from './pubsub/monitor.js'
import { Direct } from './pubsub/direct.js'

export class PubsubHeadsExchange {
  constructor ({ manifest, peerId, pubsub, blocks, Entry, Identity, replica, access }) {
    this.manifest = manifest
    this.peerId = peerId
    this.pubsub = pubsub
    this.blocks = blocks
    this.Entry = Entry
    this.Identity = Identity
    this.replica = replica
    this.access = access

    this.topic = base32.encode(manifest.getTag())
    this._common = Monitor(this.pubsub, this.topic)
    this._directs = new Map()
  }

  async start () {
    this._common.on('peer-join', this._onPeerJoin) // join the direct channel topic for that peer and wait for them to join
    this._common.on('peer-leave', this._onPeerLeave) // if a peer leaves and the direct connection is closed then delete the direct

    await this._common.start()

    this.replica.events.on() // need to listen to the replica for head updates, on head update call broadcast
  }

  async stop () {
    this.replica.events.removeListener() // remove replica listener

    this._common.removeListener('peer-join', this._onPeerJoin)
    this._common.removeListener('peer-leave', this._onPeerLeave)

    for (const direct of this._directs) {
      await direct.close()
    }

    await this._common.close()
  }

  async broadcast (heads) {
    const block = await Block.encode({ value: Array.from(heads), codec, hasher })
    for (const direct of this.directs.values()) {
      if (direct.open) {
        this.pubsub.publish(direct.topic, block.bytes)
      }
    }
  }

  // may need to queue _onPeer* so start and stop arent called concurrently, or check for that in Direct

  _onPeerJoin (remotePeerId) {
    const direct = Direct(this.pubsub, this.peerId, remotePeerId)
    this.directs.put(remotePeerId, direct)
    direct.start()
  }

  _onPeerLeave (remotePeerId) {
    // if direct exists in this.directs Map then .delete returns true
    const direct = this.directs.get(remotePeerId)
    this.directs.delete(remotePeerId) && direct.stop()
  }
}
