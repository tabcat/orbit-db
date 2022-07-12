
import { Key } from 'interface-datastore'
import * as Block from 'multiformats/block'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import { keys } from 'libp2p-crypto'

const type = 'based'
const secp256k1 = 'secp256k1'
const empty = ''

// todo: have get return from instances cache and safely check for password
// const instances = new WeakMap()
const privs = new WeakMap()

export class Identity {
  constructor ({ name, priv, pub, block }) {
    this.name = name
    this.block = block
    this.pub = pub

    if (priv) privs.set(this, priv)
  }

  static get type () { return type }
  get type () { return type }

  static async get ({ name, identities, keychain, password = empty }) {
    const key = Key.withNamespaces([this.type, name])
    const exists = await identities.has(key)

    if (!exists) {
      const keypair = await keys.generateKeyPair(secp256k1, 256)
      const marshalled = await keys.marshalPublicKey(keypair.public)

      const value = {
        id: marshalled,
        pub: marshalled,
        sig: await keypair.sign(marshalled)
      }
      const block = await Block.encode({ value, codec, hasher })

      await identities.put(key, block)

      const pem = await keypair.export(password)
      await keychain.importKey(block.cid.toString(), pem, password)
    }

    const bytes = await identities.get(key)
    const block = await Block.decode({ bytes, codec, hasher })
    const pem = await keychain.findKeyByName(block.cid.toString())
    const keypair = await keys.import(pem, password)

    return new Identity({
      name,
      priv: keypair,
      pub: keypair.public,
      block
    })
  }

  static async fetch ({ blocks, auth: cid }) {
    const bytes = await blocks.get(cid)
    const block = await Block.decode({ bytes, codec, hasher })
    const pub = await keys.unmarshalPublicKey(block.value.pub)

    return new Identity({ pub, block })
  }

  static async export () {}

  static async import () {}

  static async sign ({ identity, data }) {
    if (!privs.has(this)) {
      throw new Error('private key required to sign data')
    }

    return privs.get(this).sign(data)
  }

  static async verify ({ identity, data, sig }) {
    if (!identity.pub) {
      throw new Error('public key required to verify signed data')
    }

    return identity.pub.verify(data, sig)
  }

  get auth () { return this.block.value.auth }

  get id () { return this.block.value.id }

  get pub () { return this.block.value.pub }

  get sig () { return this.block.value.sig }
}
