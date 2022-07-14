export async function createInstance (ipfs, legacyOpts) {
  const options = legacyOpts
  options.ipfs = ipfs

  await this.create(options)
}
