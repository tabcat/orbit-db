
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
    this._common = null
    this._directs = new Set()
  }

  async start () {
    await this.pubsub.subscribe(this.topic, this._onReceivedBroadcast)
    await this.broadcast(this.replica.heads)
  }

  async stop () {
    await this.pubsub.unsubscribe(this.topic, this._onReceivedBroadcast)
  }

  async broadcast (heads) {
    const block = await Block.encode({ value: Array.from(heads), codec, hasher })
    await this.pubsub.publish(this.topic, block.bytes)
  }

  async _onReceivedBroadcast ({ data: bytes }) {
    const block = await Block.decode({ bytes, codec, hasher })
    const heads = new Set(block.value.map(cid => cid.toString(base32)))

    // find new heads if any
    const novel = new Set()
    for (const cid of heads) {
      const str = cid.toString(base32)
      if (!this.replica.known(str)) novel.add(str)
    }

    if (novel.size) {

    // if ahead of peer then we advertise heads
    const ahead = !Array.from(this.replica.heads
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
