/**
 * @slynova/flydrive
 *
 * @license MIT
 * @copyright Slynova - Romain Lanz <romain.lanz@slynova.ch>
 */

import { Readable } from 'stream';
import OSS, { Options, SignatureUrlOptions, HeadObjectOptions, PutObjectOptions, CopyObjectOptions } from 'ali-oss';
import { Storage } from '..';
import { UnknownException, FileNotFound } from '../Exceptions';
import { SignedUrlOptions, Response, ExistsResponse, ContentResponse, SignedUrlResponse, StatResponse } from '../types';
import { RequestOptions } from 'https';

function handleError(err: Error, path: string): never {
	switch (err.name) {
		case 'NoSuchKeyError':
			throw new FileNotFound(err, path);
		default:
			throw new UnknownException(err, err.name, path);
	}
}

export class AliyunOSS extends Storage {
	protected $driver: OSS;
	protected $config: Options;
	protected $bucket: string;

	constructor(config: AliyunOSSConfig) {
		super();
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const OSS = require('ali-oss');

		const configParams = {
			accessKeyId: config.key,
			accessKeySecret: config.secret,
			...config,
		}

		this.$driver = new OSS(configParams);
		this.$config = configParams;
		this.$bucket = config.bucket;
	}

	/**
	 * Use a different bucket at runtime.
	 * This method returns a new instance of OSS.
	 */
	public bucket(bucket: string): OSS {
		return new OSS({
			...this.$config,
			bucket,
		});
	}

	/**
	 * Copy a file to a location.
	 */
	public async copy(src: string, dest: string, options?: CopyObjectOptions): Promise<Response> {
		try {
			const result = await this.$driver.copy(dest, src, options);
			return { raw: result };
		} catch (e) {
			return handleError(e, src);
		}
	}

	/**
	 * Delete existing file.
	 */
	public async delete(location: string, options?: RequestOptions): Promise<Response> {
		try {
			const result = await this.$driver.delete(location, options);
			return { raw: result };
		} catch (e) {
			return handleError(e, location);
		}
	}

	/**
	 * Returns the driver.
	 */
	public driver(): OSS {
		return this.$driver;
	}

	/**
	 * Determines if a file or folder already exists.
	 */
	public async exists(location: string, options?: HeadObjectOptions): Promise<ExistsResponse> {
		try {
			const result = await this.$driver.head(location, options);
			return { exists: true, raw: result };
		} catch (e) {
			if (e.status === 404) {
				return { exists: false, raw: e };
			}
			return handleError(e, location);
		}
	}

	/**
	 * Returns the file contents.
	 */
	public async get(location: string, encoding = 'utf-8'): Promise<ContentResponse<string>> {
		const bufferResult = await this.getBuffer(location);
		return {
			content: bufferResult.content.toString(encoding),
			raw: bufferResult.raw,
		};
	}

	/**
	 * Returns the file contents as Buffer.
	 */
	public async getBuffer(location: string): Promise<ContentResponse<Buffer>> {
		try {
			const result = await this.$driver.get(location);

			// OSS.get returns a Buffer in Node.js
			const body = result.content as Buffer;

			return { content: body, raw: result };
		} catch (e) {
			return handleError(e, location);
		}
	}

	/**
	 * Returns signed url for an existing file
	 */
	public async getSignedUrl(location: string, options: SignedUrlOptions & SignatureUrlOptions = {}): Promise<SignedUrlResponse> {
    const { expiry = 900 } = options;
    const params = Object.assign({ expires: expiry }, options);
  
		try {
			const result = await this.$driver.signatureUrl(location, params);
			return { signedUrl: result, raw: result };
		} catch (e) {
			return handleError(e, location);
		}
	}

	/**
	 * Returns file's size and modification date.
	 */
	public async getStat(location: string): Promise<StatResponse> {
		try {
			const result = await this.$driver.head(location);
			return {
				size: Number(result.res.headers['content-length']),
				modified: new Date(result.res.headers['last-modified']),
				raw: result,
			};
		} catch (e) {
			return handleError(e, location);
		}
	}

	/**
	 * Returns the stream for the given file.
	 */
	public async getStream(location: string): Promise<Readable> {
		const { stream } = await this.$driver.getStream(location);
		return stream;
	}

	/**
	 * Returns url for a given key.
	 */
	public getUrl(location: string): string {
		return this.$driver.generateObjectUrl(location);
	}

	/**
	 * Moves file from one location to another. This
	 * method will call `copy` and `delete` under
	 * the hood.
	 */
	public async move(src: string, dest: string): Promise<Response> {
		await this.copy(src, dest);
		await this.delete(src);
		return { raw: undefined };
	}

	/**
	 * Creates a new file.
	 * This method will create missing directories on the fly.
	 * Note, if the content parameter is a string, it should be a path to the source file.
	 */
	public async put(location: string, content: Buffer | Readable | string, options?: PutObjectOptions): Promise<Response> {
		try {
			const result = await this.$driver.put(location, content, options);
			return { raw: result };
		} catch (e) {
			return handleError(e, location);
		}
	}
}

export interface AliyunOSSConfig {
	key: string;
  secret: string;
	bucket: string;
	endpoint?: string;
	region?: string;
	internal?: boolean;
  secure?: boolean;
}
