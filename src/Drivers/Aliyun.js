'use strict'

/**
 * node-flydrive
 *
 * @license MIT
 * @copyright Slynova - Romain Lanz <romain.lanz@slynova.ch>
 */

const Resetable = require('resetable')
/* eslint-disable import/no-extraneous-dependencies */
const OSS = require('ali-oss')

/**
 * Aliyun driver for using with flydriver
 *
 * @constructor
 * @class Aliyun
 */
class Aliyun {
  constructor (config) {
    this.oss = new OSS(Object.assign({}, {
      accessKeyId: config.key,
      accessKeySecret: config.secret,
      region: config.region,
      secure: config.secure,
    }, config))
    this._bucket = new Resetable(config.bucket)
  }

  /**
   * Use a different bucket at runtime
   *
   * @method bucket
   *
   * @param  {String} bucket
   *
   * @chainable
   */
  bucket (bucket) {
    this._bucket.set(bucket)
    return this
  }

  /**
   * Finds if a file exists or not
   *
   * @method exists
   * @async
   *
   * @param  {String} location
   * @param  {Object} [params]
   *
   * @return {Promise<Boolean>}
   */
  async exists (location, params) {
    await this.oss.head(location, params)
    return true
  }

  /**
   * Create a new file from string or buffer
   *
   * @method put
   * @async
   *
   * @param  {String} location
   * @param  {String} content
   * @param  {Object} [params]
   *
   * @return {Promise<String>}
   */
  async put (location, content, params) {
    const response = await this.oss.put(location, content, params)
    return response
  }

  /**
   * Remove a file
   *
   * @method delete
   * @async
   *
   * @param  {String} location
   * @param  {Object} [params = {}]
   *
   * @return {Promise<Boolean>}
   */
  async delete (location, params = {}) {
    await this.oss.delete(location, params)
    return true
  }

  /**
   * Returns contents for a given file
   *
   * @method get
   *
   * @param  {String} location
   * @param  {String} [file]
   * @param  {Object} [params = {}]
   *
   * @return {Promise<Buffer>}
   */
  async get (location, file = '', params = {}) {
    const response = await this.oss.get(location)
    const content = response.content
    if (Buffer.isBuffer(content)) {
      return content
    }
    throw Error(content)
  }

  /**
   * Returns the stream for the given file
   *
   * @method getStream
   *
   * @param  {String}  location
   * @param  {Object}  [params = {}]
   *
   * @return {Promise<Stream>}
   */
  async getStream (location, params = {}) {
    const { stream } = await this.oss.getStream(location, params)
    return stream
  }

  /**
   * Puts a stream
   *
   * @method putStream
   *
   * @param  {String}  location
   * @param  {Stream}  file
   * @param  {Object}  [params = {}]
   *
   * @return {Promise<String>}
   */
  async putStream (location, file, params = {}) {
    const response = await this.oss.putStream(location, file, params)
    return response
  }

  /**
   * Returns url for a given key. Note this method doesn't
   * validates the existence of file or it's visibility
   * status.
   *
   * @method getUrl
   *
   * @param  {String} location
   * @param  {String} bucket
   *
   * @return {String}
   */
  getUrl (location, bucket) {
    bucket = bucket || this._bucket.pull()
    const { secure, region } = this.oss.options
    const protocol = secure ? 'https://' : 'http://'
    return `${protocol}${bucket}.${region}.aliyuncs.com/${location}`
  }

  /**
   * Copy file from one location to another within
   * or accross oss buckets.
   *
   * @method copy
   *
   * @param  {String} src
   * @param  {String} dest
   * @param  {String} [destBucket = this.bucket]
   * @param  {Object} [params = {}]
   *
   * @return {Promise<String>}
   */
  async copy (src, dest, destBucket, params = {}) {
    // Aliyun OSS switches the src and destination for some reason
    const bucket = this._bucket.pull()
    const combinedDest = `/${bucket}/${src}`
    await this.oss.copy(dest, combinedDest)
    return this.getUrl(dest, destBucket)
  }

  /**
   * Moves file from one location to another. This
   * method will call `copy` and `delete` under
   * the hood.
   *
   * @method move
   *
   * @param  {String} src
   * @param  {String} dest
   * @param  {String} [destBucket = this.bucket]
   * @param  {Object} [params = {}]
   *
   * @return {Promise<String>}
   */
  async move (src, dest, destBucket, params = {}) {
    const url = await this.copy(src, dest, destBucket, params)
    await this.delete(src)
    return url
  }
}

module.exports = Aliyun
