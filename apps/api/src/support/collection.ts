/** Materialise an Arkormˣ collection (or null) into a plain array. */
export function toArray<T> (collection: Iterable<T> | null | undefined): T[] {
    return collection ? Array.from(collection) : []
}
