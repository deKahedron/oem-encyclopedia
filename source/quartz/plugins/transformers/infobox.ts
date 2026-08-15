import { QuartzTransformerPlugin } from "../types"

function isImage(line: string): boolean {
  const trimmed = line.trim()

  // Standard Markdown image: ![alt](url)
  if (/^!\[[^\]]*\]\([^)]*\)$/.test(trimmed)) {
    return true
  }

  // Obsidian image embed: ![[image.png]]
  if (/^!\[\[[^\]]+\]\]$/.test(trimmed)) {
    return true
  }

  return false
}

function transformInfoboxBlock(block: string[]): string[] {
  const firstLine = block[0]
  const content = block.slice(1).map((line) => line.replace(/^> ?/, ""))

  const output: string[] = [firstLine]
  let currentGroup: string[] = []
  let appearances = false

  const flushGroup = () => {
    if (currentGroup.length === 0) {
      return
    }

    const rows = currentGroup.filter((line) => line.trim() !== "")

    if (rows.length === 0) {
      currentGroup = []
      return
    }

    // Lines containing "Label -> Value" become table rows.
    // Anything else is left as normal Markdown.
    const fieldRows = rows.filter((line) => /\s*->\s*/.test(line))

    if (fieldRows.length > 0) {
      output.push("> | Field | Value |")
      output.push("> | --- | --- |")

      for (const line of rows) {
        const match = line.match(/^(.*?)\s*->\s*(.*)$/)

        if (match) {
          const [, label, value] = match
          output.push(`> | **${label.trim()}** | ${value.trim()} |`)
        } else {
          output.push(`> ${line}`)
        }
      }
    } else {
      for (const line of rows) {
        output.push(`> ${line}`)
      }
    }

    currentGroup = []
  }

  for (const line of content) {
    const trimmed = line.trim()

    // Blank line = end of a group.
    if (trimmed === "") {
      flushGroup()

      // Avoid adding unnecessary blank lines at the end.
      if (output[output.length - 1] !== ">") {
        output.push(">")
      }

      continue
    }

    // Image gets its own paragraph above the fields.
    if (isImage(trimmed)) {
      flushGroup()
      output.push(`> ${line}`)
      continue
    }

    // Special Avyrra section marker.
    if (trimmed.toLowerCase() === "// appearances") {
      flushGroup()
      appearances = true
      output.push("> ### Appearances")
      continue
    }

    // Everything after "// Appearances" is regular Markdown.
    if (appearances) {
      output.push(`> ${line}`)
      continue
    }

    currentGroup.push(line)
  }

  flushGroup()

  return output
}

export const Infobox: QuartzTransformerPlugin = () => ({
  name: "Infobox",

  textTransform(_ctx, src) {
    const lines = src.toString().split(/\r?\n/)
    const output: string[] = []

    let i = 0

    while (i < lines.length) {
      // Look for the beginning of an Avyrra infobox.
      if (/^> *\[!infobox\][+-]?.*$/.test(lines[i])) {
        const block: string[] = [lines[i]]
        i++

        // Consume the rest of the blockquote.
        while (i < lines.length && /^>/.test(lines[i])) {
          block.push(lines[i])
          i++
        }

        output.push(...transformInfoboxBlock(block))
        continue
      }

      output.push(lines[i])
      i++
    }

    return output.join("\n")
  },
})