# File storage

## What it is

Binary files (images, attachments, exports) are stored in an S3-compatible object store. Locally that's [Garage](https://garagehq.deuxfleurs.fr) from `compose.yaml`. `src/storage/index.ts` wraps the AWS S3 SDK:

| Function | Purpose |
| --- | --- |
| `putObject(key, body, contentType)` | Upload bytes |
| `getObject(key)` | Download `{ body, contentType }` |
| `deleteObject(key)` | Remove |

## What it's for

Discord attachment URLs expire, and the database is no place for large binary data. Keep files you need later in storage, and keep their **key** in the database. Any S3 provider works in production by changing the `S3_*` variables ([getting started](../getting-started.md#environment)).

## How it works

- **Keys.** Prefix keys with the feature and server: `<feature>/<guildId>/<id>`. Then a server's files can be listed or deleted together.
- **Where the calls go.** Call storage from a [service](services.md). Commands stay unaware of where bytes live.
- **Validate before uploading.** Check `attachment.contentType` and `attachment.size`.
- **Sending files back.** Download the object and attach it to the reply (`files: [{ attachment, name }]`). Don't hand out storage URLs.
- **Local setup.** `pnpm services:up`, then `pnpm storage:init` (cluster layout, access key, bucket; safe to rerun). The S3 API is on port 3900.

## Example: saving images

**`src/modules/gallery/gallery.service.ts`**

```ts
import type { Attachment } from 'discord.js';
import { Injectable } from '@/core';
import { getObject, putObject } from '@/storage';

const maxBytes = 8 * 1024 * 1024;

@Injectable()
export class GalleryService {
  async save(guildId: string, attachment: Attachment): Promise<string | undefined> {
    const type = attachment.contentType ?? '';
    if (!type.startsWith('image/') || attachment.size > maxBytes) return undefined;

    const response = await fetch(attachment.url);
    const key = `gallery/${guildId}/${attachment.id}`;
    await putObject(key, new Uint8Array(await response.arrayBuffer()), type);
    return key;
  }

  async load(key: string): Promise<Buffer> {
    const { body } = await getObject(key);
    return Buffer.from(body);
  }
}
```

Using it from a subcommand that has an attachment option:

```ts
const key = await this.gallery.save(interaction.guildId, interaction.options.getAttachment('image', true));
// store key in the database next to the item it belongs to

await interaction.reply({ files: [{ attachment: await this.gallery.load(key), name: 'image.png' }] });
```
