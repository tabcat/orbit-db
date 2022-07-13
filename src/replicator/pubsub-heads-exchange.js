
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
    this._common = monitor(this.pubsub, this.topic)
    this._directs = new Map()
  }

  async start () {
    await this._common.start()
    this._common.on('peer-join', this._onPeerJoin) // join the direct channel topic for that peer and wait for them to join
    this._common.on('peer-leave', this._onPeerLeave) // if a peer leaves and the direct connection is closed then delete the direct
  }

  async stop () {
    for (const direct of this._directs) {
      await direct.close()
    }

    this._common.removeListener('peer-join', this._onPeerJoin)
    this._common.removeListener('peer-leave', this._onPeerLeave)
    await this._common.close()
  }

  async broadcast (heads) {
    const block = await Block.encode({ value: Array.from(heads), codec, hasher })
    for (const direct of this.directs) {
      if (direct.open) {
        this.pubsub.publish(direct.topic, block.bytes)
      }
    }
  }

  this._onPeerJoin (peerId) {
    
  }

  this._onPeerLeave (peerId) {

  }
}
