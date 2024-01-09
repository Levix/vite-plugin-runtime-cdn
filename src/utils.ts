const splitRE = /\r?\n/

export function numberToPos(
  source: string,
  offset: number | { line: number, column: number },
): { line: number, column: number } {
  if (typeof offset !== 'number')
    return offset
  if (offset > source.length) {
    throw new Error(
            `offset is longer than source length! offset ${offset} > length ${source.length}`,
    )
  }
  const lines = source.split(splitRE)
  let counted = 0
  let line = 0
  let column = 0
  for (; line < lines.length; line++) {
    const lineLength = lines[line].length + 1
    if (counted + lineLength >= offset) {
      column = offset - counted + 1
      break
    }
    counted += lineLength
  }
  return { line: line + 1, column }
}

/**
 * Get a random ID
 *
 * @param length number
 * @returns string
 */
export function getRandomID(length = 10) {
  let result = ''
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const charactersLength = characters.length
  for (let i = 0; i < length; i++)
    result += characters.charAt(Math.floor(Math.random() * charactersLength))

  return result
}
