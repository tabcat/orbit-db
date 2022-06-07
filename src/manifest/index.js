
import * as Block from 'multiformats/block'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'

import { Address as AddressImport } from './address'
export const Address = AddressImport
// import * as v0 from './v0'
// import * as v1 from './v1'
// const versions = [v0, v1]

const readonly = { writable: false, configurable: false, enumerable: true }
const hidden = { writable: false, configurable: false, enumerable: false }

export class Manifest {
  // unsafe; do not use constructor directly
  constructor (block) {
    this.block = block

    // assign defined manifest properties
    const manifest = this.block.value
    Object.keys(manifest).forEach(k => { this[k] = manifest[k] })

    Object.defineProperties(this, Object.create(
      // hide this.block from enumeration
      { block: hidden },
      // make manifest properties readonly
      Object.fromEntries(
        Object.keys(manifest).map(k => [k, readonly])
      ),
      // expose tag property
      { tag: { get: () => manifest.tag || this.block.cid.multihash.digest } }
    ))
  }

  static async create (name, options) {
    if (typeof name !== 'string') throw new Error('name must be a string')

    const value = {
      name,
      ...options
    }

    const block = await Block.encode({ value, codec, hasher })
    return new Manifest(block)
  }

  static async asManifest (manifest, force = false) {
    if (manifest instanceof Manifest) {
      return manifest
    }

    try {
      const { block: { bytes } } = manifest
      const block = await Block.decode({ bytes, codec, hasher })
      return new Manifest(block)
    } catch (e) {
      if (force) {
        console.error(e)
        throw new Error(`unable to coerce to manifest from: ${JSON.stringify(manifest)}`)
      }
      // todo: handle other errors differently

      return null
    }
  }

  static async getComponents (registry, manifest) {
    return {
      Store: registry.store.get(manifest.store.type),
      Access: registry.access.get(manifest.access.type),
      Entry: registry.entry.get(manifest.entry.type),
      Identity: registry.identity.get(manifest.identity.type)
    }
  }

  get address () {
    return new Address(this.block.cid)
  }

  get pathkey () {
    return this.address.toString() +
      this.version ? null : `/${this.name}`
  }

  get getTag () {
    return this.tag || this.block.cid.multihash.digest
  }
}
