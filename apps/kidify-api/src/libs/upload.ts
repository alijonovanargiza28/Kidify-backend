import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Readable } from "stream";
import { uploadsDirectory } from "./runtime";
export type FileUpload = {
  filename: string;
  mimetype: string;
  encoding: string;
  createReadStream: () => Readable;
};
import { createWriteStream } from "fs";
import { mkdir, unlink } from "fs/promises";
import { pipeline } from "stream/promises";
import { Transform } from "stream";
import { join } from "path";
import { getSerialForImage, validMimeTypes } from "./config";
import { MemberType } from "./enums/member.enum";
const uploadTargets = [
  "member",
  "product",
  "brand",
  "event",
  "article",
  "review",
];
export async function uploadImage(
  file: FileUpload,
  target: string,
  role: MemberType,
): Promise<string> {
  if (!uploadTargets.includes(target))
    throw new BadRequestException("INVALID_UPLOAD_TARGET");
  if (["brand", "event"].includes(target) && role !== MemberType.ADMIN)
    throw new ForbiddenException("FORBIDDEN");
  if (
    ["product", "article"].includes(target) &&
    ![MemberType.SELLER, MemberType.ADMIN].includes(role)
  )
    throw new ForbiddenException("FORBIDDEN");
  if (!file.filename || !validMimeTypes.includes(file.mimetype))
    throw new BadRequestException("PROVIDE_ALLOWED_FORMAT");
  const extension: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
  };
  const filename = getSerialForImage("image" + extension[file.mimetype]);
  const relativePath = `uploads/${target}/${filename}`;
  const absolutePath = join(uploadsDirectory(), target, filename);
  await mkdir(join(uploadsDirectory(), target), { recursive: true });
  let bytes = 0;
  let header = Buffer.alloc(0);
  let checked = false;
  const limit = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > 15000000)
        return callback(new BadRequestException("FILE_TOO_LARGE"));
      if (checked) return callback(null, chunk);
      header = Buffer.concat([header, chunk]);
      if (header.length < 8) return callback();
      const valid =
        file.mimetype === "image/png"
          ? header
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : header[0] === 255 && header[1] === 216 && header[2] === 255;
      if (!valid)
        return callback(new BadRequestException("PROVIDE_ALLOWED_FORMAT"));
      checked = true;
      callback(null, header);
    },
    flush(callback) {
      callback(
        checked ? null : new BadRequestException("PROVIDE_ALLOWED_FORMAT"),
      );
    },
  });
  try {
    await pipeline(
      file.createReadStream(),
      limit,
      createWriteStream(absolutePath, { flags: "wx" }),
    );
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined);
    throw error;
  }
  return relativePath;
}
