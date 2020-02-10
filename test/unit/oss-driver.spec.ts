/**
 * @slynova/flydrive
 *
 * @license MIT
 * @copyright Slynova - Romain Lanz <romain.lanz@slynova.ch>
 */

import test from 'japa';
import uuid from 'uuid/v4';
import { Readable } from 'stream';

import { AliyunOSS, AliyunOSSConfig } from '../../src/Drivers/AliyunOSS';
import { FileNotFound, UnknownException } from '../../src/Exceptions';

function streamToString(stream: Readable): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: any[] = [];

		stream.on('data', (chunk) => chunks.push(chunk));
		stream.on('error', reject);
		stream.on('end', () => resolve(chunks.join('')));
	});
}

const config: AliyunOSSConfig = {
	key: process.env.OSS_KEY || '',
	secret: process.env.OSS_SECRET || '',
	endpoint: process.env.OSS_ENDPOINT || '',
	bucket: process.env.OSS_BUCKET || '',
	region: process.env.OSS_REGION || '',

	// needed for docker
	internal: false,
	secure: false,
};

// used to isolate tests in case of failures or other sessions running at the same time
let folder;
let testFile;
let otherFile;

const testString = 'test-data';

test.group('OSS Driver', (group) => {
	const ossDriver = new AliyunOSS(config);
	const fileURL = (KEY) => `http://${process.env.OSS_BUCKET}.${process.env.OSS_ENDPOINT}/${KEY}`;

	group.before(async () => {
		// Create test bucket
		try {
			await ossDriver
				.driver()
				.putBucket(process.env.OSS_BUCKET || '');
		} catch (error) {
			if (error.name !== 'BucketAlreadyExistsError') {
				throw error;
			}
		}
	});

	group.beforeEach(async () => {
		folder = uuid();
		testFile = `${folder}/test.txt`;
		otherFile = `${folder}/sub/dir/other.txt`;
		await ossDriver.put(testFile, Buffer.from(testString));
	});

	group.afterEach(async () => {
		try {
			await ossDriver.delete(testFile);
		} catch (e) {}
		try {
			await ossDriver.delete(otherFile);
		} catch (e) {}
	});

	test("return false when file doesn't exist", async (assert) => {
		const { exists } = await ossDriver.exists('some-file.jpg');
		assert.isFalse(exists);
	}).timeout(5000);

	// OSS does not support this. A string as the second parameter means source filename
	// test('create a new file', async (assert) => {
	// 	await ossDriver.put('some-file.txt', 'This is the text file');
	// 	const { content } = await ossDriver.get('some-file.txt');

	// 	assert.strictEqual(content, 'This is the text file');
	// }).timeout(5000);

	test('create a new file from buffer', async (assert) => {
		const str = 'this-is-a-test';
		const buffer = Buffer.from(str);

		await ossDriver.put(testFile, buffer);
		const { content } = await ossDriver.get(testFile, 'utf-8');
		assert.strictEqual(content, str);
	}).timeout(5000);

	test('create a new file from stream', async (assert) => {
		const stream = await ossDriver.getStream(testFile);

		await ossDriver.put(otherFile, stream);
		const { exists } = await ossDriver.exists(otherFile);

		assert.isTrue(exists);
	}).timeout(5000);

	test('throw exception when unable to put file', async (assert) => {
		assert.plan(1);
		try {
			const ossDriver = new AliyunOSS({ ...config, bucket: 'wrong' });
			await ossDriver.put('dummy-file.txt', Buffer.from('Hello'));
		} catch (error) {
			assert.instanceOf(error, UnknownException);
		}
	}).timeout(5000);

	test('delete existing file', async (assert) => {
		await ossDriver.put('dummy-file.txt', Buffer.from('Hello'));
		await ossDriver.delete('dummy-file.txt');

		const { exists } = await ossDriver.exists('dummy-file.txt');
		assert.isFalse(exists);
	}).timeout(5000);

	test('get file contents as string', async (assert) => {
		const { content } = await ossDriver.get(testFile);
		assert.equal(content, testString);
	}).timeout(5000);

	test('get file contents as Buffer', async (assert) => {
		const { content } = await ossDriver.getBuffer(testFile);
		assert.instanceOf(content, Buffer);
		assert.equal(content.toString(), testString);
	}).timeout(5000);

	test('get file that does not exist', async (assert) => {
		assert.plan(1);
		try {
			await ossDriver.get('bad.txt');
		} catch (e) {
			assert.instanceOf(e, FileNotFound);
		}
	}).timeout(5000);

	test('get the stat of a file', async (assert) => {
		const { size, modified } = await ossDriver.getStat(testFile);
		assert.strictEqual(size, testString.length);
		assert.instanceOf(modified, Date);
	}).timeout(5000);

	test('get file as stream', async (assert) => {
		const stream = await ossDriver.getStream(testFile);
		const content = await streamToString(stream);
		assert.equal(content, testString);
	}).timeout(5000);

	test('get public url to a file', (assert) => {
		const url = ossDriver.getUrl(testFile);
		assert.equal(url, fileURL(testFile));
	}).timeout(5000);

	test('get public url to a file when region is not defined', (assert) => {
		const ossDriver = new AliyunOSS({ ...config, region: undefined });
		const url = ossDriver.getUrl(testFile);
		assert.equal(url, fileURL(testFile));
	}).timeout(5000);
});
