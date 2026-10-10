export function parseSseBlock(block: string) {
  const payloads: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('data:')) {
      payloads.push(line.slice(5).trimStart())
    }
  }
  return payloads
}
