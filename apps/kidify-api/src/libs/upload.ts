import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { FileUpload } from 'graphql-upload';
import { createWriteStream } from 'fs';
import { mkdir, unlink } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import { join } from 'path';
import { getSerialForImage, validMimeTypes } from './config';
import { MemberType } from './enums/member.enum';
const uploadTargets = ['member', 'product', 'brand', 'event', 'article', 'review'];
export async function uploadImage(file: FileUpload, target: string, role: MemberType): Promise<string> {
	if (!uploadTargets.includes(target)) throw new BadRequestException('INVALID_UPLOAD_TARGET');
	if (['brand', 'event'].includes(target) && role !== MemberType.ADMIN) throw new ForbiddenException('FORBIDDEN');
	if (['product', 'article'].includes(target) && ![MemberType.SELLER, MemberType.ADMIN].includes(role))
		throw new ForbiddenException('FORBIDDEN');
	if (!file.filename || !validMimeTypes.includes(file.mimetype))
		throw new BadRequestException('PROVIDE_ALLOWED_FORMAT');
	const extension: Record<string, string> = { 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png' };
	const filename = getSerialForImage('image' + extension[file.mimetype]);
	const relativePath = `uploads/${target}/${filename}`;
	const absolutePath = join(process.cwd(), relativePath);
	await mkdir(join(process.cwd(), 'uploads', target), { recursive: true });
	let bytes = 0;
	const limit = new Transform({
		transform(chunk: Buffer, _encoding, callback) {
			bytes += chunk.length;
			callback(bytes > 15000000 ? new BadRequestException('FILE_TOO_LARGE') : null, chunk);
		},
	});
	try {
		await pipeline(file.createReadStream(), limit, createWriteStream(absolutePath, { flags: 'wx' }));
	} catch (error) {
		await unlink(absolutePath).catch(() => undefined);
		throw error;
	}
	return relativePath;
}
