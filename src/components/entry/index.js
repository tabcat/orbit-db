
import * as Block from 'multiformats/block'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import * as uint8Arrays from 'uint8arrays'

export class Entry {
  constructor ({ block, data, identity }) {
    this.block = block
    this.identity = identity

    Object.defineProperties({
      auth: { get: () => block.value.auth },
      sig: { get: () => block.value.sig },
      ...Object.fromEntries(
        Object.keys(data.value)
          .map(k => [k, { get: () => data.value[k] }])
      )
    })
  }

  static async create ({ identity, tag, clock, payload, next, refs }) {
    const data = await Block.encode({
      value: { v: 1, tag, clock, payload, next, refs },
      codec,
      hasher
    })

    const auth = identity.auth
    const sig = await identity.sign(data)
    const capsule = Block.encode({
      value: { auth, data, sig },
      codec,
      hasher
    })

    return new Entry({ block: capsule, data, identity })
  }

  static async fetch ({ blocks, Identity, cid }) {
    const { value: capsule } = await blocks.get(cid)
    const { auth, data, sig } = capsule

    const identity = await Identity.fetch({ blocks, auth })
    if (!await Entry.verify({ auth, data, sig, identity })) {
      throw new Error('entry with invalid signature')
    }

    return new Entry({ capsule, data: await Block.decode({ bytes: data, codec, hasher }), identity })
  }

  static async verify ({ auth, data, sig, identity }) {
    if (uint8Arrays.equals(auth, identity.auth)) {
      return false
    }

    return identity.verify({ data, sig })
  }

  static async validate () {}
}
