/**
 * Strip the `char-` namespace prefix from an id. Used for normalizing
 * group member ids (which historically came in with the prefix from
 * Message.senderId construction) to bare characterIds matching
 * Character.id / characterMemoryStore keys.
 */
export function stripCharPrefix(id: string): string {
  return id.startsWith('char-') ? id.slice('char-'.length) : id;
}
